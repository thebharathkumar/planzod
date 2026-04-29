import express, { Router } from "express";
import Stripe from "stripe";
import { pool } from "../db/pool";
import { env } from "../env";
import { getStripe } from "../stripe/client";
import { logger } from "../logger";

const router = Router();

router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    return res.status(501).json({ error: "Stripe webhook not configured" });
  }

  const stripe = getStripe();
  const sig = req.header("stripe-signature");
  if (!sig) return res.status(400).json({ error: "Missing stripe-signature header" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
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
      [event.id]
    );
    if (dedupe.rowCount === 0) {
      await pool.query("ROLLBACK");
      return res.json({ received: true, duplicate: true });
    }

    const orderRes = orderId
      ? await pool.query<{ id: string; user_id: string; event_id: string; status: string }>(
          "SELECT id, user_id, event_id, status FROM orders WHERE id = $1",
          [orderId]
        )
      : await pool.query<{ id: string; user_id: string; event_id: string; status: string }>(
          "SELECT id, user_id, event_id, status FROM orders WHERE stripe_session_id = $1",
          [stripeSessionId]
        );

    const order = orderRes.rows[0];
    if (!order) {
      logger.warn({ stripeSessionId, orderId }, "Order not found for checkout session");
      await pool.query("COMMIT");
      return res.json({ received: true });
    }

    if (order.status === "paid") {
      await pool.query("COMMIT");
      return res.json({ received: true });
    }

    const items = await pool.query<{ ticket_tier_id: string; qty: number; unit_price_cents: number }>(
      "SELECT ticket_tier_id, qty, unit_price_cents FROM order_items WHERE order_id = $1",
      [order.id]
    );

    // Mark order paid
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1 AND status = 'pending'", [order.id]);

    // Decrement inventory & issue tickets atomically.
    for (const item of items.rows) {
      const inv = await pool.query(
        "UPDATE ticket_tiers SET remaining_qty = remaining_qty - $1 WHERE id = $2 AND remaining_qty >= $1",
        [item.qty, item.ticket_tier_id]
      );
      if (inv.rowCount !== 1) {
        throw new Error(`Inventory decrement failed for tier ${item.ticket_tier_id}`);
      }

      await pool.query(
        `
          INSERT INTO tickets(order_id, event_id, user_id)
          SELECT $1, $2, $3
          FROM generate_series(1, $4)
        `,
        [order.id, order.event_id, order.user_id, item.qty]
      );
    }

    await pool.query("COMMIT");
    return res.json({ received: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    logger.error({ err }, "Stripe webhook handling failed");
    return res.status(500).json({ error: "Webhook handler failed" });
  }
});

export default router;

