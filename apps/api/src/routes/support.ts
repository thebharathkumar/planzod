import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../utils/http";

const router = Router();

const ticketSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(3).max(180),
  category: z
    .enum(["general", "billing", "event", "technical", "feedback"])
    .default("general"),
  message: z.string().min(10).max(5000),
});

// Public endpoint: anyone can contact support, even unauthenticated users.
router.post("/", async (req, res) => {
  const body = ticketSchema.parse(req.body);
  const userId = req.user?.id ?? null;

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO support_tickets(user_id, email, subject, category, message)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [userId, body.email, body.subject, body.category, body.message],
  );
  const ticketId = rows[0].id;

  await pool.query(
    `INSERT INTO support_messages(ticket_id, author_user_id, author_role, body)
     VALUES ($1,$2,'user',$3)`,
    [ticketId, userId, body.message],
  );

  res.status(201).json({ ticketId });
});

router.get("/mine", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query(
    `SELECT id, subject, category, status, created_at, updated_at
     FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  res.json({ tickets: rows });
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = z.string().uuid().parse(req.params.id);
  const ticket = await pool.query(
    `SELECT id, user_id, email, subject, category, status, created_at, updated_at
     FROM support_tickets WHERE id = $1`,
    [id],
  );
  const t = ticket.rows[0];
  if (!t) throw new HttpError(404, "Ticket not found");
  if (req.user!.role !== "admin" && t.user_id !== userId)
    throw new HttpError(403, "Forbidden");

  const messages = await pool.query(
    `SELECT id, author_role, body, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  res.json({ ticket: t, messages: messages.rows });
});

const replySchema = z.object({ body: z.string().min(1).max(5000) });

router.post("/:id/reply", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = z.string().uuid().parse(req.params.id);
  const { body } = replySchema.parse(req.body);

  const t = await pool.query<{ user_id: string | null }>(
    "SELECT user_id FROM support_tickets WHERE id = $1",
    [id],
  );
  const ticket = t.rows[0];
  if (!ticket) throw new HttpError(404, "Ticket not found");
  const isAdmin = req.user!.role === "admin";
  if (!isAdmin && ticket.user_id !== userId)
    throw new HttpError(403, "Forbidden");

  await pool.query(
    `INSERT INTO support_messages(ticket_id, author_user_id, author_role, body) VALUES ($1,$2,$3,$4)`,
    [id, userId, isAdmin ? "agent" : "user", body],
  );
  if (isAdmin) {
    await pool.query(
      "UPDATE support_tickets SET status = 'in_progress' WHERE id = $1 AND status = 'open'",
      [id],
    );
  }
  res.status(201).json({ ok: true });
});

const adminListSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

router.get("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  const q = adminListSchema.parse(req.query);
  const { rows } = await pool.query(
    `SELECT t.id, t.email, t.subject, t.category, t.status, t.created_at,
            (SELECT body FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message
     FROM support_tickets t
     ${q.status ? "WHERE t.status = $1" : ""}
     ORDER BY t.created_at DESC LIMIT ${q.limit}`,
    q.status ? [q.status] : [],
  );
  res.json({ tickets: rows });
});

const statusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

router.post(
  "/:id/status",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { status } = statusSchema.parse(req.body);
    const userId = req.user!.id;

    const { rowCount } = await pool.query(
      "UPDATE support_tickets SET status = $1, assignee_user_id = $2 WHERE id = $3",
      [status, userId, id],
    );
    if (!rowCount) throw new HttpError(404, "Ticket not found");
    await pool.query(
      `INSERT INTO support_messages(ticket_id, author_user_id, author_role, body)
     VALUES ($1,$2,'system',$3)`,
      [id, userId, `Status changed to ${status}`],
    );
    res.json({ ok: true });
  },
);

export default router;
