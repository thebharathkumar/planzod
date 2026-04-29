import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE_URL } from "../lib/env";

type OrganizerPublic = {
  id: string;
  display_name: string;
  created_at: string;
};

type OrganizerEvent = {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  ends_at: string;
  hero_image_url: string | null;
  venue_name: string;
  venue_address: string | null;
};

export default function OrganizerPublicPage() {
  const { id } = useParams();
  const [organizer, setOrganizer] = useState<OrganizerPublic | null>(null);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [stats, setStats] = useState<{ avg_rating: number | null; review_count: number; verified: boolean } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/organizer/public/${id}`, { headers: { accept: "application/json" } });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Failed to load organizer");
        return;
      }
      setOrganizer(data.organizer);
      setEvents(data.events ?? []);
      setStats(data.stats ?? null);
    })();
  }, [id]);

  if (error) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>;
  }

  if (!organizer) {
    return <div className="card py-12 text-center text-surface-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="text-xs uppercase text-surface-400">Organizer</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {organizer.display_name}
          {stats?.verified ? (
            <span className="rounded-full bg-surface-800 px-2 py-1 text-xs text-surface-300">Verified</span>
          ) : null}
        </div>
        <div className="mt-1 text-xs text-surface-500">Since {new Date(organizer.created_at).toLocaleDateString()}</div>
        <div className="mt-2 text-sm text-surface-300">
          Rating: {stats?.avg_rating ? `${stats.avg_rating.toFixed(1)}★` : "New"} •{" "}
          {stats?.review_count ?? 0} reviews
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={async () => {
              const shareUrl = `${API_BASE_URL}/share/organizer/${organizer.id}`;
              try {
                await navigator.clipboard.writeText(shareUrl);
                setReviewMessage("Share link copied.");
              } catch {
                setReviewMessage(shareUrl);
              }
            }}
          >
            Copy share link
          </button>
          <a
            className="btn-secondary"
            href={`${API_BASE_URL}/share/organizer/${organizer.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Open share preview
          </a>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-surface-50">Upcoming events</h2>
        {events.length === 0 ? (
          <div className="mt-3 rounded-lg border border-surface-700 bg-surface-900/40 p-4 text-sm text-surface-300">
            No published events yet.
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {events.map((e) => (
              <li key={e.id} className="rounded-lg border border-surface-700 bg-surface-900/40 p-4">
                <Link to={`/events/${e.id}`} className="block text-base font-semibold hover:underline">
                  {e.title}
                </Link>
                <div className="mt-1 text-sm text-surface-300">
                  {e.venue_name}
                  {e.venue_address ? ` • ${e.venue_address}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-surface-300">
                  <span className="rounded-full bg-surface-800 px-2 py-1">{e.category}</span>
                  <span className="rounded-full bg-surface-800 px-2 py-1">{new Date(e.starts_at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-surface-700 bg-surface-900/40 p-4">
        <h2 className="font-display text-lg font-semibold text-surface-50">Leave a review</h2>
        <p className="mt-1 text-sm text-surface-300">
          You can review after attending (requires a ticket tied to the event).
        </p>
        {reviewMessage ? (
          <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            {reviewMessage}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <div className="mb-1 text-surface-200">Event</div>
            <select
              className="w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              <option value="">Select event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-surface-200">Rating</div>
            <select
              className="w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} ★
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-3">
            <div className="mb-1 text-surface-200">Comment</div>
            <textarea
              className="w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
        </div>
        <button
          className="btn-primary mt-3"
          onClick={async () => {
            if (!selectedEvent) {
              setReviewMessage("Select an event first.");
              return;
            }
            const res = await fetch(`${API_BASE_URL}/organizer/public/${id}/reviews`, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({ eventId: selectedEvent, rating, comment })
            });
            const data = await res.json();
            if (!res.ok) {
              setReviewMessage(data?.message ?? "Failed to submit review");
              return;
            }
            setReviewMessage("Review submitted. Thank you!");
          }}
        >
          Submit review
        </button>
      </div>
    </div>
  );
}
