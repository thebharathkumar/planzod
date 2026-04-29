import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Organizer = {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
} | null;

type OrganizerEvent = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
  category: string;
  venue_name: string;
};

type OrganizerMetrics = {
  events_count: number;
  tickets_sold: number;
  revenue_cents: number;
  checkins: number;
  avg_ticket_price_cents: number;
  avg_rating?: number | null;
  review_count?: number | null;
};

export default function OrganizerDashboardPage() {
  const auth = useAuth();
  const [organizer, setOrganizer] = useState<Organizer>(null);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [metrics, setMetrics] = useState<OrganizerMetrics | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!auth.user) return;
    setLoading(true);
    setError(null);
    try {
      const org = await auth.apiFetch<{ organizer: Organizer }>("/organizer/me");
      setOrganizer(org.organizer);
      if (org.organizer) {
        const ev = await auth.apiFetch<{ events: OrganizerEvent[] }>("/organizer/events");
        setEvents(ev.events ?? []);
        const met = await auth.apiFetch<{ metrics: OrganizerMetrics }>("/organizer/metrics");
        setMetrics(met.metrics);
      } else {
        setEvents([]);
        setMetrics(null);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load organizer dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  if (!auth.user) {
    return (
      <div className="card">
        <p className="text-surface-400">
          Please <Link className="font-medium text-brand-400 hover:text-brand-300" to="/login">login</Link> to access organizer tools.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-surface-50">Organizer</h1>
        <div className="flex gap-2">
          <Link className="btn-primary" to="/organizer/events/new">
            Create event
          </Link>
          <button type="button" className="btn-secondary" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-surface-500">Events</div>
          <div className="mt-2 font-display text-3xl font-bold text-brand-400">{metrics?.events_count ?? events.length}</div>
          <div className="text-sm text-surface-500">Published + draft</div>
        </div>
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-surface-500">Tickets Sold</div>
          <div className="mt-2 font-display text-3xl font-bold text-brand-400">{metrics?.tickets_sold ?? 0}</div>
          <div className="text-sm text-surface-500">Avg ${((metrics?.avg_ticket_price_cents ?? 0) / 100).toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-surface-500">Check-ins</div>
          <div className="mt-2 font-display text-3xl font-bold text-brand-400">{metrics?.checkins ?? 0}</div>
          <div className="text-sm text-surface-500">Revenue ${((metrics?.revenue_cents ?? 0) / 100).toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-surface-50">Organizer reputation</h2>
          <span className="text-sm text-surface-500">{metrics?.review_count ?? 0} reviews</span>
        </div>
        <div className="mt-2 font-display text-2xl font-bold text-brand-400">
          {metrics?.avg_rating ? `${metrics.avg_rating.toFixed(1)}★` : "New"}
        </div>
        <p className="mt-1 text-sm text-surface-500">Reviews appear on your public profile.</p>
      </div>

      {loading ? <div className="text-surface-400">Loading…</div> : null}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      {!organizer ? (
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-surface-50">Create organizer profile</h2>
          <p className="mt-1 text-surface-400">This enables event creation and check-in scanning.</p>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await auth.apiFetch("/organizer/profile", {
                  method: "POST",
                  body: JSON.stringify({ displayName })
                });
                await load();
              } catch (err: any) {
                setError(err?.message ?? "Failed to create organizer");
              }
            }}
          >
            <input
              className="input flex-1"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button className="btn-primary shrink-0" type="submit">
              Save
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-surface-400">
            Signed in as <span className="font-medium text-surface-200">{organizer.display_name}</span>
          </p>

          {events.length === 0 ? (
            <div className="card py-12 text-center">
              <p className="text-surface-400">No events yet. Create one to get started.</p>
              <Link className="btn-primary mt-4 inline-block" to="/organizer/events/new">
                Create event
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="card-hover">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-surface-50">{e.title}</div>
                      <div className="mt-1 text-sm text-surface-400">
                        {e.venue_name} • {new Date(e.starts_at).toLocaleString()}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge">{e.status}</span>
                        <span className="badge">{e.category}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link className="btn-primary" to={`/organizer/events/${e.id}/edit`}>
                        Edit
                      </Link>
                      {e.status === "published" ? (
                        <Link className="btn-secondary" to={`/events/${e.id}`}>
                          View
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
