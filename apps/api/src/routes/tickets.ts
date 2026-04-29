import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { verifyTicketQr } from "../tickets/qr";
import { HttpError } from "../utils/http";
import { requireOrganizerId } from "./organizer";

const router = Router();

const validateSchema = z.object({
  qrPayload: z.string().min(1)
});

router.post("/validate", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const body = validateSchema.parse(req.body);

  let ticketId: string;
  let eventId: string;
  try {
    ({ ticketId, eventId } = verifyTicketQr(body.qrPayload));
  } catch {
    throw new HttpError(400, "Invalid QR payload");
  }

  const ticketRes = await pool.query<{
    id: string;
    status: string;
    attendee_email: string;
    event_id: string;
  }>(
    `
      SELECT
        t.id,
        t.status,
        u.email AS attendee_email,
        e.id AS event_id
      FROM tickets t
      JOIN users u ON u.id = t.user_id
      JOIN events e ON e.id = t.event_id
      WHERE t.id = $1 AND e.id = $2 AND e.organizer_id = $3
    `,
    [ticketId, eventId, organizerId]
  );
  const ticket = ticketRes.rows[0];
  if (!ticket) return res.json({ status: "invalid" as const });
  if (ticket.status !== "issued") return res.json({ status: "voided" as const, ticketId, eventId });

  const usedRes = await pool.query("SELECT 1 FROM checkins WHERE ticket_id = $1", [ticket.id]);
  if (usedRes.rowCount === 1) {
    return res.json({ status: "used" as const, ticketId, eventId, attendeeEmail: ticket.attendee_email });
  }

  return res.json({ status: "valid" as const, ticketId, eventId, attendeeEmail: ticket.attendee_email });
});

router.post("/:ticketId/checkin", requireAuth, requireRole(["organizer", "admin"]), async (req, res) => {
  const userId = req.user!.id;
  const organizerId = await requireOrganizerId(userId);
  const ticketId = z.string().uuid().parse(req.params.ticketId);

  const ticketRes = await pool.query<{ id: string; event_id: string; status: string }>(
    `
      SELECT t.id, t.event_id, t.status
      FROM tickets t
      JOIN events e ON e.id = t.event_id
      WHERE t.id = $1 AND e.organizer_id = $2
    `,
    [ticketId, organizerId]
  );
  const ticket = ticketRes.rows[0];
  if (!ticket) throw new HttpError(404, "Ticket not found");
  if (ticket.status !== "issued") throw new HttpError(400, "Ticket is voided");

  const insert = await pool.query<{ id: string }>(
    `
      INSERT INTO checkins(ticket_id, event_id, checked_in_by_user_id)
      VALUES ($1,$2,$3)
      ON CONFLICT (ticket_id) DO NOTHING
      RETURNING id
    `,
    [ticket.id, ticket.event_id, userId]
  );

  if (insert.rowCount === 0) return res.json({ status: "already_checked_in" as const });
  return res.json({ status: "checked_in" as const });
});

export default router;
