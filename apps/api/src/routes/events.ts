import { Router } from "express";
import { z } from "zod";
import { EVENT_CATEGORIES } from "@planzo/shared";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../utils/http";
import { requireOrganizerId } from "./organizer";
import { generateEventCopy, suggestCategoryFromText } from "../ai/generator";

const router = Router();

const venueSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().max(240).optional().default(""),
  placeId: z.string().max(200).optional().default(""),
  lat: z.number().finite(),
  lng: z.number().finite()
});

const eventSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(10_000).optional().default(""),
  category: z.enum(EVENT_CATEGORIES).default("other"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  heroImageUrl: z.string().url().optional().nullable().default(null),
  venue: venueSchema
});

async function upsertVenue(venue: z.infer<typeof venueSchema>): Promise<{ id: string; lat: number; lng: number }> {
  const placeId = venue.placeId?.trim() || null;
  if (placeId) {
    const { rows } = await pool.query<{ id: string; lat: number; lng: number }>(
      `
        INSERT INTO venues(name, address, place_id, lat, lng)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (place_id) DO UPDATE
        SET name = EXCLUDED.name,
            address = EXCLUDED.address,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng
        RETURNING id, lat, lng
      `,
      [venue.name, venue.address ?? "", placeId, venue.lat, venue.lng]
    );
    return rows[0];
  }

  const { rows } = await pool.query<{ id: string; lat: number; lng: number }>(
    "INSERT INTO venues(name, address, place_id, lat, lng) VALUES ($1, $2, NULL, $3, $4) RETURNING id, lat, lng",
    [venue.name, venue.address ?? "", venue.lat, venue.lng]
  );
  return rows[0];
}

router.post("/", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const body = eventSchema.parse(req.body);

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!(endsAt > startsAt)) throw new HttpError(400, "endsAt must be after startsAt");

  await pool.query("BEGIN");
  try {
    const venue = await upsertVenue(body.venue);
    const { rows } = await pool.query<{ id: string }>(
      `
        INSERT INTO events(
          organizer_id, venue_id, title, description, category, starts_at, ends_at,
          status, hero_image_url, lat, lng
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10)
        RETURNING id
      `,
      [
        organizerId,
        venue.id,
        body.title,
        body.description ?? "",
        body.category,
        startsAt.toISOString(),
        endsAt.toISOString(),
        body.heroImageUrl,
        venue.lat,
        venue.lng
      ]
    );
    const eventId = rows[0].id;

    await pool.query(
      "INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, metadata_json) VALUES ($1,$2,$3,$4,$5)",
      [userId, "event.create", "event", eventId, JSON.stringify({ title: body.title })]
    );

    await pool.query("COMMIT");
    res.status(201).json({ eventId });
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
});

router.put("/:id", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const eventId = z.string().uuid().parse(req.params.id);
  const body = eventSchema.parse(req.body);

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!(endsAt > startsAt)) throw new HttpError(400, "endsAt must be after startsAt");

  await pool.query("BEGIN");
  try {
    const ownership = await pool.query<{ id: string }>(
      "SELECT id FROM events WHERE id = $1 AND organizer_id = $2",
      [eventId, organizerId]
    );
    if (!ownership.rows[0]) throw new HttpError(404, "Event not found");

    const venue = await upsertVenue(body.venue);

    await pool.query(
      `
        UPDATE events
        SET venue_id = $1,
            title = $2,
            description = $3,
            category = $4,
            starts_at = $5,
            ends_at = $6,
            hero_image_url = $7,
            lat = $8,
            lng = $9
        WHERE id = $10
      `,
      [
        venue.id,
        body.title,
        body.description ?? "",
        body.category,
        startsAt.toISOString(),
        endsAt.toISOString(),
        body.heroImageUrl,
        venue.lat,
        venue.lng,
        eventId
      ]
    );

    await pool.query(
      "INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, metadata_json) VALUES ($1,$2,$3,$4,$5)",
      [userId, "event.update", "event", eventId, JSON.stringify({ title: body.title })]
    );

    await pool.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
});

router.post("/:id/publish", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const eventId = z.string().uuid().parse(req.params.id);

  const { rowCount: tiers } = await pool.query("SELECT 1 FROM ticket_tiers WHERE event_id = $1 LIMIT 1", [eventId]);
  if (!tiers) throw new HttpError(400, "Add at least one ticket tier before publishing");

  const eventRes = await pool.query<{ title: string; description: string; category: string }>(
    "SELECT title, description, category FROM events WHERE id = $1 AND organizer_id = $2",
    [eventId, organizerId]
  );
  const event = eventRes.rows[0];
  if (!event) throw new HttpError(404, "Event not found");

  const nextCategory =
    event.category === "other"
      ? suggestCategoryFromText(`${event.title} ${event.description}`)
      : event.category;

  const { rowCount } = await pool.query(
    "UPDATE events SET status = 'published', category = $3 WHERE id = $1 AND organizer_id = $2 AND status = 'draft'",
    [eventId, organizerId, nextCategory]
  );
  if (!rowCount) throw new HttpError(404, "Event not found (or already published)");

  await pool.query(
    "INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, metadata_json) VALUES ($1,$2,$3,$4,$5)",
    [userId, "event.publish", "event", eventId, JSON.stringify({})]
  );

  res.json({ ok: true });
});

router.post("/:id/cancel", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const eventId = z.string().uuid().parse(req.params.id);

  const { rowCount } = await pool.query(
    "UPDATE events SET status = 'cancelled' WHERE id = $1 AND organizer_id = $2",
    [eventId, organizerId]
  );
  if (!rowCount) throw new HttpError(404, "Event not found");

  await pool.query(
    "INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, metadata_json) VALUES ($1,$2,$3,$4,$5)",
    [userId, "event.cancel", "event", eventId, JSON.stringify({})]
  );

  res.json({ ok: true });
});

router.get("/:id", async (req, res) => {
  const eventId = z.string().uuid().parse(req.params.id);
  const { rows } = await pool.query(
    `
      SELECT
        e.id,
        e.title,
        e.description,
        e.category,
        e.starts_at,
        e.ends_at,
        e.status,
        e.hero_image_url,
        e.lat,
        e.lng,
        e.organizer_id,
        v.id AS venue_id,
        v.name AS venue_name,
        v.address AS venue_address,
        o.display_name AS organizer_name
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      JOIN organizers o ON o.id = e.organizer_id
      WHERE e.id = $1 AND e.status = 'published'
    `,
    [eventId]
  );
  const event = rows[0];
  if (!event) throw new HttpError(404, "Event not found");

  const tiers = await pool.query(
    `
      SELECT id, name, price_cents, currency, remaining_qty, sales_start, sales_end
      FROM ticket_tiers
      WHERE event_id = $1
      ORDER BY price_cents ASC, name ASC
    `,
    [eventId]
  );

  const ai = generateEventCopy({
    title: event.title,
    category: event.category,
    audience: "attendees",
    seed: eventId
  });

  res.json({ event, ticketTiers: tiers.rows, aiFaqs: ai.faqs });
});

export default router;
