import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../utils/http";
import { requireOrganizerId } from "./organizer";

const router = Router();

const tierSchema = z.object({
  name: z.string().min(1).max(80),
  priceCents: z.number().int().min(0),
  currency: z.string().min(3).max(10).default("usd"),
  totalQty: z.number().int().min(0),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional().nullable()
});

router.post("/events/:eventId/ticket-tiers", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const eventId = z.string().uuid().parse(req.params.eventId);
  const body = tierSchema.parse(req.body);

  const ownership = await pool.query<{ id: string }>(
    "SELECT id FROM events WHERE id = $1 AND organizer_id = $2",
    [eventId, organizerId]
  );
  if (!ownership.rows[0]) throw new HttpError(404, "Event not found");

  const salesStart = body.salesStart ? new Date(body.salesStart) : new Date();
  const salesEnd = body.salesEnd ? new Date(body.salesEnd) : null;
  if (salesEnd && !(salesEnd > salesStart)) throw new HttpError(400, "salesEnd must be after salesStart");

  const { rows } = await pool.query<{ id: string }>(
    `
      INSERT INTO ticket_tiers(event_id, name, price_cents, currency, total_qty, remaining_qty, sales_start, sales_end)
      VALUES ($1,$2,$3,$4,$5,$5,$6,$7)
      RETURNING id
    `,
    [
      eventId,
      body.name,
      body.priceCents,
      body.currency,
      body.totalQty,
      salesStart.toISOString(),
      salesEnd ? salesEnd.toISOString() : null
    ]
  );

  res.status(201).json({ ticketTierId: rows[0].id });
});

router.put("/ticket-tiers/:tierId", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const tierId = z.string().uuid().parse(req.params.tierId);
  const body = tierSchema.parse(req.body);

  const tier = await pool.query<{ event_id: string; remaining_qty: number }>(
    `
      SELECT tt.event_id, tt.remaining_qty, tt.total_qty, tt.sales_start, tt.sales_end
      FROM ticket_tiers tt
      JOIN events e ON e.id = tt.event_id
      WHERE tt.id = $1 AND e.organizer_id = $2
    `,
    [tierId, organizerId]
  );
  if (!tier.rows[0]) throw new HttpError(404, "Ticket tier not found");

  const current = tier.rows[0] as unknown as {
    event_id: string;
    remaining_qty: number;
    total_qty: number;
    sales_start: string;
    sales_end: string | null;
  };

  const salesStartDate = body.salesStart ? new Date(body.salesStart) : new Date(current.sales_start);
  const salesEndDate =
    body.salesEnd === undefined ? (current.sales_end ? new Date(current.sales_end) : null) : body.salesEnd ? new Date(body.salesEnd) : null;
  const salesEndIso = salesEndDate ? salesEndDate.toISOString() : body.salesEnd === undefined ? current.sales_end : null;

  if (salesEndDate && !(salesEndDate > salesStartDate)) throw new HttpError(400, "salesEnd must be after salesStart");

  const sold = current.total_qty - current.remaining_qty;
  if (body.totalQty < sold) throw new HttpError(400, "totalQty cannot be less than tickets already sold");
  const newRemaining = body.totalQty - sold;

  await pool.query(
    `
      UPDATE ticket_tiers
      SET name = $1,
          price_cents = $2,
          currency = $3,
          total_qty = $4,
          remaining_qty = $5,
          sales_start = $6,
          sales_end = $7
      WHERE id = $8
    `,
    [
      body.name,
      body.priceCents,
      body.currency,
      body.totalQty,
      newRemaining,
      salesStartDate.toISOString(),
      salesEndIso,
      tierId
    ]
  );

  res.json({ ok: true });
});

router.delete("/ticket-tiers/:tierId", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const tierId = z.string().uuid().parse(req.params.tierId);

  const { rowCount } = await pool.query(
    `
      DELETE FROM ticket_tiers tt
      USING events e
      WHERE tt.id = $1
        AND tt.event_id = e.id
        AND e.organizer_id = $2
    `,
    [tierId, organizerId]
  );
  if (!rowCount) throw new HttpError(404, "Ticket tier not found");

  res.status(204).send();
});

export default router;
