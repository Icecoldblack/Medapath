import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const INSURANCE_PLANS: Record<string, string[]> = {
  'Aetna': [
    'Aetna Choice POS II',
    'Aetna Open Access HMO',
    'Aetna PPO',
    'Aetna Medicare Advantage',
    'Aetna Student Health',
  ],
  'Blue Cross Blue Shield': [
    'BCBS PPO',
    'BCBS Blue Choice HMO',
    'BCBS Federal Employee',
    'BCBS Blue Preferred POS',
    'BCBS High Deductible',
  ],
  'Cigna': [
    'Cigna Connect HMO',
    'Cigna Open Access Plus',
    'Cigna PPO',
    'Cigna Medicare Supplement',
    'Cigna HealthSpring',
  ],
  'UnitedHealthcare': [
    'UHC Choice Plus PPO',
    'UHC Navigate HMO',
    'UHC Medicare Advantage',
    'UHC Student Resources',
    'UHC Oxford Freedom',
  ],
  'Humana': [
    'Humana Gold Plus HMO',
    'Humana PPO',
    'Humana Medicare Advantage',
    'Humana ChoiceCare Network',
  ],
  'Kaiser Permanente': [
    'Kaiser HMO',
    'Kaiser Bronze 60',
    'Kaiser Silver 70',
    'Kaiser Gold 80',
    'Kaiser Senior Advantage',
  ],
  'Self-pay': [],
  'Other': [],
};

export default function IntakePage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    zipCode: '',
    insuranceProvider: '',
    planName: ''
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-request location on page load
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        // Reverse geocode to get ZIP
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
        if (!apiKey) { setLocationLoading(false); return; }
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&result_type=postal_code&key=${apiKey}`
          );
          const data = await res.json();
          if (data.status === 'OK' && data.results.length > 0) {
            const postalComponent = data.results[0].address_components.find(
              (c: { types: string[] }) => c.types.includes('postal_code')
            );
            if (postalComponent) {
              setFormData(prev => ({ ...prev, zipCode: postalComponent.short_name }));
            }
          }
        } catch { /* silent — user can enter manually */ }
        setLocationLoading(false);
      },
      () => { setLocationLoading(false); },
      { timeout: 10000 }
    );
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    // Reset plan when provider changes
    if (id === 'insuranceProvider') {
      setFormData(prev => ({ ...prev, insuranceProvider: value, planName: '' }));
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocationLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&result_type=postal_code&key=${apiKey}`
          );
          const data = await res.json();
          if (data.status === 'OK' && data.results.length > 0) {
            const postalComponent = data.results[0].address_components.find(
              (c: { types: string[] }) => c.types.includes('postal_code')
            );
            if (postalComponent) {
              setFormData(prev => ({ ...prev, zipCode: postalComponent.short_name }));
            } else {
              setError('Could not determine ZIP code from your location.');
            }
          } else {
            setError('Reverse geocoding failed. Please enter your ZIP code manually.');
          }
        } catch {
          setError('Failed to look up your ZIP code.');
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setError('Location access was denied. Please enter your ZIP code manually.');
        setLocationLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      age: parseInt(formData.age, 10),
      zipCode: formData.zipCode,
      insuranceProvider: formData.insuranceProvider,
      planName: formData.planName,
    };
    // Send lat/lng if we have them so backend doesn't need to geocode
    if (coords) {
      payload.latitude = coords.lat;
      payload.longitude = coords.lng;
    }

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create session. Please check your inputs.');
      const data = await res.json();
      sessionStorage.setItem('sessionId', data.sessionId);
      navigate('/symptoms');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const availablePlans = INSURANCE_PLANS[formData.insuranceProvider] ?? [];

  return (
    <main className="flex-grow w-full max-w-4xl mx-auto px-6 py-12">
      {/* ─── Progress Header ─── */}
      <div className="mb-12">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2">Patient Intake</h1>
            <p className="text-on-surface-variant font-medium">Step 1 of 4: Personal &amp; Insurance Information</p>
          </div>
          <div className="text-primary font-bold text-lg">25%</div>
        </div>
        <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden flex gap-1">
          <div className="h-full w-1/4 bg-gradient-to-r from-primary to-primary-container rounded-full" />
          <div className="h-full w-1/4 bg-surface-container rounded-full" />
          <div className="h-full w-1/4 bg-surface-container rounded-full" />
          <div className="h-full w-1/4 bg-surface-container rounded-full" />
        </div>
      </div>

      {/* ─── Form Canvas ─── */}
      <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-12 shadow-[0_8px_32px_rgba(25,28,29,0.04)]">
        {error && (
          <div className="mb-6 p-4 bg-error/10 text-error rounded-xl font-medium">
            {error}
          </div>
        )}
        <form className="space-y-10" onSubmit={handleSubmit}>
          {/* Section: Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-2" htmlFor="firstName">
                First Name
              </label>
              <input
                id="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                type="text"
                placeholder="Enter your first name"
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-4 text-on-surface focus:ring-0 focus:bg-surface-container-lowest focus:border-b-2 focus:border-primary transition-all duration-200 placeholder:text-outline"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-2" htmlFor="lastName">
                Last Name
              </label>
              <input
                id="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                type="text"
                placeholder="Enter your last name"
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-4 text-on-surface focus:ring-0 focus:bg-surface-container-lowest focus:border-b-2 focus:border-primary transition-all duration-200 placeholder:text-outline"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-2" htmlFor="age">
                Age
              </label>
              <input
                id="age"
                value={formData.age}
                onChange={handleChange}
                required
                type="number"
                placeholder="Years"
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-4 text-on-surface focus:ring-0 focus:bg-surface-container-lowest focus:border-b-2 focus:border-primary transition-all duration-200 placeholder:text-outline"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-2" htmlFor="zipCode">
                ZIP Code
              </label>
              <div className="relative group">
                <input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  required
                  type="text"
                  placeholder="00000"
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-4 pr-32 text-on-surface focus:ring-0 focus:bg-surface-container-lowest focus:border-b-2 focus:border-primary transition-all duration-200 placeholder:text-outline"
                />
                <button
                  type="button"
                  onClick={handleUseLocation}
                  disabled={locationLoading}
                  className="absolute right-2 top-2 bottom-2 px-3 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-xs font-bold text-primary transition-colors flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {locationLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-sm">my_location</span>
                  )}
                  {locationLoading ? 'Locating…' : 'Use Location'}
                </button>
              </div>
              {coords && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  Location detected
                </p>
              )}
            </div>
          </div>

          {/* Section: Coverage */}
          <div className="pt-6 border-t border-outline-variant/15">
            <h2 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">verified_user</span>
              Insurance Coverage
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-2" htmlFor="insuranceProvider">
                  Insurance Provider
                </label>
                <div className="relative">
                  <select
                    id="insuranceProvider"
                    value={formData.insuranceProvider}
                    onChange={handleChange}
                    required
                    className="appearance-none w-full bg-surface-container-low border-none rounded-xl px-4 py-4 text-on-surface focus:ring-0 focus:bg-surface-container-lowest focus:border-b-2 focus:border-primary transition-all duration-200"
                  >
                    <option disabled value="">Select Provider</option>
                    {Object.keys(INSURANCE_PLANS).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                    <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-2" htmlFor="planName">
                  Plan Name / Type
                </label>
                {availablePlans.length > 0 ? (
                  <div className="relative">
                    <select
                      id="planName"
                      value={formData.planName}
                      onChange={handleChange}
                      className="appearance-none w-full bg-surface-container-low border-none rounded-xl px-4 py-4 text-on-surface focus:ring-0 focus:bg-surface-container-lowest focus:border-b-2 focus:border-primary transition-all duration-200"
                    >
                      <option value="">Select Plan (optional)</option>
                      {availablePlans.map(plan => (
                        <option key={plan} value={plan}>{plan}</option>
                      ))}
                      <option value="other">Other / Not Listed</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                      <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
                    </div>
                  </div>
                ) : (
                  <input
                    id="planName"
                    value={formData.planName}
                    onChange={handleChange}
                    type="text"
                    placeholder="e.g. Choice POS II"
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-4 text-on-surface focus:ring-0 focus:bg-surface-container-lowest focus:border-b-2 focus:border-primary transition-all duration-200 placeholder:text-outline"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Guidance Note */}
          <div className="p-6 bg-primary-fixed/30 rounded-2xl flex gap-4 items-start">
            <span className="material-symbols-outlined text-on-primary-fixed-variant mt-0.5">info</span>
            <div>
              <p className="text-sm font-medium text-on-primary-fixed-variant">Why we need this information</p>
              <p className="text-xs text-on-primary-fixed-variant opacity-80 leading-relaxed mt-1">
                Your location and insurance details help us find specialized providers in your network and provide
                localized health alerts relevant to your area.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-8">
            <button
              type="submit"
              disabled={loading}
              className={`group flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary-container text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Submitting...' : 'Next'}
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
