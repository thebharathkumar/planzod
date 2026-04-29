import { EVENT_CATEGORIES } from "@planzo/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

type OrganizerEventDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  status: string;
  hero_image_url: string | null;
  lat: number;
  lng: number;
  venue_id: string;
  venue_name: string;
  venue_address: string | null;
  venue_place_id: string | null;
};

type TicketTier = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  total_qty: number;
  remaining_qty: number;
  sales_start: string;
  sales_end: string | null;
};

function toLocalDatetimeInput(valueIso: string) {
  const d = new Date(valueIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OrganizerEventEditPage() {
  const auth = useAuth();
  const { id } = useParams();
  const [event, setEvent] = useState<OrganizerEventDetail | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState(0);
  const [tierQty, setTierQty] = useState(10);
  const [titleVariants, setTitleVariants] = useState<string[]>([]);

  async function load() {
    if (!auth.user) return;
    setError(null);
    const data = await auth.apiFetch<{ event: OrganizerEventDetail; ticketTiers: TicketTier[] }>(`/organizer/events/${id}`);
    setEvent(data.event);
    setTiers(data.ticketTiers ?? []);
  }

  useEffect(() => {
    load().catch((err: any) => setError(err?.message ?? "Failed to load event"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id, id]);

  if (!auth.user) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
        Please <Link className="underline" to="/login">login</Link> to edit events.
      </div>
    );
  }

  if (!event) {
    return error ? (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div>
    ) : (
      <div className="text-sm text-neutral-300">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit event</h1>
          <div className="mt-1 text-sm text-neutral-300">
            Status: <span className="text-neutral-100">{event.status}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm hover:bg-neutral-800/60" to="/organizer">
            Back
          </Link>
          {event.status === "published" ? (
            <Link className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15" to={`/events/${event.id}`}>
              View public
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div> : null}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">AI Event Studio</div>
            <div className="text-xs text-neutral-400">Rewrite description + generate tags and tier ideas.</div>
          </div>
          <button
            type="button"
            className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
            disabled={aiLoading}
            onClick={async () => {
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
                    title: event.title,
                    category: event.category,
                    audience: "local attendees",
                    lengthMinutes: 120
                  })
                });
                setEvent({ ...event, description: copy.description, category: copy.suggestedCategory as any });

                const tiers = await auth.apiFetch<{ tiers: { name: string; priceCents: number; qty: number }[] }>(
                  "/ai/ticket-tiers",
                  {
                    method: "POST",
                    body: JSON.stringify({ seed: event.title })
                  }
                );
                if (tiers.tiers?.[0]) {
                  setTierName(tiers.tiers[0].name);
                  setTierPrice(tiers.tiers[0].priceCents / 100);
                  setTierQty(tiers.tiers[0].qty);
                }

                const rewrites = await auth.apiFetch<{ variants: string[] }>("/ai/event-title-rewrite", {
                  method: "POST",
                  body: JSON.stringify({ title: event.title, vibe: "Premium" })
                });
                setTitleVariants(rewrites.variants ?? []);
              } catch (err: any) {
                setError(err?.message ?? "AI generation failed");
              } finally {
                setAiLoading(false);
              }
            }}
          >
            {aiLoading ? "Generating…" : "Generate AI ideas"}
          </button>
        </div>
        {titleVariants.length > 0 ? (
          <div className="mt-3">
            <div className="text-xs text-neutral-400">Title suggestions</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {titleVariants.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/15"
                  onClick={() => setEvent({ ...event, title: t })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <form
        className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError(null);
          try {
            const payload = {
              title: event.title,
              description: event.description,
              category: event.category,
              startsAt: new Date(event.starts_at).toISOString(),
              endsAt: new Date(event.ends_at).toISOString(),
              heroImageUrl: event.hero_image_url,
              venue: {
                name: event.venue_name,
                address: event.venue_address ?? "",
                placeId: event.venue_place_id ?? "",
                lat: event.lat,
                lng: event.lng
              }
            };
            await auth.apiFetch(`/events/${event.id}`, { method: "PUT", body: JSON.stringify(payload) });
            await load();
          } catch (err: any) {
            setError(err?.message ?? "Failed to save event");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <div className="mb-1 text-neutral-200">Title</div>
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              value={event.title}
              onChange={(e) => setEvent({ ...event, title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-neutral-200">Category</div>
            <select
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              value={event.category}
              onChange={(e) => setEvent({ ...event, category: e.target.value })}
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-neutral-200">Starts</div>
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              type="datetime-local"
              value={toLocalDatetimeInput(event.starts_at)}
              onChange={(e) => setEvent({ ...event, starts_at: new Date(e.target.value).toISOString() })}
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-neutral-200">Ends</div>
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              type="datetime-local"
              value={toLocalDatetimeInput(event.ends_at)}
              onChange={(e) => setEvent({ ...event, ends_at: new Date(e.target.value).toISOString() })}
            />
          </label>
        </div>

        <label className="block text-sm">
          <div className="mb-1 text-neutral-200">Description</div>
          <textarea
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
            rows={5}
            value={event.description}
            onChange={(e) => setEvent({ ...event, description: e.target.value })}
          />
        </label>

        <div className="border-t border-neutral-800 pt-4">
          <h2 className="text-lg font-semibold">Venue</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <div className="mb-1 text-neutral-200">Name</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                value={event.venue_name}
                onChange={(e) => setEvent({ ...event, venue_name: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <div className="mb-1 text-neutral-200">Address</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                value={event.venue_address ?? ""}
                onChange={(e) => setEvent({ ...event, venue_address: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <div className="mb-1 text-neutral-200">Lat</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                type="number"
                step="0.000001"
                value={event.lat}
                onChange={(e) => setEvent({ ...event, lat: Number(e.target.value) })}
              />
            </label>
            <label className="block text-sm">
              <div className="mb-1 text-neutral-200">Lng</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                type="number"
                step="0.000001"
                value={event.lng}
                onChange={(e) => setEvent({ ...event, lng: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ticket tiers</h2>
          <div className="text-xs text-neutral-400">{tiers.length} tiers</div>
        </div>

        <ul className="mt-3 space-y-2">
          {tiers.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{t.name}</div>
                <div className="mt-1 text-xs text-neutral-400">
                  ${(t.price_cents / 100).toFixed(2)} • {t.remaining_qty}/{t.total_qty} remaining
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm hover:bg-neutral-800/60"
                onClick={async () => {
                  if (!confirm("Delete this tier?")) return;
                  await auth.apiFetch(`/ticket-tiers/${t.id}`, { method: "DELETE" });
                  await load();
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await auth.apiFetch(`/events/${event.id}/ticket-tiers`, {
                method: "POST",
                body: JSON.stringify({
                  name: tierName,
                  priceCents: Math.round(tierPrice * 100),
                  currency: "usd",
                  totalQty: tierQty
                })
              });
              setTierName("");
              setTierPrice(0);
              setTierQty(10);
              await load();
            } catch (err: any) {
              setError(err?.message ?? "Failed to create tier");
            }
          }}
        >
          <label className="block text-sm sm:col-span-3">
            <div className="mb-1 text-neutral-200">Name</div>
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              value={tierName}
              onChange={(e) => setTierName(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm sm:col-span-1">
            <div className="mb-1 text-neutral-200">Price ($)</div>
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              type="number"
              step="0.01"
              min="0"
              value={tierPrice}
              onChange={(e) => setTierPrice(Number(e.target.value))}
              required
            />
          </label>
          <label className="block text-sm sm:col-span-1">
            <div className="mb-1 text-neutral-200">Qty</div>
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              type="number"
              min="0"
              value={tierQty}
              onChange={(e) => setTierQty(Number(e.target.value))}
              required
            />
          </label>
          <div className="sm:col-span-1 sm:pt-6">
            <button className="w-full rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15" type="submit">
              Add
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {event.status === "draft" ? (
            <button
              type="button"
              className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
              onClick={async () => {
                setError(null);
                try {
                  await auth.apiFetch(`/events/${event.id}/publish`, { method: "POST" });
                  await load();
                } catch (err: any) {
                  setError(err?.message ?? "Publish failed");
                }
              }}
            >
              Publish
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm hover:bg-neutral-800/60"
            onClick={async () => {
              setError(null);
              try {
                await auth.apiFetch(`/events/${event.id}/cancel`, { method: "POST" });
                await load();
              } catch (err: any) {
                setError(err?.message ?? "Cancel failed");
              }
            }}
          >
            Cancel event
          </button>
        </div>
      </div>
    </div>
  );
}
