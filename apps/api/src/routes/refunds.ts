import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { env } from "../env";
import { requireAuth, requireRole } from "../middleware/auth";
import { getStripe } from "../stripe/client";
import { HttpError } from "../utils/http";
import { logger } from "../logger";
import { requireOrganizerId } from "./organizer";

const router = Router();

const requestSchema = z.object({
  orderId: z.string().uuid(),
  ticketId: z.string().uuid().optional(),
  reason: z.string().min(5).max(1000),
  amountCents: z.number().int().min(0).optional(),
});

// 02.06 Attendee submits a refund request.
router.post("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const body = requestSchema.parse(req.body);

  const orderRes = await pool.query<{
    id: string;
    user_id: string;
    amount_total_cents: number;
    refund_amount_cents: number;
    status: string;
  }>(
    `SELECT id, user_id, amount_total_cents, refund_amount_cents, status FROM orders WHERE id = $1`,
    [body.orderId],
  );
  const order = orderRes.rows[0];
  if (!order) throw new HttpError(404, "Order not found");
  if (order.user_id !== userId)
    throw new HttpError(403, "You can only refund your own order");
  if (order.status !== "paid")
    throw new HttpError(400, "Only paid orders can be refunded");

  const refundable = order.amount_total_cents - order.refund_amount_cents;
  const amount = body.amountCents ?? refundable;
  if (amount <= 0 || amount > refundable) {
    throw new HttpError(400, "Refund amount exceeds remaining balance");
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO refund_requests(order_id, ticket_id, user_id, reason, amount_cents)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [body.orderId, body.ticketId ?? null, userId, body.reason, amount],
  );
  res.status(201).json({ refundRequestId: rows[0].id });
});

router.get("/mine", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query(
    `SELECT r.id, r.order_id, r.ticket_id, r.reason, r.amount_cents, r.status,
            r.organizer_decision_note, r.created_at, r.decided_at, r.refund_executed_at,
            e.title AS event_title
     FROM refund_requests r
     JOIN orders o ON o.id = r.order_id
     JOIN events e ON e.id = o.event_id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC LIMIT 100`,
    [userId],
  );
  res.json({ refunds: rows });
});

// 03.08 Organizer lists pending refund requests for their events.
router.get(
  "/organizer",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const userId = req.user!.id;
    const organizerId = await requireOrganizerId(userId);
    const status = z
      .enum(["requested", "approved", "denied", "refunded", "cancelled"])
      .optional()
      .parse(req.query.status);

    const params: unknown[] = [organizerId];
    let where = "e.organizer_id = $1";
    if (status) {
      params.push(status);
      where += ` AND r.status = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT r.id, r.order_id, r.user_id, r.reason, r.amount_cents, r.status, r.created_at,
            r.organizer_decision_note,
            u.email AS attendee_email,
            e.id AS event_id, e.title AS event_title
     FROM refund_requests r
     JOIN orders o ON o.id = r.order_id
     JOIN events e ON e.id = o.event_id
     JOIN users u ON u.id = r.user_id
     WHERE ${where}
     ORDER BY r.created_at DESC LIMIT 200`,
      params,
    );
    res.json({ refunds: rows });
  },
);

const decisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  note: z.string().max(1000).optional(),
});

// 03.08 Organizer approves or denies; 05.06 Finance can also approve.
router.post(
  "/:id/decision",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const userId = req.user!.id;
    const id = z.string().uuid().parse(req.params.id);
    const body = decisionSchema.parse(req.body);

    const lookup = await pool.query<{
      id: string;
      order_id: string;
      status: string;
      amount_cents: number;
      organizer_id: string;
    }>(
      `SELECT r.id, r.order_id, r.status, r.amount_cents, e.organizer_id
     FROM refund_requests r
     JOIN orders o ON o.id = r.order_id
     JOIN events e ON e.id = o.event_id
     WHERE r.id = $1`,
      [id],
    );
    const refund = lookup.rows[0];
    if (!refund) throw new HttpError(404, "Refund request not found");
    if (refund.status !== "requested")
      throw new HttpError(400, "Refund request already decided");

    if (req.user!.role === "organizer") {
      const organizerId = await requireOrganizerId(userId);
      if (organizerId !== refund.organizer_id)
        throw new HttpError(403, "Not your event");
    }

    const newStatus = body.decision === "approve" ? "approved" : "denied";
    await pool.query(
      `UPDATE refund_requests
        SET status = $1, organizer_decision_note = $2, decided_by_user_id = $3, decided_at = now()
      WHERE id = $4`,
      [newStatus, body.note ?? null, userId, id],
    );
    await pool.query(
      "INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, metadata_json) VALUES ($1,$2,$3,$4,$5)",
      [
        userId,
        `refund.${newStatus}`,
        "refund_request",
        id,
        JSON.stringify({ note: body.note ?? null }),
      ],
    );
    res.json({ status: newStatus });
  },
);

// 05.06 Finance/admin executes the actual Stripe refund and ledger entries.
router.post(
  "/:id/execute",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const userId = req.user!.id;

    const lookup = await pool.query<{
      id: string;
      order_id: string;
      amount_cents: number;
      status: string;
      stripe_session_id: string | null;
      organizer_id: string;
      refund_amount_cents: number;
      amount_total_cents: number;
    }>(
      `SELECT r.id, r.order_id, r.amount_cents, r.status,
            o.stripe_session_id, o.refund_amount_cents, o.amount_total_cents,
            e.organizer_id
     FROM refund_requests r
     JOIN orders o ON o.id = r.order_id
     JOIN events e ON e.id = o.event_id
     WHERE r.id = $1`,
      [id],
    );
    const refund = lookup.rows[0];
    if (!refund) throw new HttpError(404, "Refund request not found");
    if (refund.status !== "approved")
      throw new HttpError(400, "Refund must be approved before execution");

    let stripeRefundId: string | null = null;
    if (env.STRIPE_SECRET_KEY && refund.stripe_session_id) {
      try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(
          refund.stripe_session_id,
        );
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        if (paymentIntentId) {
          const stripeRefund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: refund.amount_cents,
          });
          stripeRefundId = stripeRefund.id;
        }
      } catch (err) {
        logger.error({ err }, "Stripe refund failed");
        throw new HttpError(502, "Stripe refund failed");
      }
    }

    await pool.query("BEGIN");
    try {
      await pool.query(
        `UPDATE refund_requests
          SET status = 'refunded', refund_executed_at = now(), stripe_refund_id = $1
        WHERE id = $2`,
        [stripeRefundId, id],
      );
      const newRefundTotal = refund.refund_amount_cents + refund.amount_cents;
      const newOrderStatus =
        newRefundTotal >= refund.amount_total_cents ? "refunded" : "paid";
      await pool.query(
        `UPDATE orders SET refund_amount_cents = $1, status = $2 WHERE id = $3`,
        [newRefundTotal, newOrderStatus, refund.order_id],
      );
      await pool.query(
        `INSERT INTO ledger_entries(order_id, organizer_id, entry_type, amount_cents, description, reference)
       VALUES ($1,$2,'refund', -$3, 'Refund executed', $4)`,
        [
          refund.order_id,
          refund.organizer_id,
          refund.amount_cents,
          stripeRefundId,
        ],
      );
      // Update settlement aggregates.
      await pool.query(
        `UPDATE settlements
          SET refund_cents = refund_cents + $1,
              net_organizer_cents = net_organizer_cents - $1
        WHERE order_id = $2`,
        [refund.amount_cents, refund.order_id],
      );
      await pool.query(
        "INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, metadata_json) VALUES ($1,$2,$3,$4,$5)",
        [
          userId,
          "refund.execute",
          "refund_request",
          id,
          JSON.stringify({ stripeRefundId }),
        ],
      );
      await pool.query("COMMIT");
      res.json({ ok: true, stripeRefundId });
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  },
);

// 02.07 Attendee cancels a still-pending refund request.
router.post("/:id/cancel", requireAuth, async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const userId = req.user!.id;
  const { rowCount } = await pool.query(
    `UPDATE refund_requests SET status = 'cancelled'
      WHERE id = $1 AND user_id = $2 AND status = 'requested'`,
    [id, userId],
  );
  if (!rowCount) throw new HttpError(400, "Cannot cancel this request");
  res.json({ ok: true });
});

export default router;
