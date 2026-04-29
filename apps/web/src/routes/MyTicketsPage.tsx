import QRCode from "react-qr-code";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Ticket = {
  id: string;
  status: string;
  orderStatus: string;
  qrPayload: string;
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    venueName: string;
    venueAddress: string | null;
  };
};

export default function MyTicketsPage() {
  const auth = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await auth.apiFetch<{ tickets: Ticket[] }>("/me/tickets");
        setTickets(data.tickets ?? []);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load tickets");
      } finally {
        setLoading(false);
      }
    })();
  }, [auth]);

  if (!auth.user) {
    return (
      <div className="card">
        <p className="text-surface-400">
          Please <Link className="font-medium text-brand-400 hover:text-brand-300" to="/login">login</Link> to view your tickets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-surface-50">My Tickets</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            setLoading(true);
            try {
              const data = await auth.apiFetch<{ tickets: Ticket[] }>("/me/tickets");
              setTickets(data.tickets ?? []);
            } finally {
              setLoading(false);
            }
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? <div className="text-surface-400">Loading…</div> : null}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      {tickets.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-surface-400">No tickets yet.</p>
          <Link className="btn-primary mt-4 inline-block" to="/">
            Explore events
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {tickets.map((t) => (
            <li key={t.id} className="card-hover">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/events/${t.event.id}`} className="block truncate text-base font-semibold text-surface-50 hover:text-brand-400">
                    {t.event.title}
                  </Link>
                  <p className="mt-1 text-sm text-surface-400">
                    {new Date(t.event.startsAt).toLocaleString()} • {t.event.venueName}
                  </p>
                  <p className="mt-2 text-xs text-surface-500">
                    Ticket: {t.status} • Order: {t.orderStatus}
                  </p>
                </div>
                <div className="rounded-xl border-2 border-surface-700 bg-white p-2">
                  <QRCode value={t.qrPayload} size={96} />
                </div>
              </div>
              <p className="mt-3 text-xs text-surface-500">Show this QR at check-in.</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
