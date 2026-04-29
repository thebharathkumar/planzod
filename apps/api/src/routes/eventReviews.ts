import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../utils/http";

const router = Router();

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(140).optional(),
  comment: z.string().max(2000).optional(),
});

// 02.10 Submit a review (must have a paid ticket).
router.post("/events/:eventId/reviews", requireAuth, async (req, res) => {
  const eventId = z.string().uuid().parse(req.params.eventId);
  const userId = req.user!.id;
  const body = reviewSchema.parse(req.body);

  const eligible = await pool.query(
    `SELECT 1 FROM tickets WHERE user_id = $1 AND event_id = $2 AND status = 'issued' LIMIT 1`,
    [userId, eventId],
  );
  if (eligible.rowCount !== 1)
    throw new HttpError(403, "Only attendees can review this event");

  try {
    await pool.query(
      `INSERT INTO event_reviews(event_id, user_id, rating, title, comment)
       VALUES ($1,$2,$3,$4,$5)`,
      [eventId, userId, body.rating, body.title ?? null, body.comment ?? null],
    );
  } catch (err: any) {
    if (err?.code === "23505") {
      // Update existing review.
      await pool.query(
        `UPDATE event_reviews SET rating = $1, title = $2, comment = $3
         WHERE event_id = $4 AND user_id = $5`,
        [
          body.rating,
          body.title ?? null,
          body.comment ?? null,
          eventId,
          userId,
        ],
      );
      return res.json({ ok: true, updated: true });
    }
    throw err;
  }
  res.status(201).json({ ok: true });
});

router.get("/events/:eventId/reviews", async (req, res) => {
  const eventId = z.string().uuid().parse(req.params.eventId);
  const reviews = await pool.query(
    `SELECT r.id, r.rating, r.title, r.comment, r.created_at,
            COALESCE(p.display_name, SPLIT_PART(u.email, '@', 1)) AS author_name,
            p.avatar_url
     FROM event_reviews r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN user_profiles p ON p.user_id = r.user_id
     WHERE r.event_id = $1
     ORDER BY r.created_at DESC LIMIT 100`,
    [eventId],
  );
  const summary = await pool.query<{
    avg_rating: number | null;
    review_count: number;
  }>(
    `SELECT AVG(rating)::float AS avg_rating, COUNT(*)::int AS review_count
     FROM event_reviews WHERE event_id = $1`,
    [eventId],
  );
  res.json({ reviews: reviews.rows, summary: summary.rows[0] });
});

export default router;
