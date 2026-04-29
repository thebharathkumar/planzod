import { useEffect, useState } from "react";
import { API_BASE_URL } from "../lib/env";

type Preview = {
  subject: string;
  html: string;
};

async function fetchPreview(type: string) {
  const res = await fetch(`${API_BASE_URL}/emails/preview`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ type })
  });
  if (!res.ok) throw new Error("Failed to load preview");
  return (await res.json()) as Preview;
}

export default function EmailPreviewsPage() {
  const [order, setOrder] = useState<Preview | null>(null);
  const [organizer, setOrganizer] = useState<Preview | null>(null);
  const [welcome, setWelcome] = useState<Preview | null>(null);
  const [reward, setReward] = useState<Preview | null>(null);

  useEffect(() => {
    fetchPreview("order").then(setOrder);
    fetchPreview("organizer").then(setOrganizer);
    fetchPreview("waitlist_welcome").then(setWelcome);
    fetchPreview("waitlist_reward").then(setReward);
  }, []);

  const cards = [
    { title: "Order confirmation", data: order },
    { title: "Organizer summary", data: organizer },
    { title: "Waitlist welcome", data: welcome },
    { title: "Waitlist reward", data: reward }
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
        <div className="text-xs uppercase text-neutral-400">Email templates</div>
        <h1 className="mt-2 text-3xl font-semibold">Previews</h1>
        <p className="mt-2 text-sm text-neutral-300">Rendered templates for the product launch.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold">{card.title}</div>
            <div className="mt-2 text-xs text-neutral-400">{card.data?.subject ?? "Loading…"}</div>
            <div
              className="mt-3 rounded-md border border-neutral-800 bg-white p-3 text-sm text-neutral-900"
              dangerouslySetInnerHTML={{ __html: card.data?.html ?? "<div>Loading…</div>" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

