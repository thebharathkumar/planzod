import { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool";
import { HttpError } from "../utils/http";
import { verifyAccessToken } from "../auth/tokens";

function getBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) throw new HttpError(401, "Missing Authorization header");

    let userId: string;
    try {
      ({ userId } = verifyAccessToken(token));
    } catch {
      throw new HttpError(401, "Invalid access token");
    }

    const { rows } = await pool.query<{ id: string; email: string; role: string }>(
      "SELECT id, email, role FROM users WHERE id = $1",
      [userId]
    );
    const user = rows[0];
    if (!user) throw new HttpError(401, "User not found");

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Unauthorized"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Forbidden"));
    next();
  };
}

