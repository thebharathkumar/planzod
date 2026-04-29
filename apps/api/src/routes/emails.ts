import { Router } from "express";
import { z } from "zod";
import {
  renderOrderConfirmation,
  renderOrganizerSummary,
  renderWaitlistReward,
  renderWaitlistWelcome
} from "../email/templates";
import { sendEmail } from "../email/sender";
import { HttpError } from "../utils/http";

const router = Router();

const previewSchema = z.object({
  type: z.enum(["order", "organizer", "waitlist_welcome", "waitlist_reward"]),
  payload: z.record(z.any()).optional()
});

router.post("/preview", (req, res) => {
  const body = previewSchema.parse(req.body);
  if (body.type === "order") {
    const template = renderOrderConfirmation({
      attendeeEmail: "demo@planzo.app",
      eventTitle: "Local Creative Lab",
      startsAt: new Date().toISOString(),
      venueName: "Downtown Studio",
      ticketCount: 2,
      ...(body.payload ?? {})
    });
    return res.json(template);
  }

  if (body.type === "waitlist_welcome") {
    const template = renderWaitlistWelcome({
      referralLink: "https://planzo.app/waitlist?ref=demo",
      ...(body.payload ?? {})
    });
    return res.json(template);
  }

  if (body.type === "waitlist_reward") {
    const template = renderWaitlistReward({
      tier: "Gold",
      referrals: 8,
      ...(body.payload ?? {})
    });
    return res.json(template);
  }

  const template = renderOrganizerSummary({
    organizerName: "Planzo Demo Organizer",
    eventTitle: "Local Creative Lab",
    ticketsSold: 34,
    ...(body.payload ?? {})
  });
  return res.json(template);
});

const sendSchema = z.object({
  to: z.string().email(),
  type: z.enum(["order", "organizer", "waitlist_welcome", "waitlist_reward"]),
  payload: z.record(z.any()).optional()
});

router.post("/send", async (req, res) => {
  const body = sendSchema.parse(req.body);
  try {
    const template =
      body.type === "order"
        ? renderOrderConfirmation({
            attendeeEmail: body.to,
            eventTitle: "Local Creative Lab",
            startsAt: new Date().toISOString(),
            venueName: "Downtown Studio",
            ticketCount: 1,
            ...(body.payload ?? {})
          })
        : body.type === "waitlist_welcome"
        ? renderWaitlistWelcome({
            referralLink: "https://planzo.app/waitlist?ref=demo",
            ...(body.payload ?? {})
          })
        : body.type === "waitlist_reward"
        ? renderWaitlistReward({
            tier: "Gold",
            referrals: 8,
            ...(body.payload ?? {})
          })
        : renderOrganizerSummary({
            organizerName: "Planzo Demo Organizer",
            eventTitle: "Local Creative Lab",
            ticketsSold: 42,
            ...(body.payload ?? {})
          });

    await sendEmail({ to: body.to, subject: template.subject, html: template.html });
    return res.json({ ok: true });
  } catch (err: any) {
    throw new HttpError(501, err?.message ?? "Email sending not configured");
  }
});

export default router;
