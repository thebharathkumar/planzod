import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { signTicketQr } from "../tickets/qr";

const router = Router();

router.get("/orders", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query(
    `
      SELECT id, event_id, status, amount_total_cents, refund_amount_cents, currency, created_at
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [userId],
  );
  res.json({ orders: rows });
});

// 02.09 Booking history with line items + status.
router.get("/bookings", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .parse(req.query.limit);

  const orders = await pool.query<{
    id: string;
    event_id: string;
    event_title: string;
    starts_at: string;
    venue_name: string;
    status: string;
    amount_total_cents: number;
    refund_amount_cents: number;
    currency: string;
    created_at: string;
  }>(
    `SELECT o.id, o.event_id, e.title AS event_title, e.starts_at,
            v.name AS venue_name,
            o.status, o.amount_total_cents, o.refund_amount_cents, o.currency, o.created_at
     FROM orders o
     JOIN events e ON e.id = o.event_id
     JOIN venues v ON v.id = e.venue_id
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  if (orders.rows.length === 0) return res.json({ bookings: [] });

  const ids = orders.rows.map((o) => o.id);
  const items = await pool.query<{
    order_id: string;
    name: string;
    qty: number;
    unit_price_cents: number;
  }>(
    `SELECT oi.order_id, tt.name, oi.qty, oi.unit_price_cents
     FROM order_items oi JOIN ticket_tiers tt ON tt.id = oi.ticket_tier_id
     WHERE oi.order_id = ANY($1::uuid[])`,
    [ids],
  );

  const ticketsRows = await pool.query<{
    order_id: string;
    ticket_id: string;
    status: string;
    event_id: string;
  }>(
    `SELECT order_id, id AS ticket_id, status, event_id
     FROM tickets WHERE order_id = ANY($1::uuid[])`,
    [ids],
  );

  const itemsByOrder = new Map<string, typeof items.rows>();
  for (const item of items.rows) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id)!.push(item);
  }
  const ticketsByOrder = new Map<
    string,
    { id: string; status: string; qrPayload: string }[]
  >();
  for (const t of ticketsRows.rows) {
    if (!ticketsByOrder.has(t.order_id)) ticketsByOrder.set(t.order_id, []);
    ticketsByOrder.get(t.order_id)!.push({
      id: t.ticket_id,
      status: t.status,
      qrPayload: signTicketQr(t.ticket_id, t.event_id),
    });
  }

  const bookings = orders.rows.map((o) => ({
    id: o.id,
    event: {
      id: o.event_id,
      title: o.event_title,
      startsAt: o.starts_at,
      venueName: o.venue_name,
    },
    status: o.status,
    amountTotalCents: o.amount_total_cents,
    refundAmountCents: o.refund_amount_cents,
    currency: o.currency,
    createdAt: o.created_at,
    items: itemsByOrder.get(o.id) ?? [],
    tickets: ticketsByOrder.get(o.id) ?? [],
  }));

  res.json({ bookings });
});

router.get("/tickets", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query<{
    ticket_id: string;
    ticket_status: string;
    event_id: string;
    event_title: string;
    starts_at: string;
    ends_at: string;
    venue_name: string;
    venue_address: string | null;
    order_status: string;
  }>(
    `
      SELECT
        t.id AS ticket_id,
        t.status AS ticket_status,
        e.id AS event_id,
        e.title AS event_title,
        e.starts_at,
        e.ends_at,
        v.name AS venue_name,
        v.address AS venue_address,
        o.status AS order_status
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      JOIN events e ON e.id = t.event_id
      JOIN venues v ON v.id = e.venue_id
      WHERE t.user_id = $1
      ORDER BY e.starts_at ASC, t.created_at ASC
      LIMIT 200
    `,
    [userId],
  );

  const tickets = rows.map((r) => ({
    id: r.ticket_id,
    status: r.ticket_status,
    event: {
      id: r.event_id,
      title: r.event_title,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      venueName: r.venue_name,
      venueAddress: r.venue_address,
    },
    orderStatus: r.order_status,
    qrPayload: signTicketQr(r.ticket_id, r.event_id),
  }));

  res.json({ tickets });
});

export default router;
