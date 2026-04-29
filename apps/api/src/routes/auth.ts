import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/tokens";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { sha256 } from "../utils/crypto";
import { HttpError } from "../utils/http";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72)
});

router.post("/register", async (req, res) => {
  const body = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);

  try {
    const { rows } = await pool.query<{ id: string; email: string; role: string; created_at: string }>(
      "INSERT INTO users(email, password_hash) VALUES ($1, $2) RETURNING id, email, role, created_at",
      [body.email, passwordHash]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err: any) {
    if (err?.code === "23505") throw new HttpError(409, "Email already in use");
    throw err;
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);
  const { rows } = await pool.query<{ id: string; email: string; role: string; password_hash: string }>(
    "SELECT id, email, role, password_hash FROM users WHERE email = $1",
    [body.email]
  );
  const user = rows[0];
  if (!user) throw new HttpError(401, "Invalid email or password");

  const ok = await bcrypt.compare(body.password, user.password_hash);
  if (!ok) throw new HttpError(401, "Invalid email or password");

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  const tokenHash = sha256(refreshToken);
  const { exp } = verifyRefreshToken(refreshToken);
  const expiresAt = new Date(exp * 1000);

  await pool.query(
    "INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [user.id, tokenHash, expiresAt.toISOString()]
  );

  res.json({
    user: { id: user.id, email: user.email, role: user.role },
    accessToken,
    refreshToken
  });
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

router.post("/refresh", async (req, res) => {
  const body = refreshSchema.parse(req.body);
  let userId: string;

  try {
    ({ userId } = verifyRefreshToken(body.refreshToken));
  } catch {
    throw new HttpError(401, "Invalid refresh token");
  }

  const tokenHash = sha256(body.refreshToken);
  const { rowCount } = await pool.query(
    "SELECT 1 FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()",
    [tokenHash]
  );
  if (rowCount !== 1) throw new HttpError(401, "Refresh token revoked");

  // Rotate refresh token (recommended)
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [
    tokenHash
  ]);

  const newAccessToken = signAccessToken(userId);
  const newRefreshToken = signRefreshToken(userId);
  const newTokenHash = sha256(newRefreshToken);
  const { exp: newExp } = verifyRefreshToken(newRefreshToken);
  const expiresAt = new Date(newExp * 1000);

  await pool.query(
    "INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, newTokenHash, expiresAt.toISOString()]
  );

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

router.post("/logout", async (req, res) => {
  const body = refreshSchema.parse(req.body);
  const tokenHash = sha256(body.refreshToken);
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [
    tokenHash
  ]);
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
