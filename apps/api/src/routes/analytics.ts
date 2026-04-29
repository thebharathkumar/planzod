import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireOrganizerId } from "./organizer";

const router = Router();

const rangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

function rangeFilter(
  field: string,
  params: unknown[],
  q: z.infer<typeof rangeSchema>,
): string[] {
  const conds: string[] = [];
  if (q.start) {
    params.push(q.start);
    conds.push(`${field} >= $${params.length}`);
  }
  if (q.end) {
    params.push(q.end);
    conds.push(`${field} < $${params.length}`);
  }
  return conds;
}

// 06.01 Track event performance
router.get(
  "/events",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const q = rangeSchema.parse(req.query);
    const params: unknown[] = [];
    const conds = rangeFilter("e.starts_at", params, q);
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      conds.push(`e.organizer_id = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.category, e.starts_at,
            COALESCE((SELECT SUM(views)  FROM daily_event_metrics m WHERE m.event_id = e.id), 0)::int AS views,
            COALESCE((SELECT SUM(saves)  FROM daily_event_metrics m WHERE m.event_id = e.id), 0)::int AS saves,
            COALESCE((SELECT SUM(shares) FROM daily_event_metrics m WHERE m.event_id = e.id), 0)::int AS shares,
            (SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id = t.order_id WHERE t.event_id = e.id AND o.status = 'paid')::int AS tickets_sold,
            (SELECT COUNT(*) FROM checkins c WHERE c.event_id = e.id)::int AS checkins,
            (SELECT COALESCE(SUM(amount_total_cents - refund_amount_cents), 0) FROM orders WHERE event_id = e.id AND status IN ('paid','refunded'))::bigint AS net_cents,
            (SELECT AVG(rating)::float FROM event_reviews WHERE event_id = e.id) AS avg_rating
     FROM events e
     ${where}
     ORDER BY e.starts_at DESC LIMIT 200`,
      params,
    );
    res.json({ events: rows });
  },
);

// 06.02 Analyze revenue trends
router.get(
  "/revenue-trend",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const q = rangeSchema.parse(req.query);
    const params: unknown[] = [];
    const conds = [
      "o.status IN ('paid','refunded')",
      ...rangeFilter("o.created_at", params, q),
    ];
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      conds.push(`e.organizer_id = $${params.length}`);
    }

    const series = await pool.query(
      `SELECT date_trunc('day', o.created_at) AS day,
            COALESCE(SUM(amount_total_cents),0)::bigint AS gross_cents,
            COALESCE(SUM(refund_amount_cents),0)::bigint AS refund_cents,
            COUNT(*)::int AS orders
     FROM orders o JOIN events e ON e.id = o.event_id
     WHERE ${conds.join(" AND ")}
     GROUP BY 1 ORDER BY 1`,
      params,
    );

    const byCategory = await pool.query(
      `SELECT e.category,
            COALESCE(SUM(o.amount_total_cents),0)::bigint AS gross_cents,
            COUNT(*)::int AS orders
     FROM orders o JOIN events e ON e.id = o.event_id
     WHERE ${conds.join(" AND ")}
     GROUP BY e.category ORDER BY gross_cents DESC`,
      params,
    );

    res.json({ series: series.rows, by_category: byCategory.rows });
  },
);

// 06.03 Track organizer performance
router.get(
  "/organizers",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const q = rangeSchema.parse(req.query);
    const params: unknown[] = [];
    const conds = rangeFilter("o.created_at", params, q);
    const where = conds.length ? `AND ${conds.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT org.id, org.display_name,
            COUNT(DISTINCT e.id)::int AS events,
            COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('paid','refunded')) ::int AS orders,
            COALESCE(SUM(o.amount_total_cents) FILTER (WHERE o.status IN ('paid','refunded')), 0)::bigint AS gross_cents,
            (SELECT AVG(rating)::float FROM organizer_reviews r WHERE r.organizer_id = org.id) AS avg_rating
     FROM organizers org
     LEFT JOIN events e ON e.organizer_id = org.id
     LEFT JOIN orders o ON o.event_id = e.id ${where}
     GROUP BY org.id, org.display_name
     ORDER BY gross_cents DESC LIMIT 200`,
      params,
    );
    res.json({ organizers: rows });
  },
);

// 06.04 Analyze customer behaviour
router.get(
  "/customers",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const cohorts = await pool.query(
      `SELECT date_trunc('week', created_at)::date AS week,
            COUNT(*)::int AS new_users
     FROM users WHERE deleted_at IS NULL AND created_at > now() - interval '90 days'
     GROUP BY 1 ORDER BY 1`,
    );
    const byInteraction = await pool.query(
      `SELECT interaction_type, COUNT(*)::int AS count
     FROM user_event_interactions
     WHERE created_at > now() - interval '30 days'
     GROUP BY interaction_type`,
    );
    const repeatRate = await pool.query<{
      repeat_users: number;
      total_users: number;
    }>(
      `WITH per_user AS (
       SELECT user_id, COUNT(*) AS orders FROM orders WHERE status = 'paid' GROUP BY user_id
     )
     SELECT
       (SELECT COUNT(*) FROM per_user WHERE orders > 1)::int AS repeat_users,
       (SELECT COUNT(*) FROM per_user)::int AS total_users`,
    );
    res.json({
      cohorts: cohorts.rows,
      by_interaction: byInteraction.rows,
      repeat: repeatRate.rows[0],
    });
  },
);

// 06.05 Analyze event-discovery trends
router.get(
  "/discovery",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res) => {
    const sources = await pool.query(
      `SELECT COALESCE(source, 'organic') AS source, COUNT(*)::int AS interactions
     FROM user_event_interactions
     WHERE created_at > now() - interval '30 days'
     GROUP BY source ORDER BY interactions DESC`,
    );
    const topQueries = await pool.query(
      `SELECT e.category, COUNT(*)::int AS impressions
     FROM user_event_interactions i
     JOIN events e ON e.id = i.event_id
     WHERE i.interaction_type = 'search_impression' AND i.created_at > now() - interval '30 days'
     GROUP BY e.category ORDER BY impressions DESC LIMIT 20`,
    );
    const conversionFunnel = await pool.query<{
      step: string;
      count: number;
    }>(
      `WITH counts AS (
       SELECT
         (SELECT COUNT(*) FROM user_event_interactions WHERE interaction_type = 'view'    AND created_at > now() - interval '30 days')::int AS views,
         (SELECT COUNT(*) FROM user_event_interactions WHERE interaction_type = 'click'   AND created_at > now() - interval '30 days')::int AS clicks,
         (SELECT COUNT(*) FROM orders WHERE status = 'paid' AND created_at > now() - interval '30 days')::int AS purchases
     )
     SELECT 'views'::text AS step, views AS count FROM counts
     UNION ALL SELECT 'clicks', clicks FROM counts
     UNION ALL SELECT 'purchases', purchases FROM counts`,
    );
    res.json({
      sources: sources.rows,
      topCategories: topQueries.rows,
      funnel: conversionFunnel.rows,
    });
  },
);

// 06.06 Analyze marketing performance
router.get(
  "/marketing",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res) => {
    const byChannel = await pool.query(
      `SELECT c.channel,
            COUNT(s.id) FILTER (WHERE s.status IN ('sent','delivered','opened','clicked','converted'))::int AS sent,
            COUNT(s.id) FILTER (WHERE s.status IN ('opened','clicked','converted'))::int AS opened,
            COUNT(s.id) FILTER (WHERE s.status IN ('clicked','converted'))::int AS clicked,
            COUNT(s.id) FILTER (WHERE s.status = 'converted')::int AS converted,
            COALESCE(SUM(o.amount_total_cents) FILTER (WHERE s.status = 'converted'), 0)::bigint AS revenue_cents
     FROM campaigns c
     LEFT JOIN campaign_sends s ON s.campaign_id = c.id
     LEFT JOIN orders o ON o.id = s.attributed_order_id
     GROUP BY c.channel ORDER BY sent DESC NULLS LAST`,
    );
    const topCampaigns = await pool.query(
      `SELECT c.id, c.name, c.channel, c.status,
            COUNT(s.id) FILTER (WHERE s.status IN ('sent','delivered','opened','clicked','converted'))::int AS sent,
            COUNT(s.id) FILTER (WHERE s.status = 'converted')::int AS converted,
            COALESCE(SUM(o.amount_total_cents) FILTER (WHERE s.status = 'converted'), 0)::bigint AS revenue_cents
     FROM campaigns c
     LEFT JOIN campaign_sends s ON s.campaign_id = c.id
     LEFT JOIN orders o ON o.id = s.attributed_order_id
     GROUP BY c.id, c.name, c.channel, c.status
     ORDER BY revenue_cents DESC NULLS LAST LIMIT 20`,
    );
    res.json({ byChannel: byChannel.rows, topCampaigns: topCampaigns.rows });
  },
);

// 06.07 Organizer dashboard (single-organizer view)
router.get(
  "/organizer/dashboard",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const organizerId = await requireOrganizerId(req.user!.id);

    const totals = await pool.query(
      `SELECT
       (SELECT COUNT(*) FROM events WHERE organizer_id = $1)::int AS events,
       (SELECT COUNT(*) FROM events WHERE organizer_id = $1 AND status = 'published')::int AS published,
       (SELECT COUNT(*) FROM tickets t JOIN events e ON e.id = t.event_id WHERE e.organizer_id = $1)::int AS tickets,
       (SELECT COALESCE(SUM(o.amount_total_cents - o.refund_amount_cents),0) FROM orders o JOIN events e ON e.id = o.event_id WHERE e.organizer_id = $1 AND o.status IN ('paid','refunded'))::bigint AS net_cents,
       (SELECT AVG(rating)::float FROM organizer_reviews WHERE organizer_id = $1) AS avg_rating`,
      [organizerId],
    );
    const upcoming = await pool.query(
      `SELECT id, title, starts_at, status FROM events
      WHERE organizer_id = $1 AND starts_at > now() ORDER BY starts_at ASC LIMIT 10`,
      [organizerId],
    );
    const trend = await pool.query(
      `SELECT date_trunc('day', o.created_at) AS day, COALESCE(SUM(amount_total_cents),0)::bigint AS gross_cents
     FROM orders o JOIN events e ON e.id = o.event_id
     WHERE e.organizer_id = $1 AND o.status IN ('paid','refunded') AND o.created_at > now() - interval '60 days'
     GROUP BY 1 ORDER BY 1`,
      [organizerId],
    );
    res.json({
      totals: totals.rows[0],
      upcoming: upcoming.rows,
      trend: trend.rows,
    });
  },
);

// 06.08 Marketing analytics dashboard handled by /marketing above.
// 06.09 Finance analytics dashboard
router.get(
  "/finance/dashboard",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res) => {
    const totals = await pool.query<{
      gross: string;
      refunds: string;
      payouts: string;
      pending_payouts: string;
    }>(
      `SELECT
       COALESCE(SUM(amount_total_cents),0)::bigint AS gross,
       COALESCE(SUM(refund_amount_cents),0)::bigint AS refunds,
       (SELECT COALESCE(SUM(amount_cents),0) FROM payouts WHERE status = 'paid')::bigint AS payouts,
       (SELECT COALESCE(SUM(amount_cents),0) FROM payouts WHERE status IN ('pending','processing'))::bigint AS pending_payouts
     FROM orders WHERE status IN ('paid','refunded')`,
    );
    const trend = await pool.query(
      `SELECT date_trunc('day', created_at) AS day,
            COALESCE(SUM(amount_total_cents),0)::bigint AS gross_cents
     FROM orders WHERE status IN ('paid','refunded') AND created_at > now() - interval '60 days'
     GROUP BY 1 ORDER BY 1`,
    );
    res.json({ totals: totals.rows[0], trend: trend.rows });
  },
);

// 06.10 Export analytics report (CSV)
router.get(
  "/export.csv",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const q = z
      .object({
        kind: z.enum(["events", "revenue-trend"]).default("events"),
        start: z.string().datetime().optional(),
        end: z.string().datetime().optional(),
      })
      .parse(req.query);

    const params: unknown[] = [];
    let scope = "";
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      scope = `e.organizer_id = $${params.length}`;
    }

    const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    let header: string;
    let lines: string[] = [];

    if (q.kind === "events") {
      const conds = [
        ...rangeFilter("e.starts_at", params, { start: q.start, end: q.end }),
        scope,
      ].filter(Boolean);
      const { rows } = await pool.query<{
        id: string;
        title: string;
        category: string;
        starts_at: string;
        tickets_sold: number;
        net_cents: string;
      }>(
        `SELECT e.id, e.title, e.category, e.starts_at,
              (SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id = t.order_id WHERE t.event_id = e.id AND o.status = 'paid')::int AS tickets_sold,
              (SELECT COALESCE(SUM(amount_total_cents - refund_amount_cents),0) FROM orders WHERE event_id = e.id AND status IN ('paid','refunded')) AS net_cents
       FROM events e
       ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
       ORDER BY e.starts_at DESC`,
        params,
      );
      header = "event_id,title,category,starts_at,tickets_sold,net_cents";
      lines = rows.map((r) =>
        [
          r.id,
          escape(r.title),
          r.category,
          r.starts_at,
          r.tickets_sold,
          r.net_cents,
        ].join(","),
      );
    } else {
      const conds = [
        "o.status IN ('paid','refunded')",
        ...rangeFilter("o.created_at", params, { start: q.start, end: q.end }),
      ];
      if (scope) conds.push(scope);
      const { rows } = await pool.query<{
        day: string;
        gross_cents: string;
        orders: number;
      }>(
        `SELECT date_trunc('day', o.created_at) AS day,
              COALESCE(SUM(amount_total_cents),0)::bigint AS gross_cents,
              COUNT(*)::int AS orders
       FROM orders o JOIN events e ON e.id = o.event_id
       WHERE ${conds.join(" AND ")}
       GROUP BY 1 ORDER BY 1`,
        params,
      );
      header = "day,gross_cents,orders";
      lines = rows.map((r) => [r.day, r.gross_cents, r.orders].join(","));
    }

    res.set("Content-Type", "text/csv");
    res.set("Content-Disposition", `attachment; filename="${q.kind}.csv"`);
    res.send([header, ...lines].join("\n") + "\n");
  },
);

export default router;
