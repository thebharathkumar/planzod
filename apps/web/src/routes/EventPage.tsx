import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { API_BASE_URL } from "../lib/env";

type TicketTier = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  remaining_qty: number;
  sales_start: string;
  sales_end: string | null;
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
};

function centsToDollars(cents: number) {
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
  const [buyingTierId, setBuyingTierId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/events/${id}`, { headers: { accept: "application/json" } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message ?? "Failed to load event");
        setEvent(data.event);
        setTiers(data.ticketTiers ?? []);
        setAiFaqs(data.aiFaqs ?? []);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load event");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!event) return;
    document.title = `${event.title} · Planzo`;
    const description = event.description?.slice(0, 155) ?? "Discover local events on Planzo.";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [event]);

  if (loading) return <div className="card py-12 text-center text-surface-400">Loading…</div>;
  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>;
  if (!event) return <div className="card py-12 text-center text-surface-400">Event not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-surface-50 sm:text-3xl">{event.title}</h1>
          <p className="mt-1 text-surface-400">
            {event.venue_name}
            {event.venue_address ? ` • ${event.venue_address}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge">{event.category}</span>
            <span className="badge-brand">
              {new Date(event.starts_at).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              })}
            </span>
          </div>
        </div>
        <Link className="btn-secondary shrink-0" to="/">
          ← Back to search
        </Link>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-surface-50">About</h2>
        <p className="mt-3 whitespace-pre-wrap text-surface-300">{event.description || "No description."}</p>
        <p className="mt-4 text-sm text-surface-400">
          Hosted by{" "}
          <Link className="font-medium text-brand-400 hover:text-brand-300" to={`/organizers/${event.organizer_id}`}>
            {event.organizer_name}
          </Link>
        </p>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-surface-50">Share</h2>
        <p className="mt-1 text-sm text-surface-400">Invite friends or post to social.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={async () => {
              const url = `${API_BASE_URL}/share/event/${event.id}`;
              try {
                await navigator.clipboard.writeText(url);
                alert("Link copied!");
              } catch {
                alert(url);
              }
            }}
          >
            Copy link
          </button>
          <a className="btn-secondary" href={`${API_BASE_URL}/share/event/${event.id}`} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-semibold text-surface-50">Tickets</h2>
          {!auth.user ? (
            <Link className="text-sm font-medium text-brand-400 hover:text-brand-300" to="/login">
              Login to buy
            </Link>
          ) : null}
        </div>

        {tiers.length === 0 ? (
          <p className="mt-4 text-surface-400">No ticket tiers available.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tiers.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-3 rounded-xl border border-surface-700 bg-surface-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium text-surface-50">{t.name}</div>
                  <div className="mt-1 text-sm text-surface-400">
                    {centsToDollars(t.price_cents)} • {t.remaining_qty} left
                  </div>
                </div>
                <button
                  className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!auth.user || t.remaining_qty <= 0 || buyingTierId === t.id}
                  onClick={async () => {
                    if (!auth.user) return;
                    setBuyingTierId(t.id);
                    try {
                      const data = await auth.apiFetch<{ stripeCheckoutUrl: string }>(
                        "/checkout/create-session",
                        {
                          method: "POST",
                          body: JSON.stringify({ ticketTierId: t.id, quantity: 1 })
                        }
                      );
                      window.location.href = data.stripeCheckoutUrl;
                    } catch (err: any) {
                      setError(err?.message ?? "Checkout failed");
                    } finally {
                      setBuyingTierId(null);
                    }
                  }}
                >
                  {t.remaining_qty <= 0 ? "Sold out" : buyingTierId === t.id ? "Redirecting…" : "Buy ticket"}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-surface-500">
          Payments use Stripe test mode (configure STRIPE_SECRET_KEY + webhook to issue tickets).
        </p>
      </div>

      {aiFaqs.length > 0 ? (
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-surface-50">AI FAQs</h2>
            <span className="text-xs text-surface-500">Auto‑generated</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {aiFaqs.map((f, idx) => (
              <div key={`${f.q}-${idx}`} className="rounded-xl border border-surface-700 bg-surface-950/50 p-4">
                <div className="font-medium text-surface-200">{f.q}</div>
                <div className="mt-1 text-sm text-surface-400">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
