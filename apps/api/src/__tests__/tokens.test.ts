import { describe, expect, it } from "vitest";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../auth/tokens";

describe("auth tokens", () => {
  it("signs/verifies access tokens", () => {
    const token = signAccessToken("user-123");
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe("user-123");
  });

  it("signs/verifies refresh tokens", () => {
    const token = signRefreshToken("user-abc");
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe("user-abc");
    expect(typeof decoded.exp).toBe("number");
  });
});

