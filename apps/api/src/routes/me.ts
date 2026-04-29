import { Router } from "express";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { signTicketQr } from "../tickets/qr";

const router = Router();

router.get("/orders", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query(
    `
      SELECT id, event_id, status, amount_total_cents, currency, created_at
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [userId]
  );
  res.json({ orders: rows });
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
    [userId]
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
      venueAddress: r.venue_address
    },
    orderStatus: r.order_status,
    qrPayload: signTicketQr(r.ticket_id, r.event_id)
  }));

  res.json({ tickets });
});

export default router;

