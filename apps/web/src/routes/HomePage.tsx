import { EVENT_CATEGORIES } from "@planzo/shared";
import { GoogleMap, MarkerF, useLoadScript } from "@react-google-maps/api";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL, GOOGLE_MAPS_API_KEY } from "../lib/env";

type SearchResult = {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  ends_at: string;
  hero_image_url: string | null;
  lat: number;
  lng: number;
  venue_name: string;
  venue_address: string | null;
  distance_m: number;
  min_price_cents: number | null;
  has_paid: boolean | null;
  has_free: boolean | null;
};

function formatDistance(meters: number) {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}

function formatPrice(r: SearchResult) {
  if (r.min_price_cents === null) return "Tickets";
  if (!r.has_paid && r.has_free) return "Free";
  const dollars = (r.min_price_cents / 100).toFixed(2);
  return `From $${dollars}`;
}

export default function HomePage() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [category, setCategory] = useState<string>("");
  const [price, setPrice] = useState<"any" | "free" | "paid">("any");
  const [startingSoon, setStartingSoon] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("Weekend events for creatives");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [persona, setPersona] = useState("Creator");
  const [timeWindow, setTimeWindow] = useState("Tonight");
  const [budget, setBudget] = useState("Under $30");

  const hasMaps = Boolean(GOOGLE_MAPS_API_KEY);
  const { isLoaded } = useLoadScript(
    useMemo(
      () => ({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY
      }),
      []
    )
  );

  async function fetchResults(loc: { lat: number; lng: number }) {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const soonEnd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        lat: String(loc.lat),
        lng: String(loc.lng),
        radiusKm: String(radiusKm),
        price
      });
      if (category) params.set("category", category);
      if (startingSoon) {
        params.set("from", now.toISOString());
        params.set("to", soonEnd.toISOString());
      }
      const res = await fetch(`${API_BASE_URL}/search/events?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Search failed");
      setResults(data.results ?? []);
    } catch (err: any) {
      setResults([]);
      setError(err?.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!location) return;
    fetchResults(location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, radiusKm, category, price, startingSoon]);

  return (
    <div className="space-y-6">
      {/* Hero + AI Concierge */}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card overflow-hidden bg-gradient-to-br from-surface-900 via-surface-900 to-surface-950">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-500">Planzo AI Concierge</div>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-surface-50 sm:text-4xl">
            Find events that match your vibe
          </h1>
          <p className="mt-2 text-base text-surface-400">
            Personalized discovery with map-first context, smart filters, and AI-guided suggestions.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              className="input flex-1"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Try: after-work networking near downtown"
            />
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => {
                const ideas = [
                  `Top picks for: ${aiPrompt}`,
                  `Trending for ${persona}s: Local Creative Lab, Neighborhood Fitness Pop‑Up`,
                  `Suggested filters: 5km radius • ${timeWindow} • ${budget}`
                ];
                setAiSuggestions(ideas);
              }}
            >
              Generate
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Persona</span>
              <select className="input mt-1" value={persona} onChange={(e) => setPersona(e.target.value)}>
                <option>Creator</option>
                <option>Student</option>
                <option>Founder</option>
                <option>Fitness</option>
                <option>Family</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Time window</span>
              <select className="input mt-1" value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}>
                <option>Tonight</option>
                <option>Tomorrow</option>
                <option>This weekend</option>
                <option>Next 7 days</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Budget</span>
              <select className="input mt-1" value={budget} onChange={(e) => setBudget(e.target.value)}>
                <option>Under $30</option>
                <option>Under $50</option>
                <option>Free only</option>
                <option>Any</option>
              </select>
            </label>
          </div>
          {aiSuggestions.length > 0 ? (
            <ul className="mt-4 space-y-2 rounded-xl bg-surface-950/50 p-3 text-sm text-surface-300">
              {aiSuggestions.map((s, idx) => (
                <li key={`${s}-${idx}`} className="flex items-start gap-2">
                  <span className="text-brand-500">•</span>
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="card flex flex-col">
          <h2 className="font-display text-lg font-semibold text-surface-50">Quick actions</h2>
          <div className="mt-4 flex flex-1 flex-col gap-3">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => {
                setError(null);
                navigator.geolocation.getCurrentPosition(
                  (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => setError("Location permission denied. Enter coordinates manually below."),
                  { enableHighAccuracy: true, timeout: 8000 }
                );
              }}
            >
              Use my location
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => {
                if (!location) return;
                fetchResults(location);
              }}
            >
              Refresh results
            </button>
            <Link className="btn-secondary w-full text-center" to="/organizer">
              Create an event
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="text-sm font-semibold text-surface-200">Filters</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="text-xs font-medium text-surface-500">Radius (km)</span>
            <input
              className="input mt-1"
              type="number"
              min={1}
              max={100}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-surface-500">Category</span>
            <select className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Any</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-surface-500">Price</span>
            <select className="input mt-1" value={price} onChange={(e) => setPrice(e.target.value as "any" | "free" | "paid")}>
              <option value="any">Any</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-surface-700 bg-surface-900 px-4 py-2.5 transition-colors hover:border-surface-600">
            <input
              type="checkbox"
              checked={startingSoon}
              onChange={(e) => setStartingSoon(e.target.checked)}
              className="h-4 w-4 rounded border-surface-600 bg-surface-900 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-surface-300">Starting soon (6h)</span>
          </label>
          <div className="flex flex-col justify-center rounded-xl border border-surface-700 bg-surface-900/50 px-4 py-2.5">
            <span className="text-xs font-medium text-surface-500">Location</span>
            <span className="text-sm font-medium text-surface-200">
              {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Not set"}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      {/* Results + Map */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-surface-50">Results</h2>
            <span className="text-sm text-surface-500">{loading ? "Searching…" : `${results.length} events`}</span>
          </div>

          {results.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-12 text-center">
              <p className="text-surface-400">
                {location ? "No events found in this area yet." : "Set your location to search."}
              </p>
              {!location && (
                <button
                  type="button"
                  className="btn-primary mt-4"
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                      () => setError("Location permission denied."),
                      { enableHighAccuracy: true, timeout: 8000 }
                    );
                  }}
                >
                  Use my location
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/events/${r.id}`}
                    className="card-hover group block p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-surface-50 transition-colors group-hover:text-brand-400">
                          {r.title}
                        </h3>
                        <p className="mt-1 text-sm text-surface-400">
                          {r.venue_name}
                          {r.venue_address ? ` • ${r.venue_address}` : ""}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="badge">{r.category}</span>
                          <span className="badge-brand">{formatPrice(r)}</span>
                          <span className="badge">{formatDistance(r.distance_m)}</span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-surface-500">
                        {new Date(r.starts_at).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden p-0">
          {!hasMaps ? (
            <div className="flex h-[400px] items-center justify-center p-6 text-center text-sm text-surface-400 sm:h-[520px]">
              Map disabled. Set <code className="rounded bg-surface-800 px-1.5 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
              <code className="rounded bg-surface-800 px-1.5 py-0.5">apps/web/.env</code> to enable.
            </div>
          ) : !isLoaded ? (
            <div className="flex h-[400px] items-center justify-center text-surface-500 sm:h-[520px]">Loading map…</div>
          ) : !location ? (
            <div className="flex h-[400px] items-center justify-center text-surface-500 sm:h-[520px]">Set your location to view the map.</div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: 520, borderRadius: 12 }}
              center={location}
              zoom={12}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                styles: [
                  { elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
                  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
                  { elementType: "labels.text.fill", stylers: [{ color: "#737373" }] },
                  { featureType: "poi", stylers: [{ visibility: "off" }] },
                  { featureType: "transit", stylers: [{ visibility: "off" }] }
                ]
              }}
            >
              <MarkerF position={location} />
              {results.map((r) => (
                <MarkerF key={r.id} position={{ lat: r.lat, lng: r.lng }} />
              ))}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
}
