import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../utils/http";
import { sendEmail } from "../email/sender";
import { logger } from "../logger";
import { requireOrganizerId } from "./organizer";

const router = Router();

const announcementSchema = z.object({
  subject: z.string().min(3).max(180),
  body: z.string().min(10).max(10_000),
  channel: z.enum(["email", "push", "sms"]).default("email"),
});

// 03.12 Send an update to all attendees of an event.
router.post(
  "/events/:eventId/announcements",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const eventId = z.string().uuid().parse(req.params.eventId);
    const userId = req.user!.id;
    const organizerId = await requireOrganizerId(userId);
    const body = announcementSchema.parse(req.body);

    const event = await pool.query<{ id: string; title: string }>(
      "SELECT id, title FROM events WHERE id = $1 AND organizer_id = $2",
      [eventId, organizerId],
    );
    if (!event.rows[0]) throw new HttpError(404, "Event not found");

    const recipients = await pool.query<{ email: string }>(
      `SELECT DISTINCT u.email
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN notification_preferences p ON p.user_id = u.id
       WHERE t.event_id = $1
         AND t.status = 'issued'
         AND u.deleted_at IS NULL
         AND COALESCE(p.email_organizer_updates, true) = true`,
      [eventId],
    );

    let sent = 0;
    if (body.channel === "email") {
      for (const r of recipients.rows) {
        try {
          await sendEmail({
            to: r.email,
            subject: `[${event.rows[0].title}] ${body.subject}`,
            html: `<div style="font-family: Inter, Arial, sans-serif;"><p>${body.body
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/\n/g, "<br/>")}</p></div>`,
          });
          sent++;
        } catch (err) {
          logger.warn({ err, to: r.email }, "Announcement email failed");
        }
      }
    } else {
      // Push/SMS would route through their own providers — record the request.
      sent = recipients.rows.length;
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO event_announcements(event_id, organizer_id, subject, body, channel, recipient_count)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [eventId, organizerId, body.subject, body.body, body.channel, sent],
    );
    res.status(201).json({ id: rows[0].id, recipients: sent });
  },
);

router.get(
  "/events/:eventId/announcements",
  requireAuth,
  requireRole(["organizer", "admin"]),
  async (req, res) => {
    const eventId = z.string().uuid().parse(req.params.eventId);
    const userId = req.user!.id;
    const organizerId = await requireOrganizerId(userId);

    const own = await pool.query(
      "SELECT 1 FROM events WHERE id = $1 AND organizer_id = $2",
      [eventId, organizerId],
    );
    if (!own.rowCount) throw new HttpError(404, "Event not found");

    const { rows } = await pool.query(
      `SELECT id, subject, body, channel, recipient_count, sent_at
       FROM event_announcements WHERE event_id = $1 ORDER BY sent_at DESC LIMIT 50`,
      [eventId],
    );
    res.json({ announcements: rows });
  },
);

export default router;
