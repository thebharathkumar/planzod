import jwt from "jsonwebtoken";
import { env } from "../env";

type TicketQrClaims = {
  typ: "ticket";
  tid: string;
  eid: string;
};

export function signTicketQr(ticketId: string, eventId: string): string {
  const claims: TicketQrClaims = { typ: "ticket", tid: ticketId, eid: eventId };
  return jwt.sign(claims, env.TICKET_QR_SECRET, {
    expiresIn: "180d"
  });
}

export function verifyTicketQr(qrPayload: string): { ticketId: string; eventId: string } {
  const decoded = jwt.verify(qrPayload, env.TICKET_QR_SECRET) as jwt.JwtPayload;
  if (decoded.typ !== "ticket") throw new Error("Invalid ticket payload");
  if (typeof decoded.tid !== "string" || typeof decoded.eid !== "string") throw new Error("Invalid ticket payload");
  return { ticketId: decoded.tid, eventId: decoded.eid };
}

