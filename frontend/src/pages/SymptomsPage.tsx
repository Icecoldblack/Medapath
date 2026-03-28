import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function SymptomsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [symptomText, setSymptomText] = useState('');
  const [severity, setSeverity] = useState('');
  const [duration, setDuration] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSetFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Only images (JPG, PNG, GIF, WebP) and videos (MP4, MOV, WebM) are allowed.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('File must be under 10MB.');
      return;
    }
    setError(null);
    setFile(f);
    if (f.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(f));
    } else {
      setFilePreview(null); // No preview for videos
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const removeFile = () => {
    setFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomText || !severity || !duration) {
      setError('Please fill out all required fields.');
      return;
    }
    const sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      setError('Session missing. Please go back and resubmit the intake form.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      sessionId: parseInt(sessionId, 10),
      symptomText,
      severity,
      duration
    };

    try {
      let res: Response;

      if (file) {
        // Use multipart endpoint with image
        const formData = new FormData();
        formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
        formData.append('image', file);
        res = await fetch('/api/analyze', { method: 'POST', body: formData });
      } else {
        // JSON-only endpoint
        res = await fetch('/api/analyze/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        throw new Error('Analysis failed.');
      }

      const data = await res.json();
      navigate('/analysis', { state: { analysisResult: data } });
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-6 pt-12 pb-24">
      {/* ─── Progress Bar ─── */}
      <div className="mb-12">
        <div className="flex justify-between items-end mb-3">
          <span className="font-headline font-bold text-primary text-sm uppercase tracking-widest">Step 2 of 4</span>
          <span className="font-body text-on-surface-variant text-sm">Symptoms Assessment</span>
        </div>
        <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden flex gap-1">
          <div className="h-full w-1/4 bg-primary-container opacity-40 rounded-full" />
          <div className="h-full w-1/4 bg-gradient-to-r from-primary to-primary-container rounded-full" />
          <div className="h-full w-1/4 bg-surface-container rounded-full" />
          <div className="h-full w-1/4 bg-surface-container rounded-full" />
        </div>
      </div>

      {/* ─── Header ─── */}
      <div className="mb-10 text-left">
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-4">
          Tell us how you're feeling.
        </h1>
        <p className="text-lg text-on-surface-variant max-w-2xl leading-relaxed">
          Describe your symptoms in your own words. Our clinical engine will help identify patterns to provide a more
          accurate analysis.
        </p>
      </div>

      {/* ─── Main Grid ─── */}
      {error && (
        <div className="mb-6 p-4 bg-error/10 text-error rounded-xl font-medium">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-8 space-y-8">
            {/* Free Text Area */}
            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
              <label className="block font-headline font-bold text-on-surface mb-4">
                What symptoms are you experiencing?
              </label>
              <textarea
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                required
                rows={6}
                placeholder="e.g. I've had a persistent dry cough for the past three days, along with a slight fever and body aches..."
                className="w-full bg-surface-container-low border-none rounded-xl p-4 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-all duration-200 placeholder:text-outline resize-none text-on-surface"
              />
              <div className="flex justify-between items-center mt-3">
                <p className="text-xs text-on-surface-variant">Be as specific as possible — duration, location, intensity.</p>
                <span className="text-xs text-outline">{symptomText.length} / 500</span>
              </div>
            </section>

            {/* Severity */}
            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
              <label className="block font-headline font-bold text-on-surface mb-4">
                How severe are your symptoms?
              </label>
              <div className="grid grid-cols-4 gap-3">
                {['Mild', 'Moderate', 'Severe', 'Critical'].map((level, idx) => {
                  const colors = severity === level ? [
                    'bg-tertiary text-on-tertiary',
                    'bg-primary text-on-primary',
                    'bg-amber-600 text-white',
                    'bg-error text-on-error',
                  ] : [
                    'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary-fixed',
                    'bg-primary-fixed text-on-primary-fixed-variant border-primary-fixed',
                    'bg-amber-100 text-amber-800 border-amber-200',
                    'bg-error-container text-on-error-container border-error-container',
                  ];

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSeverity(level)}
                      className={`py-3 rounded-xl border-2 font-semibold text-sm hover:scale-[1.03] active:scale-95 transition-all ${colors[idx]} ${severity === level ? 'border-transparent shadow-md' : ''}`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-on-surface-variant mt-3">
                Select the option that best describes the overall intensity of your symptoms.
              </p>
            </section>

            {/* Duration */}
            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
              <label className="block font-headline font-bold text-on-surface mb-4" htmlFor="duration">
                How long have you had these symptoms?
              </label>
              <div className="relative">
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                  className="appearance-none w-full bg-surface-container-low border-none rounded-xl px-4 py-4 text-on-surface focus:ring-2 focus:ring-primary/30 transition-all duration-200"
                >
                  <option disabled value="">Select duration</option>
                  <option value="hours">Less than 24 hours</option>
                  <option value="days">1–3 days</option>
                  <option value="week">4–7 days</option>
                  <option value="weeks">1–2 weeks</option>
                  <option value="month">More than 2 weeks</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                  <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
                </div>
              </div>
            </section>

            {/* Photo/Video Upload */}
            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
              <label className="block font-headline font-bold text-on-surface mb-2">
                Upload a photo or video <span className="text-on-surface-variant font-normal text-sm">(Optional)</span>
              </label>
              <p className="text-xs text-on-surface-variant mb-4">
                If applicable, upload a photo or short video of the affected area. This can help improve the analysis.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="border-2 border-primary/30 bg-primary-fixed/10 rounded-2xl p-6 flex items-center gap-4">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl" />
                  ) : (
                    <div className="w-20 h-20 bg-surface-container rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-primary">videocam</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{file.name}</p>
                    <p className="text-xs text-on-surface-variant">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-2 rounded-full hover:bg-error/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-error">close</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer group ${
                    dragOver
                      ? 'border-primary bg-primary-fixed/20'
                      : 'border-outline-variant hover:border-primary/50 hover:bg-primary-fixed/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-4xl text-outline group-hover:text-primary transition-colors">
                    add_photo_alternate
                  </span>
                  <p className="text-sm text-on-surface-variant">
                    Drag & drop or <span className="text-primary font-semibold">browse files</span>
                  </p>
                  <p className="text-xs text-outline">JPG, PNG, GIF, WebP, MP4, MOV, WebM — up to 10MB</p>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Guidance Card */}
            <div className="bg-tertiary-fixed/10 p-6 rounded-3xl border border-tertiary-container/20">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-tertiary-container">tips_and_updates</span>
                <h3 className="font-bold text-on-tertiary-fixed-variant text-sm">Tips for Accuracy</h3>
              </div>
              <ul className="space-y-3 text-xs text-on-surface leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-tertiary-fixed-dim text-sm mt-0.5">check_circle</span>
                  Mention when symptoms started and if they've changed over time.
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-tertiary-fixed-dim text-sm mt-0.5">check_circle</span>
                  Include any medications you're currently taking.
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-tertiary-fixed-dim text-sm mt-0.5">check_circle</span>
                  Note related conditions or recent travel.
                </li>
              </ul>
            </div>

            {/* Emergency Warning */}
            <div className="bg-error-container/30 p-6 rounded-3xl border border-error/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>
                  emergency
                </span>
                <h3 className="font-bold text-on-error-container text-sm">Emergency?</h3>
              </div>
              <p className="text-xs text-on-error-container/80 leading-relaxed">
                If you're experiencing chest pain, difficulty breathing, or severe bleeding, call <strong>911</strong> immediately.
              </p>
            </div>

            {/* Privacy Note */}
            <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-primary uppercase">Your data</p>
                <p className="text-sm text-on-surface font-semibold">HIPAA compliant</p>
              </div>
              <span className="material-symbols-outlined text-primary">lock</span>
            </div>
          </div>
        </div>

        {/* ─── Actions ─── */}
        <div className="flex justify-between items-center mt-12">
          <button
            type="button"
            onClick={() => navigate('/intake')}
            className="flex items-center gap-2 text-on-surface-variant font-semibold hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`group flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary-container text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Analyzing...' : 'Analyze Symptoms'}
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </button>
        </div>
      </form>
    </main>
  );
}
