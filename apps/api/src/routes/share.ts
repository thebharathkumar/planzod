import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { env } from "../env";

const router = Router();

router.get("/organizer/:id", async (req, res) => {
  const organizerId = z.string().uuid().parse(req.params.id);
  const orgRes = await pool.query<{ display_name: string }>(
    "SELECT display_name FROM organizers WHERE id = $1",
    [organizerId]
  );
  const organizer = orgRes.rows[0];
  if (!organizer) return res.status(404).send("Organizer not found");

  const imageUrl = `${env.WEB_BASE_URL}/share/organizers/${organizerId}.svg`;
  const pageUrl = `${env.WEB_BASE_URL}/organizers/${organizerId}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${organizer.display_name} · Planzo</title>
    <meta property="og:title" content="${organizer.display_name} · Planzo" />
    <meta property="og:description" content="Discover workshops, classes, and local events from ${organizer.display_name}." />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${organizer.display_name} · Planzo" />
    <meta name="twitter:description" content="Discover workshops, classes, and local events from ${organizer.display_name}." />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta http-equiv="refresh" content="0; url=${pageUrl}" />
  </head>
  <body>Redirecting…</body>
</html>`;

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(html);
});

router.get("/event/:id", async (req, res) => {
  const eventId = z.string().uuid().parse(req.params.id);
  const eventRes = await pool.query<{ title: string }>(
    "SELECT title FROM events WHERE id = $1",
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event) return res.status(404).send("Event not found");

  const imageUrl = `${env.WEB_BASE_URL}/share/events/${eventId}.svg`;
  const pageUrl = `${env.WEB_BASE_URL}/events/${eventId}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${event.title} · Planzo</title>
    <meta property="og:title" content="${event.title} · Planzo" />
    <meta property="og:description" content="Discover workshops and classes on Planzo." />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${event.title} · Planzo" />
    <meta name="twitter:description" content="Discover workshops and classes on Planzo." />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta http-equiv="refresh" content="0; url=${pageUrl}" />
  </head>
  <body>Redirecting…</body>
</html>`;

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(html);
});

router.get("/organizers/:id.svg", async (req, res) => {
  const organizerId = z.string().uuid().parse(req.params.id);
  const orgRes = await pool.query<{ display_name: string }>(
    "SELECT display_name FROM organizers WHERE id = $1",
    [organizerId]
  );
  const organizer = orgRes.rows[0];
  if (!organizer) return res.status(404).send("Organizer not found");

  const title = organizer.display_name.replace(/</g, "").slice(0, 48);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0b12"/>
      <stop offset="100%" stop-color="#101728"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="510" rx="28" fill="#0f172a" stroke="#1f2937"/>
  <text x="120" y="190" font-size="28" fill="#94a3b8" font-family="Inter, system-ui, sans-serif">Planzo · Workshops & Classes</text>
  <text x="120" y="270" font-size="54" fill="#e5e7eb" font-family="Inter, system-ui, sans-serif">${title}</text>
  <text x="120" y="340" font-size="28" fill="#94a3b8" font-family="Inter, system-ui, sans-serif">Organizer profile</text>
  <text x="120" y="420" font-size="24" fill="#94a3b8" font-family="Inter, system-ui, sans-serif">Discover local events powered by Planzo.</text>
</svg>`;

  res.setHeader("content-type", "image/svg+xml");
  res.send(svg);
});

router.get("/events/:id.svg", async (req, res) => {
  const eventId = z.string().uuid().parse(req.params.id);
  const eventRes = await pool.query<{
    title: string;
    starts_at: string;
    venue_name: string;
    organizer_name: string;
    organizer_id: string;
    verified: boolean;
    hero_image_url: string | null;
  }>(
    `
      WITH paid_orders AS (
        SELECT 1
        FROM orders o
        WHERE o.status = 'paid'
          AND o.event_id = $1
        LIMIT 1
      )
      SELECT
        e.title,
        e.starts_at,
        v.name AS venue_name,
        o.display_name AS organizer_name,
        o.id AS organizer_id,
        EXISTS (SELECT 1 FROM paid_orders) AS verified,
        e.hero_image_url
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      JOIN organizers o ON o.id = e.organizer_id
      WHERE e.id = $1
    `,
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event) return res.status(404).send("Event not found");

  const title = event.title.replace(/</g, "").slice(0, 56);
  const date = new Date(event.starts_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  const venue = event.venue_name.replace(/</g, "").slice(0, 48);
  const organizer = event.organizer_name.replace(/</g, "").slice(0, 40);
  const badge = event.verified ? "Verified organizer" : "Organizer";
  const imageLayer = event.hero_image_url
    ? `<image href="${event.hero_image_url}" x="60" y="60" width="1080" height="510" preserveAspectRatio="xMidYMid slice" opacity="0.22"/>`
    : "";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0b12"/>
      <stop offset="100%" stop-color="#101728"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="510" rx="28" fill="#0f172a" stroke="#1f2937"/>
  ${imageLayer}
  <rect x="60" y="60" width="1080" height="510" rx="28" fill="rgba(15,23,42,0.7)"/>
  <text x="120" y="190" font-size="28" fill="#94a3b8" font-family="Inter, system-ui, sans-serif">Planzo · Workshops & Classes</text>
  <text x="120" y="270" font-size="54" fill="#e5e7eb" font-family="Inter, system-ui, sans-serif">${title}</text>
  <text x="120" y="330" font-size="28" fill="#94a3b8" font-family="Inter, system-ui, sans-serif">${date} • ${venue}</text>
  <text x="120" y="380" font-size="24" fill="#94a3b8" font-family="Inter, system-ui, sans-serif">${badge} · ${organizer}</text>
  <text x="120" y="420" font-size="24" fill="#94a3b8" font-family="Inter, system-ui, sans-serif">Reserve your seat on Planzo.</text>
</svg>`;

  res.setHeader("content-type", "image/svg+xml");
  res.send(svg);
});

export default router;
