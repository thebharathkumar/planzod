import { EVENT_CATEGORIES } from "@planzo/shared";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import Recommendations from "../components/Recommendations";
import { searchEvents } from "../lib/api";

type SearchResult = {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  ends_at?: string;
  hero_image_url: string | null;
  lat: number;
  lng: number;
  venue_name: string;
  venue_address: string | null;
  city?: string;
  distance_m: number;
  min_price_cents: number | null;
  has_paid: boolean | null;
  has_free: boolean | null;
  rating?: number;
  review_count?: number;
  featured?: boolean;
  tags?: string[];
};

const planzoIcon = L.divIcon({
  className: "",
  html: '<div class="planzo-pin"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function formatDistance(meters: number) {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}

function formatPrice(r: SearchResult) {
  if (r.min_price_cents === null) return "Tickets";
  if (!r.has_paid && r.has_free) return "Free";
  const dollars = (r.min_price_cents / 100).toFixed(0);
  return `From $${dollars}`;
}

function FlyTo({
  lat,
  lng,
  zoom = 11,
}: {
  lat: number;
  lng: number;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [lat, lng, zoom, map]);
  return null;
}

// Leaflet sometimes initializes before its container settles its size, leaving
// blank tiles. Force a recompute on mount and on window resize.
function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 400);
    const t3 = setTimeout(fix, 1000);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

export default function HomePage() {
  const [location, setLocation] = useState<{ lat: number; lng: number }>({
    lat: 39.5,
    lng: -98.35,
  });
  const [zoom, setZoom] = useState(4);
  const [radiusKm, setRadiusKm] = useState(50);
  const [category, setCategory] = useState<string>("");
  const [price, setPrice] = useState<"any" | "free" | "paid">("any");
  const [startingSoon, setStartingSoon] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { results, mock } = await searchEvents({
      lat: location.lat,
      lng: location.lng,
      radiusKm,
      category: category || undefined,
      price,
      startingSoon,
    });
    setResults(results);
    setUsingMock(mock);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, price, startingSoon]);

  function locateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setZoom(11);
        setTimeout(refresh, 100);
      },
      () => {
        // ignored
      },
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }

  const featured = useMemo(
    () => results.filter((r) => r.featured).slice(0, 3),
    [results],
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="glass-panel relative overflow-hidden p-8 md:p-12">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative">
          <span className="badge-violet mb-3">✨ Discover · Local · Free</span>
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
            <span className="gradient-text">Find your next</span>
            <br />
            unforgettable experience
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-surface-300">
            From neighborhood meetups to world-class concerts. Map-first
            discovery, transparent pricing, instant tickets.{" "}
            {usingMock && <span className="badge-emerald ml-2">Demo data</span>}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={locateMe}>
              📍 Use my location
            </button>
            <Link to="/globe" className="btn-secondary">
              🌍 Explore the globe
            </Link>
            <Link to="/organizer" className="btn-secondary">
              ➕ Host an event
            </Link>
          </div>
        </div>
      </section>

      <Recommendations />

      {/* Featured */}
      {featured.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl">⭐ Featured this week</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.map((e) => (
              <Link
                key={e.id}
                to={`/events/${e.id}`}
                className="card-hover overflow-hidden p-0"
              >
                {e.hero_image_url && (
                  <div
                    className="h-40 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${e.hero_image_url})` }}
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="badge">{e.category}</span>
                    <span className="badge-brand">{formatPrice(e)}</span>
                  </div>
                  <h3 className="mt-2 font-display text-lg leading-tight">
                    {e.title}
                  </h3>
                  <p className="mt-1 text-sm text-surface-400">
                    {new Date(e.starts_at).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-surface-500">
                    {e.venue_name}
                    {e.city ? ` · ${e.city}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Filters + Map + List */}
      <section className="space-y-4">
        <div className="card flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs text-surface-400">Category</span>
            <select
              className="input mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-surface-400">Price</span>
            <select
              className="input mt-1"
              value={price}
              onChange={(e) => setPrice(e.target.value as any)}
            >
              <option value="any">Any</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-surface-400">
              Radius ({radiusKm} km)
            </span>
            <input
              type="range"
              min={1}
              max={500}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="mt-2 w-48"
              onMouseUp={refresh}
              onTouchEnd={refresh}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={startingSoon}
              onChange={(e) => setStartingSoon(e.target.checked)}
            />
            Starting soon (next 6h)
          </label>
          <div className="ml-auto text-xs text-surface-400">
            {loading ? "Searching…" : `${results.length} events`}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          {/* Map */}
          <div className="card overflow-hidden p-0 lg:sticky lg:top-20 lg:self-start">
            <div className="h-[520px] w-full">
              <MapContainer
                center={[location.lat, location.lng]}
                zoom={zoom}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapAutoResize />
                <FlyTo lat={location.lat} lng={location.lng} zoom={zoom} />
                {results.map((r) => (
                  <Marker
                    key={r.id}
                    position={[r.lat, r.lng]}
                    icon={planzoIcon}
                    eventHandlers={{
                      click: () => setActiveId(r.id),
                    }}
                  >
                    <Popup>
                      <div className="font-medium" style={{ color: "#fafafa" }}>
                        {r.title}
                      </div>
                      <div style={{ color: "#9b8770", fontSize: 12 }}>
                        {r.venue_name}
                        {r.city ? ` · ${r.city}` : ""}
                      </div>
                      <Link to={`/events/${r.id}`} style={{ color: "#fb923c" }}>
                        View event →
                      </Link>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {results.length === 0 && !loading && (
              <div className="card text-center text-surface-400">
                No events match these filters. Try widening your search.
              </div>
            )}
            {results.map((r) => (
              <Link
                key={r.id}
                to={`/events/${r.id}`}
                className={`card-hover block ${
                  activeId === r.id ? "border-orange-500/60" : ""
                }`}
                onMouseEnter={() => setActiveId(r.id)}
              >
                <div className="flex gap-3">
                  {r.hero_image_url && (
                    <div
                      className="h-20 w-28 shrink-0 rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: `url(${r.hero_image_url})` }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="badge">{r.category}</span>
                      <span className="badge-brand">{formatPrice(r)}</span>
                      {r.featured && (
                        <span className="badge-violet">★ Featured</span>
                      )}
                    </div>
                    <h3 className="mt-1 truncate font-medium text-surface-100">
                      {r.title}
                    </h3>
                    <p className="text-sm text-surface-400">
                      {new Date(r.starts_at).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-surface-500">
                      {r.venue_name}
                      {r.city ? ` · ${r.city}` : ""} ·{" "}
                      {formatDistance(r.distance_m)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
