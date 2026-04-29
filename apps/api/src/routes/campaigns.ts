import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../utils/http";
import { sendEmail } from "../email/sender";
import { logger } from "../logger";

const router = Router();

const channelEnum = z.enum([
  "email",
  "push",
  "sms",
  "digital",
  "homepage_feature",
]);
const statusEnum = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

const upsertSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  channel: channelEnum,
  eventId: z.string().uuid().optional(),
  organizerId: z.string().uuid().optional(),
  audienceFilter: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
  budgetCents: z.number().int().min(0).optional(),
});

// 04.01 Create campaign
router.post(
  "/",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const body = upsertSchema.parse(req.body);
    const userId = req.user!.id;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO campaigns(organizer_id, event_id, name, description, channel,
                           audience_filter, scheduled_at, budget_cents, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        body.organizerId ?? null,
        body.eventId ?? null,
        body.name,
        body.description ?? null,
        body.channel,
        JSON.stringify(body.audienceFilter ?? {}),
        body.scheduledAt ?? null,
        body.budgetCents ?? null,
        userId,
      ],
    );
    res.status(201).json({ id: rows[0].id });
  },
);

// 04.02 Update campaign
router.put(
  "/:id",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const body = upsertSchema.partial().parse(req.body);

    const { rowCount } = await pool.query(
      `UPDATE campaigns SET
       name              = COALESCE($1, name),
       description       = COALESCE($2, description),
       channel           = COALESCE($3, channel),
       event_id          = COALESCE($4, event_id),
       organizer_id      = COALESCE($5, organizer_id),
       audience_filter   = COALESCE($6::jsonb, audience_filter),
       scheduled_at      = COALESCE($7, scheduled_at),
       budget_cents      = COALESCE($8, budget_cents)
     WHERE id = $9`,
      [
        body.name ?? null,
        body.description ?? null,
        body.channel ?? null,
        body.eventId ?? null,
        body.organizerId ?? null,
        body.audienceFilter ? JSON.stringify(body.audienceFilter) : null,
        body.scheduledAt ?? null,
        body.budgetCents ?? null,
        id,
      ],
    );
    if (!rowCount) throw new HttpError(404, "Campaign not found");
    res.json({ ok: true });
  },
);

// 04.03 Delete campaign (admin only)
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { rowCount } = await pool.query("DELETE FROM campaigns WHERE id = $1", [
    id,
  ]);
  if (!rowCount) throw new HttpError(404, "Campaign not found");
  res.status(204).send();
});

router.get(
  "/",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const status = statusEnum.optional().parse(req.query.status);
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.channel, c.status, c.event_id, c.organizer_id, c.scheduled_at,
            c.started_at, c.ended_at, c.budget_cents, c.created_at,
            (SELECT COUNT(*) FROM campaign_sends s WHERE s.campaign_id = c.id) AS total_sends,
            (SELECT COUNT(*) FROM campaign_sends s WHERE s.campaign_id = c.id AND s.status = 'opened') AS opens,
            (SELECT COUNT(*) FROM campaign_sends s WHERE s.campaign_id = c.id AND s.status = 'clicked') AS clicks,
            (SELECT COUNT(*) FROM campaign_sends s WHERE s.campaign_id = c.id AND s.status = 'converted') AS conversions
     FROM campaigns c
     ${status ? "WHERE c.status = $1" : ""}
     ORDER BY c.created_at DESC LIMIT 200`,
      status ? [status] : [],
    );
    res.json({ campaigns: rows });
  },
);

router.get(
  "/:id",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const c = await pool.query("SELECT * FROM campaigns WHERE id = $1", [id]);
    if (!c.rows[0]) throw new HttpError(404, "Campaign not found");
    const stats = await pool.query<{
      total: number;
      sent: number;
      opened: number;
      clicked: number;
      converted: number;
      revenue: number;
    }>(
      `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked','converted')) AS sent,
       COUNT(*) FILTER (WHERE status IN ('opened','clicked','converted')) AS opened,
       COUNT(*) FILTER (WHERE status IN ('clicked','converted')) AS clicked,
       COUNT(*) FILTER (WHERE status = 'converted') AS converted,
       COALESCE(SUM(o.amount_total_cents),0) AS revenue
     FROM campaign_sends s
     LEFT JOIN orders o ON o.id = s.attributed_order_id
     WHERE s.campaign_id = $1`,
      [id],
    );
    res.json({ campaign: c.rows[0], stats: stats.rows[0] });
  },
);

// 04.06 Email blast
// 04.07 Push notification
// 04.08 Digital channel (just records sends; integration is provider-specific)
router.post(
  "/:id/launch",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const c = await pool.query<{
      id: string;
      name: string;
      channel: string;
      audience_filter: Record<string, unknown>;
      event_id: string | null;
      status: string;
    }>(
      "SELECT id, name, channel, audience_filter, event_id, status FROM campaigns WHERE id = $1",
      [id],
    );
    const campaign = c.rows[0];
    if (!campaign) throw new HttpError(404, "Campaign not found");
    if (!["draft", "paused"].includes(campaign.status)) {
      throw new HttpError(
        400,
        "Campaign is not launchable from its current state",
      );
    }

    const f = campaign.audience_filter ?? {};
    const wherePieces: string[] = ["u.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (campaign.channel === "email" || campaign.channel === "digital") {
      wherePieces.push("COALESCE(p.email_marketing, true) = true");
    }
    if ((f as any).city) {
      params.push((f as any).city);
      wherePieces.push(`p.city = $${params.length}`);
    }
    if ((f as any).role) {
      params.push((f as any).role);
      wherePieces.push(`u.role = $${params.length}`);
    }

    const audience = await pool.query<{ id: string; email: string }>(
      `SELECT u.id, u.email FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE ${wherePieces.join(" AND ")}`,
      params,
    );

    await pool.query(
      "UPDATE campaigns SET status = 'active', started_at = now() WHERE id = $1",
      [id],
    );

    let success = 0;
    for (const u of audience.rows) {
      let status = "queued";
      if (campaign.channel === "email") {
        try {
          await sendEmail({
            to: u.email,
            subject: campaign.name,
            html: `<div style="font-family: Inter, Arial, sans-serif;"><p>${campaign.name}</p></div>`,
          });
          status = "sent";
          success++;
        } catch (err) {
          logger.warn({ err }, "Campaign email failed");
          status = "failed";
        }
      } else {
        // For push/sms/digital we record the queued send for downstream workers.
        status = "queued";
        success++;
      }
      await pool.query(
        `INSERT INTO campaign_sends(campaign_id, user_id, channel, status, sent_at)
       VALUES ($1,$2,$3,$4, CASE WHEN $4 = 'sent' THEN now() ELSE NULL END)`,
        [id, u.id, campaign.channel, status],
      );
    }

    res.json({ ok: true, audience: audience.rows.length, success });
  },
);

router.post(
  "/:id/pause",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { rowCount } = await pool.query(
      "UPDATE campaigns SET status = 'paused' WHERE id = $1 AND status = 'active'",
      [id],
    );
    if (!rowCount) throw new HttpError(400, "Campaign not active");
    res.json({ ok: true });
  },
);

router.post(
  "/:id/complete",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { rowCount } = await pool.query(
      "UPDATE campaigns SET status = 'completed', ended_at = now() WHERE id = $1 AND status IN ('active','paused')",
      [id],
    );
    if (!rowCount) throw new HttpError(400, "Campaign cannot be completed");
    res.json({ ok: true });
  },
);

// Tracking pixel-style endpoints — public for engagement tracking.
const trackSchema = z.object({
  sendId: z.string().uuid(),
  event: z.enum(["opened", "clicked", "unsubscribed"]),
});

router.post("/track", async (req, res) => {
  const { sendId, event } = trackSchema.parse(req.body);
  const col =
    event === "opened"
      ? "opened_at"
      : event === "clicked"
        ? "clicked_at"
        : null;
  await pool.query(
    `UPDATE campaign_sends SET status = $1${col ? `, ${col} = now()` : ""}
     WHERE id = $2 AND status NOT IN ('converted','unsubscribed')`,
    [event, sendId],
  );
  res.json({ ok: true });
});

// 04.04 Feature event on homepage (admin)
const featureSchema = z.object({
  eventId: z.string().uuid(),
  featured: z.boolean(),
  until: z.string().datetime().optional(),
});

router.post(
  "/feature-event",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const body = featureSchema.parse(req.body);
    const { rowCount } = await pool.query(
      "UPDATE events SET featured = $1, featured_until = $2 WHERE id = $3",
      [body.featured, body.until ?? null, body.eventId],
    );
    if (!rowCount) throw new HttpError(404, "Event not found");
    res.json({ ok: true });
  },
);

router.get("/featured-events", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.title, e.category, e.starts_at, e.hero_image_url,
            v.name AS venue_name
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     WHERE e.status = 'published' AND e.featured = true
       AND (e.featured_until IS NULL OR e.featured_until > now())
     ORDER BY e.starts_at ASC LIMIT 12`,
  );
  res.json({ events: rows });
});

export default router;
