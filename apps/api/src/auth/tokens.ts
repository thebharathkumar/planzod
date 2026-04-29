import jwt from "jsonwebtoken";
import { env } from "../env";

type AccessClaims = {
  typ: "access";
};

type RefreshClaims = {
  typ: "refresh";
};

export function signAccessToken(userId: string): string {
  const claims: AccessClaims = { typ: "access" };
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.JWT_ACCESS_TTL
  });
}

export function signRefreshToken(userId: string): string {
  const claims: RefreshClaims = { typ: "refresh" };
  return jwt.sign(claims, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: env.JWT_REFRESH_TTL
  });
}

export function verifyAccessToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  if (decoded.typ !== "access") throw new Error("Invalid access token");
  if (!decoded.sub) throw new Error("Missing subject");
  return { userId: decoded.sub };
}

export function verifyRefreshToken(token: string): { userId: string; exp: number } {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  if (decoded.typ !== "refresh") throw new Error("Invalid refresh token");
  if (!decoded.sub) throw new Error("Missing subject");
  if (!decoded.exp) throw new Error("Missing exp");
  return { userId: decoded.sub, exp: decoded.exp };
}

