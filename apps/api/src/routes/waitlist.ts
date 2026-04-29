import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { pool } from "../db/pool";
import { env } from "../env";
import { HttpError } from "../utils/http";
import { renderWaitlistReward } from "../email/templates";
import { sendEmail } from "../email/sender";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  referralCode: z.string().optional()
});

function generateCode() {
  return crypto.randomBytes(6).toString("hex");
}

function computeTier(referrals: number) {
  if (referrals >= 15) return "Platinum";
  if (referrals >= 8) return "Gold";
  if (referrals >= 4) return "Silver";
  return "Bronze";
}

router.post("/", async (req, res) => {
  const body = signupSchema.parse(req.body);

  const existing = await pool.query<{ referral_code: string }>(
    "SELECT referral_code FROM waitlist_signups WHERE email = $1",
    [body.email]
  );
  if (existing.rows[0]) {
    return res.json({
      referralCode: existing.rows[0].referral_code,
      referralLink: `${env.WEB_BASE_URL}/waitlist?ref=${existing.rows[0].referral_code}`
    });
  }

  let referralCode = generateCode();
  let inserted = false;
  let attempts = 0;
  while (!inserted && attempts < 5) {
    attempts += 1;
    try {
      await pool.query(
        `
          INSERT INTO waitlist_signups(email, referral_code, referred_by)
          VALUES ($1, $2, $3)
        `,
        [body.email, referralCode, body.referralCode ?? null]
      );
      inserted = true;
    } catch (err: any) {
      if (err?.code === "23505") {
        referralCode = generateCode();
        continue;
      }
      throw err;
    }
  }
  if (!inserted) throw new HttpError(500, "Failed to generate referral code");

  const referralLink = `${env.WEB_BASE_URL}/waitlist?ref=${referralCode}`;
  // If referred, check referrer tier and notify on upgrade (best-effort).
  if (body.referralCode) {
    try {
      const referrerRes = await pool.query<{ email: string; last_notified_tier: string | null }>(
        "SELECT email, last_notified_tier FROM waitlist_signups WHERE referral_code = $1",
        [body.referralCode]
      );
      const referrer = referrerRes.rows[0];
      if (referrer) {
        const { rows: countRows } = await pool.query<{ referrals: number }>(
          "SELECT COUNT(*)::int AS referrals FROM waitlist_signups WHERE referred_by = $1",
          [body.referralCode]
        );
        const referrals = countRows[0]?.referrals ?? 0;
        const tier = computeTier(referrals);
        if (referrer.last_notified_tier !== tier) {
          const template = renderWaitlistReward({ tier, referrals });
          await sendEmail({ to: referrer.email, subject: template.subject, html: template.html });
          await pool.query(
            "UPDATE waitlist_signups SET last_notified_tier = $1, reward_sent_at = now() WHERE referral_code = $2",
            [tier, body.referralCode]
          );
        }
      }
    } catch {
      // Best-effort: ignore email failures.
    }
  }

  res.status(201).json({
    referralCode,
    referralLink
  });
});

router.get("/status", async (req, res) => {
  const email = z.string().email().parse(req.query.email);
  const { rows } = await pool.query<{ referral_code: string }>(
    "SELECT referral_code FROM waitlist_signups WHERE email = $1",
    [email]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Not found" });

  const { rows: countRows } = await pool.query<{ referrals: number }>(
    `
      SELECT COUNT(*)::int AS referrals
      FROM waitlist_signups
      WHERE referred_by = $1
    `,
    [row.referral_code]
  );
  const referrals = countRows[0]?.referrals ?? 0;
  const tier = computeTier(referrals);

  res.json({
    referralCode: row.referral_code,
    referrals,
    tier,
    referralLink: `${env.WEB_BASE_URL}/waitlist?ref=${row.referral_code}`
  });
});

router.get("/leaderboard", async (_req, res) => {
  const { rows } = await pool.query<{ referral_code: string; referrals: number }>(
    `
      SELECT w.referral_code, COUNT(r.id)::int AS referrals
      FROM waitlist_signups w
      LEFT JOIN waitlist_signups r ON r.referred_by = w.referral_code
      GROUP BY w.referral_code
      ORDER BY referrals DESC
      LIMIT 10
    `
  );
  const leaders = rows.map((row) => {
    const referrals = row.referrals ?? 0;
    const tier = computeTier(referrals);
    return { ...row, tier };
  });
  res.json({ leaders });
});

const rewardSchema = z.object({
  email: z.string().email()
});

router.post("/rewards/send", async (req, res) => {
  const body = rewardSchema.parse(req.body);
  const { rows } = await pool.query<{ referral_code: string; last_notified_tier: string | null }>(
    "SELECT referral_code, last_notified_tier FROM waitlist_signups WHERE email = $1",
    [body.email]
  );
  const signup = rows[0];
  if (!signup) return res.status(404).json({ error: "Not found" });

  const { rows: countRows } = await pool.query<{ referrals: number }>(
    "SELECT COUNT(*)::int AS referrals FROM waitlist_signups WHERE referred_by = $1",
    [signup.referral_code]
  );
  const referrals = countRows[0]?.referrals ?? 0;
  const tier = referrals >= 15 ? "Platinum" : referrals >= 8 ? "Gold" : referrals >= 4 ? "Silver" : "Bronze";

  if (signup.last_notified_tier === tier) {
    return res.json({ ok: true, message: "Already notified for this tier" });
  }

  const template = renderWaitlistReward({ tier, referrals });
  try {
    await sendEmail({ to: body.email, subject: template.subject, html: template.html });
    await pool.query(
      "UPDATE waitlist_signups SET last_notified_tier = $1, reward_sent_at = now() WHERE email = $2",
      [tier, body.email]
    );
    return res.json({ ok: true, tier, referrals });
  } catch (err: any) {
    return res.status(501).json({ error: err?.message ?? "Email sending not configured" });
  }
});

export default router;
