import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";

const router = Router();

const querySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusKm: z.coerce.number().default(10),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: z.string().optional(),
  price: z.enum(["any", "free", "paid"]).default("any"),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0)
});

router.get("/events", async (req, res) => {
  const q = querySchema.parse(req.query);
  const radiusM = q.radiusKm * 1000;

  const { rows } = await pool.query(
    `
      WITH params AS (
        SELECT
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS origin,
          $3::double precision AS radius_m
      )
      SELECT
        e.id,
        e.title,
        e.category,
        e.starts_at,
        e.ends_at,
        e.hero_image_url,
        e.lat,
        e.lng,
        v.name AS venue_name,
        v.address AS venue_address,
        ST_Distance(e.geo, p.origin) AS distance_m,
        price.min_price_cents,
        price.has_paid,
        price.has_free
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      CROSS JOIN params p
      LEFT JOIN LATERAL (
        SELECT
          MIN(tt.price_cents) AS min_price_cents,
          BOOL_OR(tt.price_cents > 0) AS has_paid,
          BOOL_OR(tt.price_cents = 0) AS has_free
        FROM ticket_tiers tt
        WHERE tt.event_id = e.id
          AND tt.remaining_qty > 0
          AND tt.sales_start <= now()
          AND (tt.sales_end IS NULL OR tt.sales_end >= now())
      ) price ON true
      WHERE e.status = 'published'
        AND ST_DWithin(e.geo, p.origin, p.radius_m)
        AND ($4::timestamptz IS NULL OR e.starts_at >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR e.starts_at <= $5::timestamptz)
        AND ($6::text IS NULL OR e.category = $6::text)
        AND (
          $7::text = 'any'
          OR ($7::text = 'free' AND COALESCE(price.has_free, false))
          OR ($7::text = 'paid' AND COALESCE(price.has_paid, false))
        )
      ORDER BY distance_m ASC, e.starts_at ASC
      LIMIT $8 OFFSET $9
    `,
    [q.lng, q.lat, radiusM, q.from ?? null, q.to ?? null, q.category ?? null, q.price, q.limit, q.offset]
  );

  res.json({ results: rows });
});

export default router;

