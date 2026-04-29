import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

type RecEvent = {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  hero_image_url: string | null;
  venue_name: string;
};

export default function Recommendations() {
  const auth = useAuth();
  const [events, setEvents] = useState<RecEvent[]>([]);

  useEffect(() => {
    if (!auth.user) return;
    auth
      .apiFetch<{ events: RecEvent[] }>("/recommendations?limit=6")
      .then((r) => setEvents(r.events))
      .catch(() => {});
  }, [auth.user]);

  if (!auth.user || events.length === 0) return null;

  return (
    <section className="card">
      <h2 className="font-display text-lg font-semibold text-surface-50">
        Recommended for you
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link
            key={e.id}
            to={`/events/${e.id}`}
            className="block rounded-lg border border-surface-800 bg-surface-900/40 p-3 hover:border-brand-500/40"
          >
            <p className="font-medium text-surface-100">{e.title}</p>
            <p className="mt-1 text-xs text-surface-400">
              {e.category} · {new Date(e.starts_at).toLocaleDateString()} ·{" "}
              {e.venue_name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
