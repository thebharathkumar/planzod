import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../utils/http";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query<{ id: string; user_id: string; display_name: string; created_at: string }>(
    "SELECT id, user_id, display_name, created_at FROM organizers WHERE user_id = $1",
    [userId]
  );
  res.json({ organizer: rows[0] ?? null });
});

const profileSchema = z.object({
  displayName: z.string().min(2).max(80)
});

router.post("/profile", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const body = profileSchema.parse(req.body);

  await pool.query("BEGIN");
  try {
    const existing = await pool.query<{ id: string }>("SELECT id FROM organizers WHERE user_id = $1", [userId]);
    let organizerId: string;

    if (existing.rows[0]?.id) {
      organizerId = existing.rows[0].id;
      await pool.query("UPDATE organizers SET display_name = $1 WHERE id = $2", [body.displayName, organizerId]);
    } else {
      const { rows } = await pool.query<{ id: string }>(
        "INSERT INTO organizers(user_id, display_name) VALUES ($1, $2) RETURNING id",
        [userId, body.displayName]
      );
      organizerId = rows[0].id;
    }

    await pool.query("UPDATE users SET role = 'organizer' WHERE id = $1", [userId]);
    await pool.query(
      "INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, metadata_json) VALUES ($1, $2, $3, $4, $5)",
      [userId, "organizer.profile.upsert", "organizer", organizerId, JSON.stringify({ displayName: body.displayName })]
    );

    await pool.query("COMMIT");
    res.status(201).json({ organizer: { id: organizerId, userId, displayName: body.displayName } });
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
});

router.get("/events", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);

  const { rows } = await pool.query(
    `
      SELECT
        e.id,
        e.title,
        e.status,
        e.starts_at,
        e.ends_at,
        e.category,
        e.hero_image_url,
        v.name AS venue_name
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      WHERE e.organizer_id = $1
      ORDER BY e.created_at DESC
      LIMIT 100
    `,
    [organizerId]
  );

  res.json({ events: rows });
});

router.get("/events/:eventId", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const eventId = z.string().uuid().parse(req.params.eventId);

  const eventRes = await pool.query(
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
        v.id AS venue_id,
        v.name AS venue_name,
        v.address AS venue_address,
        v.place_id AS venue_place_id
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      WHERE e.id = $1 AND e.organizer_id = $2
    `,
    [eventId, organizerId]
  );
  const event = eventRes.rows[0];
  if (!event) throw new HttpError(404, "Event not found");

  const tiers = await pool.query(
    `
      SELECT id, name, price_cents, currency, total_qty, remaining_qty, sales_start, sales_end
      FROM ticket_tiers
      WHERE event_id = $1
      ORDER BY price_cents ASC, name ASC
    `,
    [eventId]
  );

  res.json({ event, ticketTiers: tiers.rows });
});

router.get("/public/:organizerId", async (req, res) => {
  const organizerId = z.string().uuid().parse(req.params.organizerId);
  const orgRes = await pool.query<{ id: string; display_name: string; created_at: string }>(
    "SELECT id, display_name, created_at FROM organizers WHERE id = $1",
    [organizerId]
  );
  const organizer = orgRes.rows[0];
  if (!organizer) throw new HttpError(404, "Organizer not found");

  const ratingRes = await pool.query<{
    avg_rating: number | null;
    review_count: number;
    verified: boolean;
  }>(
    `
      WITH paid_orders AS (
        SELECT 1
        FROM orders o
        WHERE o.status = 'paid'
          AND o.event_id IN (SELECT id FROM events WHERE organizer_id = $1)
        LIMIT 1
      )
      SELECT
        AVG(r.rating)::float AS avg_rating,
        COUNT(r.id)::int AS review_count,
        EXISTS (SELECT 1 FROM paid_orders) AS verified
      FROM organizer_reviews r
      WHERE r.organizer_id = $1
    `,
    [organizerId]
  );

  const eventsRes = await pool.query(
    `
      SELECT
        e.id,
        e.title,
        e.category,
        e.starts_at,
        e.ends_at,
        e.hero_image_url,
        v.name AS venue_name,
        v.address AS venue_address
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      WHERE e.organizer_id = $1 AND e.status = 'published'
      ORDER BY e.starts_at ASC
      LIMIT 50
    `,
    [organizerId]
  );

  res.json({
    organizer,
    stats: ratingRes.rows[0] ?? { avg_rating: null, review_count: 0, verified: false },
    events: eventsRes.rows
  });
});

const reviewSchema = z.object({
  eventId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional()
});

router.post("/public/:organizerId/reviews", requireAuth, async (req, res) => {
  const organizerId = z.string().uuid().parse(req.params.organizerId);
  const body = reviewSchema.parse(req.body);
  const userId = req.user!.id;

  const eligible = await pool.query(
    `
      SELECT 1
      FROM tickets t
      JOIN events e ON e.id = t.event_id
      WHERE t.user_id = $1
        AND t.event_id = $2
        AND e.organizer_id = $3
        AND t.status = 'issued'
      LIMIT 1
    `,
    [userId, body.eventId, organizerId]
  );
  if (eligible.rowCount !== 1) throw new HttpError(403, "Only attendees can review this organizer");

  try {
    await pool.query(
      `
        INSERT INTO organizer_reviews(organizer_id, event_id, user_id, rating, comment)
        VALUES ($1,$2,$3,$4,$5)
      `,
      [organizerId, body.eventId, userId, body.rating, body.comment ?? null]
    );
  } catch (err: any) {
    if (err?.code === "23505") throw new HttpError(409, "Review already submitted");
    throw err;
  }

  res.status(201).json({ ok: true });
});

router.get("/metrics", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);

  const { rows } = await pool.query<{
    events_count: number;
    tickets_sold: number | null;
    revenue_cents: number | null;
    checkins: number | null;
    avg_rating: number | null;
    review_count: number | null;
  }>(
    `
      WITH organizer_events AS (
        SELECT id FROM events WHERE organizer_id = $1
      ),
      paid_orders AS (
        SELECT o.id, o.amount_total_cents
        FROM orders o
        WHERE o.status = 'paid'
          AND o.event_id IN (SELECT id FROM organizer_events)
      ),
      sold AS (
        SELECT COALESCE(SUM(oi.qty), 0) AS tickets_sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'paid'
          AND o.event_id IN (SELECT id FROM organizer_events)
      ),
      checkins AS (
        SELECT COUNT(*) AS checkins
        FROM checkins c
        WHERE c.event_id IN (SELECT id FROM organizer_events)
      ),
      ratings AS (
        SELECT AVG(rating)::float AS avg_rating, COUNT(*)::int AS review_count
        FROM organizer_reviews
        WHERE organizer_id = $1
      )
      SELECT
        (SELECT COUNT(*) FROM organizer_events) AS events_count,
        (SELECT tickets_sold FROM sold) AS tickets_sold,
        (SELECT COALESCE(SUM(amount_total_cents), 0) FROM paid_orders) AS revenue_cents,
        (SELECT checkins FROM checkins) AS checkins,
        (SELECT avg_rating FROM ratings) AS avg_rating,
        (SELECT review_count FROM ratings) AS review_count
    `,
    [organizerId]
  );

  const metrics = rows[0] ?? {
    events_count: 0,
    tickets_sold: 0,
    revenue_cents: 0,
    checkins: 0
  };

  const avgTicketPriceCents =
    metrics.tickets_sold && metrics.tickets_sold > 0
      ? Math.round((metrics.revenue_cents ?? 0) / metrics.tickets_sold)
      : 0;

  res.json({
    metrics: {
      ...metrics,
      avg_ticket_price_cents: avgTicketPriceCents
    }
  });
});

export async function requireOrganizerId(userId: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM organizers WHERE user_id = $1", [userId]);
  const organizer = rows[0];
  if (!organizer) throw new HttpError(403, "Organizer profile required");
  return organizer.id;
}

export default router;
