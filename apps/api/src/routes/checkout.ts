import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";
import { getStripe } from "../stripe/client";
import { HttpError } from "../utils/http";

const router = Router();

const createSessionSchema = z.object({
  ticketTierId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).default(1)
});

router.post("/create-session", requireAuth, async (req, res) => {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(501, "Stripe is not configured");
  const stripe = getStripe();

  const body = createSessionSchema.parse(req.body);
  const userId = req.user!.id;

  const tierRes = await pool.query<{
    ticket_tier_id: string;
    tier_name: string;
    price_cents: number;
    currency: string;
    remaining_qty: number;
    sales_start: string;
    sales_end: string | null;
    event_id: string;
    event_title: string;
    event_status: string;
  }>(
    `
      SELECT
        tt.id AS ticket_tier_id,
        tt.name AS tier_name,
        tt.price_cents,
        tt.currency,
        tt.remaining_qty,
        tt.sales_start,
        tt.sales_end,
        e.id AS event_id,
        e.title AS event_title,
        e.status AS event_status
      FROM ticket_tiers tt
      JOIN events e ON e.id = tt.event_id
      WHERE tt.id = $1
    `,
    [body.ticketTierId]
  );
  const tier = tierRes.rows[0];
  if (!tier) throw new HttpError(404, "Ticket tier not found");
  if (tier.event_status !== "published") throw new HttpError(400, "Event is not published");
  if (tier.remaining_qty < body.quantity) throw new HttpError(400, "Not enough tickets remaining");

  const now = Date.now();
  const salesStart = new Date(tier.sales_start).getTime();
  const salesEnd = tier.sales_end ? new Date(tier.sales_end).getTime() : null;
  if (now < salesStart) throw new HttpError(400, "Ticket sales have not started");
  if (salesEnd !== null && now > salesEnd) throw new HttpError(400, "Ticket sales have ended");

  const amountTotalCents = tier.price_cents * body.quantity;

  await pool.query("BEGIN");
  try {
    const orderRes = await pool.query<{ id: string }>(
      `
        INSERT INTO orders(event_id, user_id, status, amount_total_cents, currency)
        VALUES ($1,$2,'pending',$3,$4)
        RETURNING id
      `,
      [tier.event_id, userId, amountTotalCents, tier.currency]
    );
    const orderId = orderRes.rows[0].id;

    await pool.query(
      `
        INSERT INTO order_items(order_id, ticket_tier_id, qty, unit_price_cents)
        VALUES ($1,$2,$3,$4)
      `,
      [orderId, tier.ticket_tier_id, body.quantity, tier.price_cents]
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: tier.currency,
            unit_amount: tier.price_cents,
            product_data: {
              name: `${tier.event_title} — ${tier.tier_name}`
            }
          },
          quantity: body.quantity
        }
      ],
      success_url: `${env.WEB_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.WEB_BASE_URL}/events/${tier.event_id}`,
      metadata: {
        orderId
      }
    });

    await pool.query("UPDATE orders SET stripe_session_id = $1 WHERE id = $2", [session.id, orderId]);

    await pool.query("COMMIT");
    res.status(201).json({ stripeCheckoutUrl: session.url, orderId });
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
});

export default router;

