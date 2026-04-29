import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { Link, useParams } from "react-router-dom";
import EventReviews from "../components/EventReviews";
import { useAuth } from "../lib/auth";
import { getEvent } from "../lib/api";

function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 50);
    const t2 = setTimeout(fix, 250);
    const t3 = setTimeout(fix, 800);
    window.addEventListener("resize", fix);
    const container = map.getContainer();
    const ro = new ResizeObserver(fix);
    if (container) ro.observe(container);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", fix);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

type TicketTier = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  remaining_qty: number;
  description?: string;
};

type EventDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  hero_image_url: string | null;
  lat: number;
  lng: number;
  organizer_id: string;
  organizer_name: string;
  venue_id: string;
  venue_name: string;
  venue_address: string | null;
  city?: string;
  rating?: number;
  review_count?: number;
  tags?: string[];
};

const planzoIcon = L.divIcon({
  className: "",
  html: '<div class="planzo-pin"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function centsToDollars(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function EventPage() {
  const { id } = useParams();
  const auth = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [aiFaqs, setAiFaqs] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [buyingTierId, setBuyingTierId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const data = await getEvent(id);
      if (!data) {
        setError("Event not found.");
      } else {
        setEvent(data.event);
        setTiers(data.ticketTiers ?? []);
        setAiFaqs(data.aiFaqs ?? []);
        setUsingMock(data.mock);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!event) return;
    document.title = `${event.title} · Planzo`;
  }, [event]);

  if (loading)
    return (
      <div className="card py-12 text-center text-surface-300">Loading…</div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  if (!event) return null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      {event.hero_image_url && (
        <div
          className="relative h-72 w-full overflow-hidden rounded-2xl bg-cover bg-center"
          style={{ backgroundImage: `url(${event.hero_image_url})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-center gap-2">
              <span className="badge">{event.category}</span>
              <span className="badge-brand">
                {new Date(event.starts_at).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {usingMock && <span className="badge-emerald">Demo data</span>}
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">
              {event.title}
            </h1>
            <p className="mt-1 text-surface-300">
              {event.venue_name}
              {event.venue_address ? ` · ${event.venue_address}` : ""}
              {event.city ? ` · ${event.city}` : ""}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* About */}
          <div className="card">
            <h2 className="font-display text-xl">About</h2>
            <p className="mt-3 whitespace-pre-wrap text-surface-200">
              {event.description || "No description."}
            </p>
            <p className="mt-4 text-sm text-surface-400">
              Hosted by{" "}
              <Link
                to={`/organizers/${event.organizer_id}`}
                className="text-brand-300 hover:text-brand-400"
              >
                {event.organizer_name}
              </Link>
              {event.rating != null && (
                <>
                  {" "}
                  · ★ {event.rating} ({event.review_count} reviews)
                </>
              )}
            </p>
            {event.tags && event.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {event.tags.map((t) => (
                  <span key={t} className="badge">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="card overflow-hidden p-0">
            <div className="h-72 w-full">
              <MapContainer
                center={[event.lat, event.lng]}
                zoom={14}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
              >
                <MapAutoResize />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[event.lat, event.lng]} icon={planzoIcon} />
              </MapContainer>
            </div>
          </div>

          {aiFaqs.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">FAQs</h2>
                <span className="text-xs text-surface-500">Auto-generated</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {aiFaqs.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-3"
                  >
                    <p className="font-medium text-surface-100">{f.q}</p>
                    <p className="mt-1 text-sm text-surface-400">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <EventReviews eventId={event.id} />
        </div>

        {/* Tickets */}
        <aside className="space-y-4">
          <div className="card">
            <h2 className="font-display text-xl">Tickets</h2>
            {tiers.length === 0 ? (
              <p className="mt-3 text-surface-400">
                No ticket tiers available.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {tiers.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-surface-700/50 bg-surface-900/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-surface-100">
                          {t.name}
                        </div>
                        {t.description && (
                          <p className="text-xs text-surface-400">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-1 text-sm text-surface-400">
                          {t.remaining_qty} left
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-lg text-brand-300">
                          {centsToDollars(t.price_cents)}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn-primary mt-3 w-full"
                      disabled={
                        usingMock ||
                        !auth.user ||
                        t.remaining_qty <= 0 ||
                        buyingTierId === t.id
                      }
                      onClick={async () => {
                        if (!auth.user) return;
                        setBuyingTierId(t.id);
                        try {
                          const data = await auth.apiFetch<{
                            stripeCheckoutUrl: string;
                          }>("/checkout/create-session", {
                            method: "POST",
                            body: JSON.stringify({
                              ticketTierId: t.id,
                              quantity: 1,
                            }),
                          });
                          window.location.href = data.stripeCheckoutUrl;
                        } catch (err: any) {
                          setError(err?.message ?? "Checkout failed");
                        } finally {
                          setBuyingTierId(null);
                        }
                      }}
                    >
                      {usingMock
                        ? "Connect API to buy"
                        : !auth.user
                          ? "Sign in to buy"
                          : t.remaining_qty <= 0
                            ? "Sold out"
                            : buyingTierId === t.id
                              ? "Redirecting…"
                              : t.price_cents === 0
                                ? "Reserve free seat"
                                : `Buy for ${centsToDollars(t.price_cents)}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!auth.user && (
              <p className="mt-3 text-center text-xs text-surface-400">
                <Link to="/login" className="text-brand-300">
                  Sign in
                </Link>{" "}
                to purchase tickets.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
