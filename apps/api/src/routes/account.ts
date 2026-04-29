import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { sha256 } from "../utils/crypto";
import { HttpError } from "../utils/http";
import { logger } from "../logger";
import { env } from "../env";
import { sendEmail } from "../email/sender";

const router = Router();

// ── 01.04 Profile ─────────────────────────────────────────────────────

const profileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  marketingOptIn: z.boolean().optional(),
});

router.get("/profile", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.role, u.created_at,
            p.display_name, p.avatar_url, p.phone, p.bio, p.city, p.country, p.marketing_opt_in
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  res.json({ profile: rows[0] ?? null });
});

router.put("/profile", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const body = profileSchema.parse(req.body);

  await pool.query(
    `INSERT INTO user_profiles(user_id, display_name, avatar_url, phone, bio, city, country, marketing_opt_in)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8,true))
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
       avatar_url   = COALESCE(EXCLUDED.avatar_url,   user_profiles.avatar_url),
       phone        = COALESCE(EXCLUDED.phone,        user_profiles.phone),
       bio          = COALESCE(EXCLUDED.bio,          user_profiles.bio),
       city         = COALESCE(EXCLUDED.city,         user_profiles.city),
       country      = COALESCE(EXCLUDED.country,      user_profiles.country),
       marketing_opt_in = COALESCE(EXCLUDED.marketing_opt_in, user_profiles.marketing_opt_in)`,
    [
      userId,
      body.displayName ?? null,
      body.avatarUrl ?? null,
      body.phone ?? null,
      body.bio ?? null,
      body.city ?? null,
      body.country ?? null,
      body.marketingOptIn ?? null,
    ],
  );
  res.json({ ok: true });
});

// ── 01.05 Notification preferences ────────────────────────────────────

const notificationSchema = z.object({
  emailEventReminders: z.boolean().optional(),
  emailOrderReceipts: z.boolean().optional(),
  emailMarketing: z.boolean().optional(),
  emailOrganizerUpdates: z.boolean().optional(),
  pushEventReminders: z.boolean().optional(),
  pushMarketing: z.boolean().optional(),
  smsEventReminders: z.boolean().optional(),
});

router.get("/notifications", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query(
    `SELECT email_event_reminders, email_order_receipts, email_marketing, email_organizer_updates,
            push_event_reminders, push_marketing, sms_event_reminders
     FROM notification_preferences WHERE user_id = $1`,
    [userId],
  );
  res.json({
    preferences: rows[0] ?? {
      email_event_reminders: true,
      email_order_receipts: true,
      email_marketing: true,
      email_organizer_updates: true,
      push_event_reminders: true,
      push_marketing: false,
      sms_event_reminders: false,
    },
  });
});

router.put("/notifications", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const body = notificationSchema.parse(req.body);

  await pool.query(
    `INSERT INTO notification_preferences(
       user_id, email_event_reminders, email_order_receipts, email_marketing,
       email_organizer_updates, push_event_reminders, push_marketing, sms_event_reminders)
     VALUES ($1, COALESCE($2,true), COALESCE($3,true), COALESCE($4,true),
             COALESCE($5,true), COALESCE($6,true), COALESCE($7,false), COALESCE($8,false))
     ON CONFLICT (user_id) DO UPDATE SET
       email_event_reminders   = COALESCE(EXCLUDED.email_event_reminders,   notification_preferences.email_event_reminders),
       email_order_receipts    = COALESCE(EXCLUDED.email_order_receipts,    notification_preferences.email_order_receipts),
       email_marketing         = COALESCE(EXCLUDED.email_marketing,         notification_preferences.email_marketing),
       email_organizer_updates = COALESCE(EXCLUDED.email_organizer_updates, notification_preferences.email_organizer_updates),
       push_event_reminders    = COALESCE(EXCLUDED.push_event_reminders,    notification_preferences.push_event_reminders),
       push_marketing          = COALESCE(EXCLUDED.push_marketing,          notification_preferences.push_marketing),
       sms_event_reminders     = COALESCE(EXCLUDED.sms_event_reminders,     notification_preferences.sms_event_reminders)`,
    [
      userId,
      body.emailEventReminders ?? null,
      body.emailOrderReceipts ?? null,
      body.emailMarketing ?? null,
      body.emailOrganizerUpdates ?? null,
      body.pushEventReminders ?? null,
      body.pushMarketing ?? null,
      body.smsEventReminders ?? null,
    ],
  );
  res.json({ ok: true });
});

// ── 01.06 Saved payment methods ───────────────────────────────────────

const paymentMethodSchema = z.object({
  stripePaymentMethodId: z.string().min(1).max(120),
  stripeCustomerId: z.string().max(120).optional(),
  brand: z.string().max(40).optional(),
  last4: z
    .string()
    .regex(/^\d{2,4}$/)
    .optional(),
  expMonth: z.number().int().min(1).max(12).optional(),
  expYear: z.number().int().min(2024).max(2100).optional(),
  isDefault: z.boolean().optional(),
});

router.get("/payment-methods", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { rows } = await pool.query(
    `SELECT id, stripe_customer_id, stripe_payment_method_id, brand, last4,
            exp_month, exp_year, is_default, created_at
     FROM saved_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [userId],
  );
  res.json({ paymentMethods: rows });
});

router.post("/payment-methods", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const body = paymentMethodSchema.parse(req.body);

  await pool.query("BEGIN");
  try {
    if (body.isDefault) {
      await pool.query(
        "UPDATE saved_payment_methods SET is_default = false WHERE user_id = $1",
        [userId],
      );
    }
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO saved_payment_methods(
         user_id, stripe_customer_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8,false))
       ON CONFLICT (user_id, stripe_payment_method_id) DO UPDATE SET
         brand = EXCLUDED.brand,
         last4 = EXCLUDED.last4,
         exp_month = EXCLUDED.exp_month,
         exp_year = EXCLUDED.exp_year,
         is_default = EXCLUDED.is_default
       RETURNING id`,
      [
        userId,
        body.stripeCustomerId ?? null,
        body.stripePaymentMethodId,
        body.brand ?? null,
        body.last4 ?? null,
        body.expMonth ?? null,
        body.expYear ?? null,
        body.isDefault ?? null,
      ],
    );
    await pool.query("COMMIT");
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
});

router.delete("/payment-methods/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = z.string().uuid().parse(req.params.id);
  const { rowCount } = await pool.query(
    "DELETE FROM saved_payment_methods WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  if (!rowCount) throw new HttpError(404, "Payment method not found");
  res.status(204).send();
});

router.post("/payment-methods/:id/default", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = z.string().uuid().parse(req.params.id);
  await pool.query("BEGIN");
  try {
    await pool.query(
      "UPDATE saved_payment_methods SET is_default = false WHERE user_id = $1",
      [userId],
    );
    const { rowCount } = await pool.query(
      "UPDATE saved_payment_methods SET is_default = true WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
    if (!rowCount) {
      await pool.query("ROLLBACK");
      throw new HttpError(404, "Payment method not found");
    }
    await pool.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
});

// ── 01.03 Password recovery ───────────────────────────────────────────

const requestResetSchema = z.object({ email: z.string().email() });

router.post("/password/forgot", async (req, res) => {
  const { email } = requestResetSchema.parse(req.body);
  const userRes = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
    [email],
  );
  // Always 202 to avoid leaking which emails are registered.
  if (userRes.rows[0]) {
    const userId = userRes.rows[0].id;
    const token = randomBytes(32).toString("hex");
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      `INSERT INTO password_reset_tokens(user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
      [userId, tokenHash, expiresAt.toISOString()],
    );

    const link = `${env.WEB_BASE_URL ?? ""}/reset-password?token=${token}`;
    try {
      await sendEmail({
        to: email,
        subject: "Reset your Planzo password",
        html: `<p>Reset your password by clicking the link below (valid for 1 hour):</p>
               <p><a href="${link}">${link}</a></p>`,
      });
    } catch (err) {
      // Don't fail the request if email is unavailable in dev.
      logger.warn({ err }, "Password reset email send failed (continuing)");
    }
    if (process.env.NODE_ENV !== "production") {
      return res.status(202).json({ ok: true, devToken: token, devLink: link });
    }
  }
  res.status(202).json({ ok: true });
});

const resetSchema = z.object({
  token: z.string().min(16),
  newPassword: z.string().min(8).max(72),
});

router.post("/password/reset", async (req, res) => {
  const { token, newPassword } = resetSchema.parse(req.body);
  const tokenHash = sha256(token);
  const { rows } = await pool.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash],
  );
  const record = rows[0];
  if (!record) throw new HttpError(400, "Invalid or expired token");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query("BEGIN");
  try {
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      record.user_id,
    ]);
    await pool.query(
      "UPDATE password_reset_tokens SET used_at = now() WHERE id = $1",
      [record.id],
    );
    // Revoke all existing refresh tokens for safety.
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [record.user_id],
    );
    await pool.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
});

// ── 01.08 Delete account ──────────────────────────────────────────────

const deleteSchema = z.object({
  password: z.string().min(1),
  reason: z.string().max(500).optional(),
});

router.post("/delete", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const body = deleteSchema.parse(req.body);

  const { rows } = await pool.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId],
  );
  if (!rows[0]) throw new HttpError(404, "User not found");
  const ok = await bcrypt.compare(body.password, rows[0].password_hash);
  if (!ok) throw new HttpError(401, "Password does not match");

  // Soft-delete and anonymize. We keep the row to preserve order/audit FKs.
  await pool.query("BEGIN");
  try {
    await pool.query(
      `UPDATE users
         SET email = CONCAT('deleted+', id::text, '@planzo.invalid'),
             deleted_at = now(),
             deleted_reason = $2
       WHERE id = $1`,
      [userId, body.reason ?? null],
    );
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [userId],
    );
    await pool.query("DELETE FROM saved_payment_methods WHERE user_id = $1", [
      userId,
    ]);
    await pool.query(
      "INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, metadata_json) VALUES ($1,$2,$3,$4,$5)",
      [
        userId,
        "account.delete",
        "user",
        userId,
        JSON.stringify({ reason: body.reason ?? null }),
      ],
    );
    await pool.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
});

export default router;
