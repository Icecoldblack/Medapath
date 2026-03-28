import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Hospital {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  inNetwork: boolean;
  distance: string;
  distanceMiles: number;
  rating: number;
  estimatedWaitTime: string;
  phone: string;
  website: string;
  matchReason: string;
  coverageNote: string | null;
  matchScore: number;
}

interface MatchResponse {
  sessionId: number;
  diagnosis: string;
  urgencyLevel: string;
  hospitals: Hospital[];
}

// ─── Map Component ───────────────────────────────────────────────────────────

interface HospitalMapProps {
  hospitals: Hospital[];
  userLat: number;
  userLng: number;
  selectedId: number | null;
  onSelectHospital: (id: number) => void;
}

function makePinSvg(label: string, bg: string, border: string): string {
  return `data:image/svg+xml;utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z"
            fill="${bg}" stroke="${border}" stroke-width="2"/>
      <circle cx="18" cy="18" r="10" fill="white" opacity="0.9"/>
      <text x="18" y="23" font-size="12" font-weight="bold" fill="${bg}"
            text-anchor="middle" font-family="Arial,sans-serif">${label}</text>
    </svg>
  `)}`;
}

function makeUserPinSvg(): string {
  return `data:image/svg+xml;utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="10" fill="#4285F4" stroke="white" stroke-width="3"/>
      <circle cx="14" cy="14" r="4" fill="white"/>
    </svg>
  `)}`;
}

function HospitalMap({ hospitals, userLat, userLng, selectedId, onSelectHospital }: HospitalMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    // Check if Google Maps script is loaded
    if (typeof google === 'undefined' || !google.maps) {
      setMapError('Google Maps is still loading. Please switch to Map View again in a moment.');
      return;
    }

    let cancelled = false;

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: userLat, lng: userLng },
        zoom: 12,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControl: false,
      });

      mapInstanceRef.current = map;

      // User location dot
      new google.maps.Marker({
        map,
        position: { lat: userLat, lng: userLng },
        title: 'Your Location',
        icon: {
          url: makeUserPinSvg(),
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 14),
        },
        zIndex: 999,
      });

      // Hospital markers
      markersRef.current = hospitals.map((hospital, idx) => {
        const isTop = idx === 0;
        const bg = isTop ? '#1B5E20' : '#2D6A4F';

        const marker = new google.maps.Marker({
          map,
          position: { lat: hospital.latitude, lng: hospital.longitude },
          title: hospital.name,
          icon: {
            url: makePinSvg(`${idx + 1}`, bg, '#ffffff'),
            scaledSize: new google.maps.Size(isTop ? 44 : 36, isTop ? 58 : 48),
            anchor: new google.maps.Point(isTop ? 22 : 18, isTop ? 58 : 48),
          },
          zIndex: isTop ? 100 : 10,
        });

        marker.addListener('click', () => {
          onSelectHospital(hospital.id);
          map.panTo({ lat: hospital.latitude, lng: hospital.longitude });
        });

        return marker;
      });

      // Fit bounds to show all markers
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: userLat, lng: userLng });
      hospitals.forEach(h => bounds.extend({ lat: h.latitude, lng: h.longitude }));
      map.fitBounds(bounds, 50);

      if (!cancelled) setMapLoaded(true);
    } catch (err) {
      if (!cancelled) setMapError(`Failed to load map: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return () => {
      cancelled = true;
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLat, userLng, hospitals]);

  // Pan to selected hospital
  useEffect(() => {
    if (!mapInstanceRef.current || selectedId === null) return;
    const hospital = hospitals.find(h => h.id === selectedId);
    if (hospital) {
      mapInstanceRef.current.panTo({ lat: hospital.latitude, lng: hospital.longitude });
      mapInstanceRef.current.setZoom(14);
    }
  }, [selectedId, hospitals]);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-container-low rounded-3xl">
        <div className="text-center p-8">
          <span className="material-symbols-outlined text-4xl text-error mb-3 block">map_off</span>
          <p className="text-on-surface-variant text-sm">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-on-surface-variant text-sm font-medium">Loading map…</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [mapsReady, setMapsReady] = useState(false);

  // Load Google Maps script
  useEffect(() => {
    if (typeof google !== 'undefined' && google.maps) {
      setMapsReady(true);
      return;
    }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!apiKey) return;

    // Check if script already loading
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const check = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          setMapsReady(true);
          clearInterval(check);
        }
      }, 200);
      return () => clearInterval(check);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsReady(true);
    document.head.appendChild(script);
  }, []);

  // Fetch matched hospitals
  useEffect(() => {
    const fetchHospitals = async () => {
      const sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) {
        setError('No session found. Please go back to the intake form.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/hospitals/match?sessionId=${sessionId}`);
        if (!res.ok) throw new Error('Failed to fetch matched hospitals.');
        const responseData: MatchResponse = await res.json();
        setData(responseData);

        if (responseData.hospitals?.length > 0) {
          setSelectedHospital(responseData.hospitals[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchHospitals();
  }, []);

  // Try to get geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        if (data?.hospitals?.length) {
          setUserCoords({ lat: data.hospitals[0].latitude, lng: data.hospitals[0].longitude });
        }
      }
    );
  }, [data]);

  // Fallback: center on first hospital
  useEffect(() => {
    if (!userCoords && data?.hospitals?.length) {
      setUserCoords({ lat: data.hospitals[0].latitude, lng: data.hospitals[0].longitude });
    }
  }, [data, userCoords]);

  // ─── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 pt-24 pb-24 flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <h2 className="text-2xl font-bold text-on-surface">Finding best matches…</h2>
        <p className="text-on-surface-variant">Analyzing your symptoms and location</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-5xl mx-auto px-6 pt-12 pb-24 text-center">
        <div className="bg-error-container rounded-3xl p-10 inline-block">
          <span className="material-symbols-outlined text-error text-5xl mb-4 block">error</span>
          <h2 className="text-2xl font-bold text-error mb-3">Something went wrong</h2>
          <p className="text-on-surface-variant mb-6">{error}</p>
          <button
            onClick={() => navigate('/intake')}
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-opacity"
          >
            Start Over
          </button>
        </div>
      </main>
    );
  }

  const selectedHospitalData = data.hospitals.find(h => h.id === selectedHospital) ?? data.hospitals[0];

  const urgencyColor = (() => {
    const u = data.urgencyLevel?.toLowerCase() ?? '';
    if (u.includes('high') || u.includes('critical') || u.includes('emergency')) return 'text-red-600';
    if (u.includes('low') || u.includes('mild') || u.includes('non')) return 'text-green-600';
    return 'text-amber-600';
  })();

  const formatDistance = (h: Hospital) => {
    if (h.distanceMiles < 0) return 'Distance unavailable';
    return h.distance;
  };

  return (
    <main className="max-w-6xl mx-auto px-6 pt-12 pb-24">

      {/* ─── Progress Stepper ──────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex justify-between items-end mb-3">
          <span className="font-headline font-bold text-primary text-sm uppercase tracking-widest">Step 4 of 4</span>
          <span className="font-body text-on-surface-variant text-sm">Hospital Matches</span>
        </div>
        <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden flex gap-1">
          <div className="h-full w-1/4 bg-primary-container opacity-40 rounded-full" />
          <div className="h-full w-1/4 bg-primary-container opacity-40 rounded-full" />
          <div className="h-full w-1/4 bg-primary-container opacity-40 rounded-full" />
          <div className="h-full w-1/4 bg-gradient-to-r from-primary to-primary-container rounded-full" />
        </div>
      </div>

      {/* ─── Header ────────────────────────────────────────────── */}
      <section className="mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">
          Matched Hospitals
        </h1>
        <p className="text-lg text-on-surface-variant max-w-2xl leading-relaxed">
          Based on your symptoms, urgency level, location, and insurance — here are your best nearby care options.
        </p>
      </section>

      {/* ─── Summary Card ──────────────────────────────────────── */}
      <div className="bg-primary-fixed/20 border border-primary/10 rounded-3xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_hospital
            </span>
          </div>
          <div>
            <p className="text-xs text-on-primary-fixed-variant font-bold uppercase tracking-widest mb-0.5">Your Assessment</p>
            <p className="text-base font-bold text-on-surface">
              {data.diagnosis}
              {' '}·{' '}
              <span className={urgencyColor}>{data.urgencyLevel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-primary text-sm">pin_drop</span>
          <span>{data.hospitals.length} facilities found</span>
          <button
            onClick={() => navigate('/analysis')}
            className="ml-4 text-sm font-bold text-primary flex items-center gap-1 hover:underline"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Review Analysis
          </button>
        </div>
      </div>

      {/* ─── Tab Switcher ──────────────────────────────────────── */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'list'
              ? 'bg-primary text-white shadow-md'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-sm">list</span>
          List View
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'map'
              ? 'bg-primary text-white shadow-md'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-sm">map</span>
          Map View
        </button>
      </div>

      {/* ─── Map View ──────────────────────────────────────────── */}
      {activeTab === 'map' && (
        <div className="mb-10 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 h-[480px] rounded-3xl overflow-hidden shadow-lg border border-outline-variant/10">
            {userCoords && mapsReady ? (
              <HospitalMap
                hospitals={data.hospitals}
                userLat={userCoords.lat}
                userLng={userCoords.lng}
                selectedId={selectedHospital}
                onSelectHospital={setSelectedHospital}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-container-low rounded-3xl">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-on-surface-variant text-sm">{mapsReady ? 'Acquiring location…' : 'Loading Google Maps…'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Selected hospital info panel */}
          {selectedHospitalData && (
            <div className="lg:w-72 bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/10 shadow-sm flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                    {data.hospitals.findIndex(h => h.id === selectedHospitalData.id) + 1}
                  </span>
                  {selectedHospitalData.inNetwork && (
                    <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">In-Network</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-on-surface mt-2 mb-1">{selectedHospitalData.name}</h3>
                <p className="text-sm text-on-surface-variant mb-4 flex items-start gap-1">
                  <span className="material-symbols-outlined text-sm mt-0.5">location_on</span>
                  {selectedHospitalData.address}
                </p>

                <div className="space-y-2 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">local_hospital</span>
                    <span>{selectedHospitalData.type}</span>
                  </div>
                  {selectedHospitalData.estimatedWaitTime && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span>Est. wait: {selectedHospitalData.estimatedWaitTime}</span>
                    </div>
                  )}
                  {selectedHospitalData.rating > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span>{selectedHospitalData.rating}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">near_me</span>
                    <span>{formatDistance(selectedHospitalData)}</span>
                  </div>
                </div>

                {selectedHospitalData.coverageNote && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                    <p className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">verified_user</span>
                      Coverage Insight
                    </p>
                    <p className="text-xs text-blue-700 leading-relaxed">{selectedHospitalData.coverageNote}</p>
                  </div>
                )}

                {selectedHospitalData.matchReason && (
                  <p className="mt-3 text-xs text-on-surface-variant bg-surface-container px-3 py-2 rounded-xl leading-relaxed">
                    {selectedHospitalData.matchReason}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {selectedHospitalData.phone && (
                  <a
                    href={`tel:${selectedHospitalData.phone}`}
                    className="w-full text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-white font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    Call {selectedHospitalData.phone}
                  </a>
                )}
                {selectedHospitalData.website && (
                  <a
                    href={selectedHospitalData.website}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full text-center px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface font-semibold text-sm hover:bg-surface-container transition-colors"
                  >
                    Visit Website
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── List View ─────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="space-y-5 mb-10">
          {data.hospitals.length > 0 ? data.hospitals.map((hospital, idx) => (
            <div
              key={hospital.id ?? idx}
              onClick={() => {
                setSelectedHospital(hospital.id);
                setActiveTab('map');
              }}
              className={`bg-surface-container-lowest rounded-3xl p-7 shadow-[0_8px_32px_rgba(25,28,29,0.04)] border transition-all cursor-pointer group ${
                selectedHospital === hospital.id
                  ? 'border-primary/40 ring-2 ring-primary/20'
                  : 'border-outline-variant/10 hover:border-primary/20 hover:shadow-md'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4 flex-1">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${
                    idx === 0 ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-on-surface">{hospital.name}</h3>
                      {hospital.inNetwork ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-bold">
                          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                          In-Network
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold">
                          Out-of-Network
                        </span>
                      )}
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-xs font-bold">
                          Best Match
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {hospital.address} · {formatDistance(hospital)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">local_hospital</span>
                        {hospital.type}
                      </span>
                      {hospital.estimatedWaitTime && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          {hospital.estimatedWaitTime}
                        </span>
                      )}
                      {hospital.rating > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          {hospital.rating}
                        </span>
                      )}
                    </div>

                    {hospital.coverageNote && (
                      <p className="mt-2 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg inline-block">
                        <span className="font-bold">Coverage:</span> {hospital.coverageNote}
                      </p>
                    )}

                    {hospital.matchReason && (
                      <p className="mt-1 text-xs text-on-surface-variant/70">{hospital.matchReason}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setSelectedHospital(hospital.id); setActiveTab('map'); }}
                    className="px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface font-semibold hover:bg-surface-container transition-colors text-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">map</span>
                    Map
                  </button>
                  {hospital.website && (
                    <a
                      href={hospital.website}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface font-semibold hover:bg-surface-container transition-colors text-sm"
                    >
                      Website
                    </a>
                  )}
                  {hospital.phone && (
                    <a
                      href={`tel:${hospital.phone}`}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-white font-bold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm"
                    >
                      Call
                    </a>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center p-10 bg-surface-container-low rounded-3xl">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">search_off</span>
              <p className="text-on-surface-variant">No matching hospitals found.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Bottom Actions ─────────────────────────────────────── */}
      <div className="mt-4 p-7 bg-surface-container-high/40 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-5">
        <div>
          <h4 className="font-bold text-on-surface mb-1">Not finding what you need?</h4>
          <p className="text-sm text-on-surface-variant">Expand your search radius or update your insurance information.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/intake')}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface font-semibold hover:bg-surface-container transition-colors text-sm"
          >
            Update Info
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg transition-all text-sm"
          >
            Start Over
          </button>
        </div>
      </div>
    </main>
  );
}
