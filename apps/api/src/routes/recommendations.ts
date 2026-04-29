import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";

const router = Router();

const interactionSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum([
    "view",
    "click",
    "save",
    "share",
    "purchase",
    "search_impression",
  ]),
  source: z.string().max(80).optional(),
});

// Anyone can record interactions (anon allowed) — used to track behaviour.
router.post("/interactions", async (req, res) => {
  const body = interactionSchema.parse(req.body);
  const userId = req.user?.id ?? null;
  await pool.query(
    `INSERT INTO user_event_interactions(user_id, event_id, interaction_type, source)
     VALUES ($1,$2,$3,$4)`,
    [userId, body.eventId, body.type, body.source ?? null],
  );
  res.status(201).json({ ok: true });
});

// 04.05 Recommend events based on a user's history.
// Strategy: weight recent interactions by category, boost upcoming events
// in the user's profile city, and exclude already-purchased events.
router.get("/recommendations", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(40)
    .default(10)
    .parse(req.query.limit);

  const { rows } = await pool.query(
    `WITH user_categories AS (
       SELECT e.category, COUNT(*)::float AS weight
       FROM user_event_interactions i
       JOIN events e ON e.id = i.event_id
       WHERE i.user_id = $1 AND i.created_at > now() - interval '90 days'
       GROUP BY e.category
     ),
     user_city AS (
       SELECT city FROM user_profiles WHERE user_id = $1
     ),
     attended AS (
       SELECT DISTINCT event_id FROM tickets WHERE user_id = $1
     )
     SELECT e.id, e.title, e.category, e.starts_at, e.hero_image_url, e.lat, e.lng,
            v.name AS venue_name, v.address AS venue_address,
            (
              COALESCE((SELECT weight FROM user_categories WHERE category = e.category), 0) * 4
              + CASE WHEN (SELECT city FROM user_city) IS NOT NULL THEN 1.5 ELSE 0 END
              + CASE WHEN e.starts_at < now() + interval '14 days' THEN 1.0 ELSE 0 END
              + CASE WHEN e.featured THEN 0.5 ELSE 0 END
            ) AS score
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     WHERE e.status = 'published'
       AND e.starts_at > now()
       AND e.id NOT IN (SELECT event_id FROM attended)
     ORDER BY score DESC, e.starts_at ASC
     LIMIT $2`,
    [userId, limit],
  );
  res.json({ events: rows });
});

export default router;
