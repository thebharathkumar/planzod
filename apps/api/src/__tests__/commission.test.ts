import { describe, expect, it } from "vitest";
import { calculateCommission } from "../finance/commission";

const defaults = {
  platform_commission_bps: 1000, // 10%
  payment_processing_bps: 290, // 2.9%
  payment_processing_flat_cents: 30,
};

describe("commission calculator", () => {
  it("computes platform commission and processing fee", () => {
    const r = calculateCommission(10_000, defaults);
    expect(r.commission_cents).toBe(1000);
    expect(r.processing_fee_cents).toBe(290 + 30);
    expect(r.organizer_net_cents).toBe(10_000 - 1000 - 320);
  });

  it("can omit the per-order flat processing fee", () => {
    const r = calculateCommission(10_000, defaults, {
      perOrderProcessingFlat: false,
    });
    expect(r.processing_fee_cents).toBe(290);
    expect(r.organizer_net_cents).toBe(10_000 - 1000 - 290);
  });

  it("rounds half-pennies away from zero correctly", () => {
    const r = calculateCommission(1234, defaults);
    expect(r.commission_cents).toBe(123);
    expect(r.processing_fee_cents).toBe(Math.round((1234 * 290) / 10000) + 30);
  });
});
