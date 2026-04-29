import { Router } from "express";
import { z } from "zod";
import { generateEventCopy, generateEventName, generateTicketTiers } from "../ai/generator";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const eventSchema = z.object({
  title: z.string().min(2),
  category: z.string().optional(),
  audience: z.string().optional(),
  lengthMinutes: z.number().int().min(30).max(360).optional(),
  seed: z.string().optional()
});

router.post("/event-copy", requireAuth, requireRole(["organizer", "admin"]), (req, res) => {
  const body = eventSchema.parse(req.body);
  const result = generateEventCopy(body);
  res.json(result);
});

const nameSchema = z.object({
  seed: z.string().min(2)
});

router.post("/event-name", requireAuth, requireRole(["organizer", "admin"]), (req, res) => {
  const body = nameSchema.parse(req.body);
  res.json({ title: generateEventName(body.seed) });
});

const titleRewriteSchema = z.object({
  title: z.string().min(2),
  vibe: z.string().optional()
});

router.post("/event-title-rewrite", requireAuth, requireRole(["organizer", "admin"]), (req, res) => {
  const body = titleRewriteSchema.parse(req.body);
  const seed = `${body.title}-${body.vibe ?? "pro"}`;
  const candidate = generateEventName(seed);
  res.json({
    variants: [
      candidate,
      `${body.title} — ${body.vibe ?? "Premium"}`.trim(),
      `${body.title} (${body.vibe ?? "Curated"})`
    ]
  });
});

const tiersSchema = z.object({
  seed: z.string().min(2)
});

router.post("/ticket-tiers", requireAuth, requireRole(["organizer", "admin"]), (req, res) => {
  const body = tiersSchema.parse(req.body);
  res.json({ tiers: generateTicketTiers(body.seed) });
});

export default router;
