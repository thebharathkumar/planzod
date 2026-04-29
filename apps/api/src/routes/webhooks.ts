import express, { Router } from "express";
import Stripe from "stripe";
import { pool } from "../db/pool";
import { env } from "../env";
import { getStripe } from "../stripe/client";
import { logger } from "../logger";
import { calculateCommission } from "../finance/commission";

const router = Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
      return res.status(501).json({ error: "Stripe webhook not configured" });
    }

    const stripe = getStripe();
    const sig = req.header("stripe-signature");
    if (!sig)
      return res.status(400).json({ error: "Missing stripe-signature header" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.warn({ err }, "Stripe signature verification failed");
      return res.status(400).json({ error: "Invalid signature" });
    }

    if (event.type !== "checkout.session.completed") {
      return res.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const stripeSessionId = session.id;
    const orderId = session.metadata?.orderId;

    await pool.query("BEGIN");
    try {
      const dedupe = await pool.query(
        "INSERT INTO stripe_events(stripe_event_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [event.id],
      );
      if (dedupe.rowCount === 0) {
        await pool.query("ROLLBACK");
        return res.json({ received: true, duplicate: true });
      }

      const orderRes = orderId
        ? await pool.query<{
            id: string;
            user_id: string;
            event_id: string;
            status: string;
          }>("SELECT id, user_id, event_id, status FROM orders WHERE id = $1", [
            orderId,
          ])
        : await pool.query<{
            id: string;
            user_id: string;
            event_id: string;
            status: string;
          }>(
            "SELECT id, user_id, event_id, status FROM orders WHERE stripe_session_id = $1",
            [stripeSessionId],
          );

      const order = orderRes.rows[0];
      if (!order) {
        logger.warn(
          { stripeSessionId, orderId },
          "Order not found for checkout session",
        );
        await pool.query("COMMIT");
        return res.json({ received: true });
      }

      if (order.status === "paid") {
        await pool.query("COMMIT");
        return res.json({ received: true });
      }

      const items = await pool.query<{
        ticket_tier_id: string;
        qty: number;
        unit_price_cents: number;
      }>(
        "SELECT ticket_tier_id, qty, unit_price_cents FROM order_items WHERE order_id = $1",
        [order.id],
      );

      // Mark order paid
      await pool.query(
        "UPDATE orders SET status = 'paid' WHERE id = $1 AND status = 'pending'",
        [order.id],
      );

      // Lookup organizer + amount for finance ledger
      const orderInfo = await pool.query<{
        amount: number;
        currency: string;
        organizer_id: string;
      }>(
        `SELECT o.amount_total_cents AS amount, o.currency, e.organizer_id
       FROM orders o JOIN events e ON e.id = o.event_id WHERE o.id = $1`,
        [order.id],
      );
      const info = orderInfo.rows[0];
      if (info) {
        const settings = await pool.query<{
          platform_commission_bps: number;
          payment_processing_bps: number;
          payment_processing_flat_cents: number;
        }>(
          `SELECT platform_commission_bps, payment_processing_bps, payment_processing_flat_cents
         FROM finance_settings WHERE id = 1`,
        );
        const s = settings.rows[0] ?? {
          platform_commission_bps: 1000,
          payment_processing_bps: 290,
          payment_processing_flat_cents: 30,
        };
        const breakdown = calculateCommission(info.amount, s);
        const commission = breakdown.commission_cents;
        const processing = breakdown.processing_fee_cents;
        const net = breakdown.organizer_net_cents;

        await pool.query(
          `INSERT INTO settlements(order_id, organizer_id, gross_cents, commission_cents,
                                 processing_fee_cents, refund_cents, net_organizer_cents)
         VALUES ($1,$2,$3,$4,$5,0,$6)
         ON CONFLICT (order_id) DO NOTHING`,
          [
            order.id,
            info.organizer_id,
            info.amount,
            commission,
            processing,
            net,
          ],
        );

        await pool.query(
          `INSERT INTO ledger_entries(order_id, organizer_id, entry_type, amount_cents, currency, description)
         VALUES ($1,$2,'sale',$3,$4,'Order paid')`,
          [order.id, info.organizer_id, info.amount, info.currency],
        );
        await pool.query(
          `INSERT INTO ledger_entries(order_id, organizer_id, entry_type, amount_cents, currency, description)
         VALUES ($1,$2,'commission', -$3, $4, 'Platform commission')`,
          [order.id, info.organizer_id, commission, info.currency],
        );
        await pool.query(
          `INSERT INTO ledger_entries(order_id, organizer_id, entry_type, amount_cents, currency, description)
         VALUES ($1,$2,'processing_fee', -$3, $4, 'Payment processing fee')`,
          [order.id, info.organizer_id, processing, info.currency],
        );

        // Track purchase interaction for analytics & recommendations.
        await pool.query(
          `INSERT INTO user_event_interactions(user_id, event_id, interaction_type, source)
         VALUES ($1, $2, 'purchase', 'checkout')`,
          [order.user_id, order.event_id],
        );

        // Tie attribution to the most recent sent campaign for this user (best-effort).
        await pool.query(
          `UPDATE campaign_sends SET status = 'converted', converted_at = now(), attributed_order_id = $1
         WHERE id = (
           SELECT id FROM campaign_sends
            WHERE user_id = $2 AND status IN ('sent','delivered','opened','clicked')
              AND sent_at > now() - interval '30 days'
            ORDER BY COALESCE(clicked_at, opened_at, sent_at) DESC LIMIT 1
         )`,
          [order.id, order.user_id],
        );
      }

      // Decrement inventory & issue tickets atomically.
      for (const item of items.rows) {
        const inv = await pool.query(
          "UPDATE ticket_tiers SET remaining_qty = remaining_qty - $1 WHERE id = $2 AND remaining_qty >= $1",
          [item.qty, item.ticket_tier_id],
        );
        if (inv.rowCount !== 1) {
          throw new Error(
            `Inventory decrement failed for tier ${item.ticket_tier_id}`,
          );
        }

        await pool.query(
          `
          INSERT INTO tickets(order_id, event_id, user_id)
          SELECT $1, $2, $3
          FROM generate_series(1, $4)
        `,
          [order.id, order.event_id, order.user_id, item.qty],
        );
      }

      await pool.query("COMMIT");
      return res.json({ received: true });
    } catch (err) {
      await pool.query("ROLLBACK");
      logger.error({ err }, "Stripe webhook handling failed");
      return res.status(500).json({ error: "Webhook handler failed" });
    }
  },
);

export default router;
