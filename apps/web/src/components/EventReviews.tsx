import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { API_BASE_URL } from "../lib/env";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  author_name: string;
};

export default function EventReviews({ eventId }: { eventId: string }) {
  const auth = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{
    avg_rating: number | null;
    review_count: number;
  } | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [eventId]);

  async function refresh() {
    const r = await fetch(`${API_BASE_URL}/events/${eventId}/reviews`).then(
      (x) => x.json(),
    );
    setReviews(r.reviews);
    setSummary(r.summary);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    try {
      await auth.apiFetch(`/events/${eventId}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          rating,
          title: title || undefined,
          comment: comment || undefined,
        }),
      });
      setInfo("Thanks — your review was posted.");
      setShowForm(false);
      setTitle("");
      setComment("");
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-surface-50">
          Reviews
        </h2>
        <div className="text-sm text-surface-400">
          {summary?.avg_rating
            ? `★ ${Number(summary.avg_rating).toFixed(1)} (${summary.review_count})`
            : "No reviews yet"}
        </div>
      </div>

      {auth.user && (
        <div className="mt-3">
          {!showForm ? (
            <button
              className="btn-ghost text-sm"
              onClick={() => setShowForm(true)}
            >
              Write a review
            </button>
          ) : (
            <form
              onSubmit={submit}
              className="mt-2 space-y-2 rounded border border-surface-700 bg-surface-900/40 p-3"
            >
              <select
                className="input"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
              />
              <textarea
                className="input"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell other attendees about it…"
              />
              <div className="flex gap-2">
                <button className="btn-primary text-sm" type="submit">
                  Post review
                </button>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
          {info && <p className="mt-2 text-sm text-emerald-300">{info}</p>}
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="border-t border-surface-800/50 pt-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.author_name}</span>
              <span className="text-amber-300">
                {"★".repeat(r.rating)}
                <span className="text-surface-700">
                  {"★".repeat(5 - r.rating)}
                </span>
              </span>
            </div>
            {r.title && (
              <p className="mt-1 font-medium text-surface-100">{r.title}</p>
            )}
            {r.comment && (
              <p className="mt-1 text-sm text-surface-300">{r.comment}</p>
            )}
            <p className="mt-1 text-xs text-surface-500">
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </li>
        ))}
        {reviews.length === 0 && (
          <li className="text-surface-400 text-sm">
            No reviews yet — be the first.
          </li>
        )}
      </ul>
    </div>
  );
}
