import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../utils/http";
import { requireOrganizerId } from "./organizer";

const router = Router();

// 05.01 Track ticket sales (raw + aggregated)
router.get(
  "/sales",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const isAdmin = req.user!.role === "admin";
    const params: unknown[] = [];
    let where = "o.status IN ('paid','refunded')";
    if (!isAdmin) {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      where += ` AND e.organizer_id = $${params.length}`;
    }

    const aggregated = await pool.query(
      `SELECT COUNT(t.id)::int AS tickets_sold,
            COALESCE(SUM(o.amount_total_cents),0)::bigint AS gross_cents,
            COALESCE(SUM(o.refund_amount_cents),0)::bigint AS refund_cents
     FROM orders o
     JOIN events e ON e.id = o.event_id
     LEFT JOIN tickets t ON t.order_id = o.id
     WHERE ${where}`,
      params,
    );

    const byDay = await pool.query(
      `SELECT date_trunc('day', o.created_at) AS day,
            COUNT(t.id)::int AS tickets_sold,
            COALESCE(SUM(o.amount_total_cents),0)::bigint AS gross_cents
     FROM orders o
     JOIN events e ON e.id = o.event_id
     LEFT JOIN tickets t ON t.order_id = o.id
     WHERE ${where} AND o.created_at > now() - interval '90 days'
     GROUP BY 1 ORDER BY 1`,
      params,
    );

    res.json({ totals: aggregated.rows[0], series: byDay.rows });
  },
);

// 05.02 Track revenue by event
router.get(
  "/revenue",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const params: unknown[] = [];
    let scope = "";
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      scope = `WHERE e.organizer_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.starts_at,
            COUNT(o.id)::int AS orders,
            COALESCE(SUM(o.amount_total_cents),0)::bigint AS gross_cents,
            COALESCE(SUM(o.refund_amount_cents),0)::bigint AS refund_cents,
            COALESCE(SUM(o.amount_total_cents - o.refund_amount_cents),0)::bigint AS net_cents
     FROM events e
     LEFT JOIN orders o ON o.event_id = e.id AND o.status IN ('paid','refunded')
     ${scope}
     GROUP BY e.id, e.title, e.starts_at
     ORDER BY gross_cents DESC LIMIT 100`,
      params,
    );
    res.json({ events: rows });
  },
);

// 05.03 Calculate platform commission for a date range
router.get(
  "/commission",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const q = z
      .object({
        start: z.string().datetime().optional(),
        end: z.string().datetime().optional(),
      })
      .parse(req.query);

    const params: unknown[] = [];
    const conditions: string[] = ["o.status IN ('paid','refunded')"];
    if (q.start) {
      params.push(q.start);
      conditions.push(`o.created_at >= $${params.length}`);
    }
    if (q.end) {
      params.push(q.end);
      conditions.push(`o.created_at < $${params.length}`);
    }

    const settings = await pool.query<{
      platform_commission_bps: number;
      payment_processing_bps: number;
      payment_processing_flat_cents: number;
    }>(
      `SELECT platform_commission_bps, payment_processing_bps, payment_processing_flat_cents
     FROM finance_settings WHERE id = 1`,
    );
    const s = settings.rows[0];

    const { rows } = await pool.query<{
      gross_cents: string;
      refund_cents: string;
      orders: number;
    }>(
      `SELECT COALESCE(SUM(amount_total_cents),0) AS gross_cents,
            COALESCE(SUM(refund_amount_cents),0) AS refund_cents,
            COUNT(*)::int AS orders
     FROM orders o
     WHERE ${conditions.join(" AND ")}`,
      params,
    );

    const gross = Number(rows[0].gross_cents);
    const refunds = Number(rows[0].refund_cents);
    const net = gross - refunds;
    const commission = Math.round((net * s.platform_commission_bps) / 10000);
    const processingFee =
      Math.round((net * s.payment_processing_bps) / 10000) +
      s.payment_processing_flat_cents * rows[0].orders;
    const organizerNet = net - commission - processingFee;

    res.json({
      settings: s,
      totals: {
        gross_cents: gross,
        refund_cents: refunds,
        net_cents: net,
        commission_cents: commission,
        processing_fee_cents: processingFee,
        organizer_net_cents: organizerNet,
        orders: rows[0].orders,
      },
    });
  },
);

// 05.04 Manage organizer payouts
const payoutCreateSchema = z.object({
  organizerId: z.string().uuid(),
  amountCents: z.number().int().min(0),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

router.post(
  "/payouts",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const body = payoutCreateSchema.parse(req.body);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO payouts(organizer_id, amount_cents, period_start, period_end, scheduled_at, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        body.organizerId,
        body.amountCents,
        body.periodStart,
        body.periodEnd,
        body.scheduledAt ?? null,
        body.notes ?? null,
      ],
    );
    res.status(201).json({ id: rows[0].id });
  },
);

const payoutStatusSchema = z.object({
  status: z.enum(["pending", "processing", "paid", "failed", "cancelled"]),
  stripeTransferId: z.string().max(120).optional(),
});

router.post(
  "/payouts/:id/status",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const body = payoutStatusSchema.parse(req.body);
    const paidAt = body.status === "paid" ? "now()" : "null";

    const { rowCount } = await pool.query(
      `UPDATE payouts SET status = $1, stripe_transfer_id = $2, paid_at = ${paidAt}
     WHERE id = $3`,
      [body.status, body.stripeTransferId ?? null, id],
    );
    if (!rowCount) throw new HttpError(404, "Payout not found");

    if (body.status === "paid") {
      await pool.query(
        `INSERT INTO ledger_entries(organizer_id, entry_type, amount_cents, description, reference)
       SELECT organizer_id, 'payout', -amount_cents, 'Payout sent', $1 FROM payouts WHERE id = $2`,
        [body.stripeTransferId ?? null, id],
      );
      await pool.query(
        `UPDATE settlements SET status = 'paid' WHERE payout_id = $1`,
        [id],
      );
    }
    res.json({ ok: true });
  },
);

router.get(
  "/payouts",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const params: unknown[] = [];
    let where = "1=1";
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      where += ` AND p.organizer_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT p.id, p.organizer_id, o.display_name AS organizer_name, p.amount_cents, p.currency,
            p.status, p.period_start, p.period_end, p.scheduled_at, p.paid_at, p.stripe_transfer_id, p.notes
     FROM payouts p
     LEFT JOIN organizers o ON o.id = p.organizer_id
     WHERE ${where}
     ORDER BY p.created_at DESC LIMIT 200`,
      params,
    );
    res.json({ payouts: rows });
  },
);

// 05.05 Track payment settlement status
router.get(
  "/settlements",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const params: unknown[] = [];
    let where = "1=1";
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      where += ` AND s.organizer_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT s.id, s.order_id, s.organizer_id, s.gross_cents, s.commission_cents,
            s.processing_fee_cents, s.refund_cents, s.net_organizer_cents, s.status,
            s.created_at, s.reconciled_at, s.payout_id,
            e.title AS event_title
     FROM settlements s
     JOIN orders o ON o.id = s.order_id
     JOIN events e ON e.id = o.event_id
     WHERE ${where}
     ORDER BY s.created_at DESC LIMIT 200`,
      params,
    );
    res.json({ settlements: rows });
  },
);

// 05.09 Reconcile transactions in a payout (assigns settlements → payout)
const reconcileSchema = z.object({
  payoutId: z.string().uuid(),
  settlementIds: z.array(z.string().uuid()).min(1).max(500),
});

router.post(
  "/reconcile",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const body = reconcileSchema.parse(req.body);
    await pool.query("BEGIN");
    try {
      const { rows } = await pool.query<{ total: string }>(
        `UPDATE settlements
          SET status = 'reconciled', reconciled_at = now(), payout_id = $1
        WHERE id = ANY($2::uuid[]) AND status = 'unsettled'
        RETURNING net_organizer_cents`,
        [body.payoutId, body.settlementIds],
      );
      const totalCents = rows.reduce(
        (sum, r) =>
          sum + Number(r.total ?? (r as any).net_organizer_cents ?? 0),
        0,
      );
      await pool.query("UPDATE payouts SET amount_cents = $1 WHERE id = $2", [
        totalCents,
        body.payoutId,
      ]);
      await pool.query("COMMIT");
      res.json({ ok: true, settlements: rows.length, totalCents });
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  },
);

// 05.07 Generate financial report
router.get(
  "/reports/financial",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const q = z
      .object({
        start: z.string().datetime().optional(),
        end: z.string().datetime().optional(),
      })
      .parse(req.query);

    const params: unknown[] = [];
    const conditions: string[] = ["o.status IN ('paid','refunded')"];
    if (q.start) {
      params.push(q.start);
      conditions.push(`o.created_at >= $${params.length}`);
    }
    if (q.end) {
      params.push(q.end);
      conditions.push(`o.created_at < $${params.length}`);
    }
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      conditions.push(`e.organizer_id = $${params.length}`);
    }

    const summary = await pool.query(
      `SELECT
       COUNT(o.id)::int AS orders,
       COALESCE(SUM(o.amount_total_cents),0)::bigint AS gross_cents,
       COALESCE(SUM(o.refund_amount_cents),0)::bigint AS refunds_cents
     FROM orders o JOIN events e ON e.id = o.event_id
     WHERE ${conditions.join(" AND ")}`,
      params,
    );
    const ledgerParams: unknown[] = [];
    const ledgerConditions: string[] = [];
    if (q.start) {
      ledgerParams.push(q.start);
      ledgerConditions.push(`l.created_at >= $${ledgerParams.length}`);
    }
    if (q.end) {
      ledgerParams.push(q.end);
      ledgerConditions.push(`l.created_at < $${ledgerParams.length}`);
    }
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      ledgerParams.push(organizerId);
      ledgerConditions.push(`l.organizer_id = $${ledgerParams.length}`);
    }
    const ledger = await pool.query(
      `SELECT entry_type, COALESCE(SUM(amount_cents),0)::bigint AS total_cents
     FROM ledger_entries l
     ${ledgerConditions.length ? "WHERE " + ledgerConditions.join(" AND ") : ""}
     GROUP BY entry_type`,
      ledgerParams,
    );

    res.json({ summary: summary.rows[0], ledger: ledger.rows });
  },
);

// 05.08 Export financial report as CSV
router.get(
  "/reports/financial.csv",
  requireAuth,
  requireRole(["admin", "organizer"]),
  async (req, res) => {
    const q = z
      .object({
        start: z.string().datetime().optional(),
        end: z.string().datetime().optional(),
      })
      .parse(req.query);

    const params: unknown[] = [];
    const conditions: string[] = ["o.status IN ('paid','refunded')"];
    if (q.start) {
      params.push(q.start);
      conditions.push(`o.created_at >= $${params.length}`);
    }
    if (q.end) {
      params.push(q.end);
      conditions.push(`o.created_at < $${params.length}`);
    }
    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(req.user!.id);
      params.push(organizerId);
      conditions.push(`e.organizer_id = $${params.length}`);
    }

    const { rows } = await pool.query<{
      order_id: string;
      event_title: string;
      created_at: string;
      status: string;
      gross_cents: number;
      refund_cents: number;
      currency: string;
    }>(
      `SELECT o.id AS order_id, e.title AS event_title, o.created_at, o.status,
            o.amount_total_cents AS gross_cents, o.refund_amount_cents AS refund_cents, o.currency
     FROM orders o JOIN events e ON e.id = o.event_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY o.created_at ASC`,
      params,
    );

    const header =
      "order_id,event_title,created_at,status,gross_cents,refund_cents,currency";
    const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const body = rows
      .map((r) =>
        [
          r.order_id,
          escape(r.event_title),
          r.created_at,
          r.status,
          r.gross_cents,
          r.refund_cents,
          r.currency,
        ].join(","),
      )
      .join("\n");

    res.set("Content-Type", "text/csv");
    res.set(
      "Content-Disposition",
      `attachment; filename="financial-report.csv"`,
    );
    res.send(`${header}\n${body}\n`);
  },
);

// Settings (admin)
const settingsSchema = z.object({
  platformCommissionBps: z.number().int().min(0).max(5000).optional(),
  paymentProcessingBps: z.number().int().min(0).max(2000).optional(),
  paymentProcessingFlatCents: z.number().int().min(0).max(1000).optional(),
  payoutSchedule: z.enum(["daily", "weekly", "monthly", "manual"]).optional(),
});

router.get(
  "/settings",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM finance_settings WHERE id = 1",
    );
    res.json({ settings: rows[0] });
  },
);

router.put(
  "/settings",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const body = settingsSchema.parse(req.body);
    await pool.query(
      `UPDATE finance_settings SET
       platform_commission_bps       = COALESCE($1, platform_commission_bps),
       payment_processing_bps        = COALESCE($2, payment_processing_bps),
       payment_processing_flat_cents = COALESCE($3, payment_processing_flat_cents),
       payout_schedule               = COALESCE($4, payout_schedule)
     WHERE id = 1`,
      [
        body.platformCommissionBps ?? null,
        body.paymentProcessingBps ?? null,
        body.paymentProcessingFlatCents ?? null,
        body.payoutSchedule ?? null,
      ],
    );
    res.json({ ok: true });
  },
);

export default router;
