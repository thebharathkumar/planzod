import { EVENT_CATEGORIES } from "@planzo/shared";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function OrganizerEventNewPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof EVENT_CATEGORIES)[number]>("other");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [lat, setLat] = useState<number>(0);
  const [lng, setLng] = useState<number>(0);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [aiAgenda, setAiAgenda] = useState<{ time: string; item: string }[]>([]);
  const [aiFaqs, setAiFaqs] = useState<{ q: string; a: string }[]>([]);

  useEffect(() => {
    if (!auth.user) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 4000 }
    );
  }, [auth.user]);

  if (!auth.user) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
        Please <Link className="underline" to="/login">login</Link> to create events.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Create event</h1>
        <Link className="text-sm text-neutral-200 underline hover:text-white" to="/organizer">
          Back
        </Link>
      </div>

      {error ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div> : null}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">AI Event Studio</div>
            <div className="text-xs text-neutral-400">Instant copy, tags, agenda, and tier ideas.</div>
          </div>
          <button
            type="button"
            className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
            disabled={!auth.user || aiLoading}
            onClick={async () => {
              if (!title) {
                setError("Add a title first so AI can generate content.");
                return;
              }
              setAiLoading(true);
              setError(null);
              try {
                const copy = await auth.apiFetch<{
                  description: string;
                  tags: string[];
                  agenda: { time: string; item: string }[];
                  faqs: { q: string; a: string }[];
                  suggestedCategory: string;
                }>("/ai/event-copy", {
                  method: "POST",
                  body: JSON.stringify({
                    title,
                    category,
                    audience: "local attendees",
                    lengthMinutes: 120
                  })
                });
                setDescription(copy.description);
                if (EVENT_CATEGORIES.includes(copy.suggestedCategory as any)) {
                  setCategory(copy.suggestedCategory as any);
                }
                setAiTags(copy.tags ?? []);
                setAiAgenda(copy.agenda ?? []);
                setAiFaqs(copy.faqs ?? []);
              } catch (err: any) {
                setError(err?.message ?? "AI generation failed");
              } finally {
                setAiLoading(false);
              }
            }}
          >
            {aiLoading ? "Generating…" : "Generate AI content"}
          </button>
        </div>
        {aiTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-300">
            {aiTags.map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2 py-1">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <form
        className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          try {
            const payload = {
              title,
              description,
              category,
              startsAt: new Date(startsAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
              heroImageUrl: null,
              venue: {
                name: venueName,
                address: venueAddress,
                placeId: "",
                lat,
                lng
              }
            };
            const data = await auth.apiFetch<{ eventId: string }>("/events", {
              method: "POST",
              body: JSON.stringify(payload)
            });
            navigate(`/organizer/events/${data.eventId}/edit`);
          } catch (err: any) {
            setError(err?.message ?? "Failed to create event");
          } finally {
            setLoading(false);
          }
        }}
      >
        <label className="block text-sm">
          <div className="mb-1 text-neutral-200">Title</div>
          <input
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          <div className="mb-1 text-neutral-200">Category</div>
          <select
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <div className="mb-1 text-neutral-200">Starts</div>
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-neutral-200">Ends</div>
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="block text-sm">
          <div className="mb-1 text-neutral-200">Description</div>
          <textarea
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="border-t border-neutral-800 pt-4">
          <h2 className="text-lg font-semibold">Venue</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <div className="mb-1 text-neutral-200">Name</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <div className="mb-1 text-neutral-200">Address</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <div className="mb-1 text-neutral-200">Lat</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
                required
              />
            </label>
            <label className="block text-sm">
              <div className="mb-1 text-neutral-200">Lng</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                type="number"
                step="0.000001"
                value={lng}
                onChange={(e) => setLng(Number(e.target.value))}
                required
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create draft"}
        </button>
      </form>

      {(aiAgenda.length > 0 || aiFaqs.length > 0) && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <h2 className="text-lg font-semibold">AI suggestions</h2>
          {aiAgenda.length > 0 ? (
            <div className="mt-3">
              <div className="text-sm font-medium">Agenda</div>
              <ul className="mt-2 space-y-1 text-sm text-neutral-300">
                {aiAgenda.map((a, idx) => (
                  <li key={`${a.time}-${idx}`}>
                    <span className="text-neutral-400">{a.time}</span> — {a.item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {aiFaqs.length > 0 ? (
            <div className="mt-4">
              <div className="text-sm font-medium">FAQs</div>
              <ul className="mt-2 space-y-2 text-sm text-neutral-300">
                {aiFaqs.map((f, idx) => (
                  <li key={`${f.q}-${idx}`}>
                    <div className="font-semibold text-neutral-100">{f.q}</div>
                    <div className="text-neutral-300">{f.a}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
