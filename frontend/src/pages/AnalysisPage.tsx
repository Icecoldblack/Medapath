import { useLocation, useNavigate } from 'react-router-dom';

export default function AnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.analysisResult;

  if (!data) {
    return (
      <main className="max-w-5xl mx-auto px-6 pt-12 pb-24 text-center">
        <h1 className="text-2xl font-bold mb-4">No Analysis Found</h1>
        <p className="mb-6">Please start from the intake page.</p>
        <button onClick={() => navigate('/intake')} className="bg-primary px-6 py-2 text-white rounded-xl">Go to Intake</button>
      </main>
    );
  }

  // Define dynamic color handling based on urgency level
  let urgencyColorClass = 'text-amber-700';
  let urgencyBgClass = 'bg-amber-100';
  let urgencyIconClass = 'text-amber-600';
  let urgencyIconName = 'error';

  const lowerUrgency = data.urgencyLevel?.toLowerCase() || '';
  if (lowerUrgency.includes('high') || lowerUrgency.includes('critical') || lowerUrgency.includes('red')) {
    urgencyColorClass = 'text-error';
    urgencyBgClass = 'bg-error-container';
    urgencyIconClass = 'text-error';
    urgencyIconName = 'emergency';
  } else if (lowerUrgency.includes('low') || lowerUrgency.includes('green') || lowerUrgency.includes('mild')) {
    urgencyColorClass = 'text-green-700';
    urgencyBgClass = 'bg-green-100';
    urgencyIconClass = 'text-green-600';
    urgencyIconName = 'check_circle';
  }

  return (
    <main className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      {/* ─── Progress Stepper ─── */}
      <div className="mb-12">
        <div className="flex justify-between items-end mb-3">
          <span className="font-headline font-bold text-primary text-sm uppercase tracking-widest">Step 3 of 4</span>
          <span className="font-body text-on-surface-variant text-sm">Analysis Stage</span>
        </div>
        <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden flex gap-1">
          <div className="h-full w-1/4 bg-primary-container opacity-40 rounded-full" />
          <div className="h-full w-1/4 bg-primary-container opacity-40 rounded-full" />
          <div className="h-full w-1/4 bg-gradient-to-r from-primary to-primary-container rounded-full" />
          <div className="h-full w-1/4 bg-surface-container rounded-full" />
        </div>
      </div>

      {/* ─── Hero Header ─── */}
      <section className="mb-10 text-left">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">
          Diagnostic Analysis
        </h1>
        <p className="text-lg text-on-surface-variant max-w-2xl leading-relaxed">
          Our clinical engine has processed your inputs and cross-referenced with current medical literature to provide
          these initial insights.
        </p>
      </section>

      {/* ─── Bento Grid Results ─── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Main Result Card */}
        <div className="md:col-span-8 bg-surface-container-lowest p-8 rounded-3xl shadow-[0_8px_32px_rgba(25,28,29,0.04)] flex flex-col justify-between border border-outline-variant/10">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                analytics
              </span>
              <span className="text-sm font-bold tracking-widest text-on-surface-variant uppercase">
                Initial Findings
              </span>
            </div>
            <h2 className="text-3xl font-bold text-on-surface mb-2">
              Likely Concern: {data.primaryCondition || 'Unknown condition'}
            </h2>
            <div className="text-on-surface-variant mb-4 leading-relaxed">
              <p>{data.advice || 'No advice provided.'}</p>
              
              {data.possibleConditions && data.possibleConditions.length > 0 && (
                <div className="mt-4">
                  <strong>Other potential conditions:</strong>
                  <ul className="list-disc ml-6 mt-1 text-sm">
                    {data.possibleConditions.map((cond: string, idx: number) => (
                      <li key={idx}>{cond}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Urgency & Action Tray */}
          <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full ${urgencyBgClass} flex items-center justify-center`}>
                <span
                  className={`material-symbols-outlined ${urgencyIconClass}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {urgencyIconName}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Urgency Level</p>
                <p className={`text-lg font-bold ${urgencyColorClass}`}>{data.urgencyLevel}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/results')}
              className="bg-primary hover:bg-primary-container text-white px-8 py-3 rounded-xl font-bold transition-all transform active:scale-95 shadow-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined">local_hospital</span>
              Find Matched Hospitals
            </button>
          </div>
        </div>

        {/* Guidance Sidebar */}
        <div className="md:col-span-4 space-y-6">
          {/* Clinical Guidance */}
          <div className="bg-tertiary-container/10 p-6 rounded-3xl border border-tertiary-container/20">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-tertiary-container">medical_information</span>
              <h3 className="font-bold text-on-tertiary-fixed-variant">Clinical Guidance</h3>
            </div>
            <p className="text-sm text-on-surface leading-relaxed font-medium">
              We suggest: <strong>{data.careTypeSuggested || 'Routine checkup'}</strong>.
              <br/><br/>
              Seek urgent care in the next 24 hours if symptoms worsen, or if you experience difficulty breathing.
            </p>
          </div>

          {/* Review Image Note */}
          {data.imageAnalyzed && (
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden relative group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">image</span>
                  <h3 className="font-bold text-on-surface">Review Image</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                  A diagnostic image was uploaded. Our system has flagged specific regions for clinician review.
                </p>
                <a
                  href="#"
                  className="text-xs font-bold text-primary flex items-center gap-1 group-hover:underline"
                >
                  View annotated report
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </a>
              </div>
              {/* Abstract image representation */}
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <img
                  alt="Medical scan"
                  className="w-24 h-24 object-cover rounded-xl"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjAahhinIPTqy-BB8t14xOmVh8-kUkyz40QcWbnSbdMuMB_DSBAiJsJCGhybWASAmuE_8HP-EVraSbj9wOkkzigaj1tamjB_kWheyOYbDdm0gf81c_cbTt0ma-tp9LhRCkr1pYsodMOksQBLBCCI9WaY6JcDMcLU6hmvlVelU6Ldr6_DSZRuR9tdA28mgRh4dTo1S86orS19qemoDfrQoUyJ6hTl0gLPWU-_SA-v29Dn7b0XHyjm7UZYJhHboWCjauc6wIVN9ZEZet"
                />
              </div>
            </div>
          )}

          {/* Contact Support */}
          <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-primary uppercase">Need help?</p>
              <p className="text-sm text-on-surface font-semibold">Speak to a nurse</p>
            </div>
            <span className="material-symbols-outlined text-primary">chat</span>
          </div>
        </div>
      </div>

      {/* ─── Secondary Information ─── */}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 bg-surface-container-high/50 rounded-3xl">
          <h4 className="font-bold text-lg mb-4">What's Going On</h4>
          {data.detailedExplanation ? (
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {data.detailedExplanation}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Based on the symptoms you described, our system has identified potential areas of concern.
              Please consult with a healthcare provider for a thorough evaluation.
            </p>
          )}
        </div>

        <div className="relative rounded-3xl overflow-hidden min-h-[200px] flex items-end p-8 group">
          <img
            alt="Hospital hallway"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAHhKBmqK7Dzh9Qh6yZSny9LEN-xYNy-6a5LFOBRHJnTVVgL-b0lqeXTdFwe1QLfzaDFhV04YJZos37sFcmLpkd-NyM_BG3yrlDWAwomPrNwVKBQg3o_E9RtJ_TNtuNaJSM2PHuofao3jYuwtxw1CaBRCHtj0OEZA4vatoyhaUQ0MLRA-fDB4gdAKqQK7VnC3t4riJLhjbBkVIARRX-sI25WRlWMwLsUWBtZfw7VkSoVSmM6LqBVeEl3K7RIDseo4D-1GymTbG9vE4I"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
          <div className="relative z-10 text-white">
            <h4 className="font-bold text-xl mb-2">Nearby Facilities</h4>
            <p className="text-sm text-slate-200 mb-4">
              We'll find the best hospitals matched to your condition and insurance.
            </p>
            <button
              onClick={() => navigate('/results')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-6 py-2 rounded-full text-sm font-bold transition-colors"
            >
              View Map
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
