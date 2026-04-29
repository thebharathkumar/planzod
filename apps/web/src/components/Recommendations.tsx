import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecommendedEvents } from "../lib/api";

type RecEvent = {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  hero_image_url: string | null;
  venue_name: string;
};

export default function Recommendations() {
  const [events, setEvents] = useState<RecEvent[]>([]);

  useEffect(() => {
    getRecommendedEvents()
      .then((r) => setEvents(r.events))
      .catch(() => {});
  }, []);

  if (events.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 font-display text-2xl">🔥 Trending nearby</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.slice(0, 6).map((e) => (
          <Link
            key={e.id}
            to={`/events/${e.id}`}
            className="card-hover overflow-hidden p-0"
          >
            {e.hero_image_url && (
              <div
                className="h-32 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${e.hero_image_url})` }}
              />
            )}
            <div className="p-3">
              <span className="badge">{e.category}</span>
              <p className="mt-2 font-medium text-surface-100">{e.title}</p>
              <p className="mt-1 text-xs text-surface-400">
                {new Date(e.starts_at).toLocaleDateString()} · {e.venue_name}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
