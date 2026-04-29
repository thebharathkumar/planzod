import { describe, expect, it } from "vitest";
import { signTicketQr, verifyTicketQr } from "../tickets/qr";

describe("ticket QR", () => {
  it("signs/verifies QR payloads", () => {
    const token = signTicketQr("ticket-1", "event-1");
    const decoded = verifyTicketQr(token);
    expect(decoded.ticketId).toBe("ticket-1");
    expect(decoded.eventId).toBe("event-1");
  });
});

