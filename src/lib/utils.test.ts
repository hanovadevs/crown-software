import { describe, expect, it } from "vitest";
import { formatDate, formatPKR, initials } from "./utils";

describe("business formatting", () => {
  it("formats Pakistani rupees consistently", () => {
    expect(formatPKR(257957)).toBe("Rs 257,957");
    expect(formatPKR("1250.5")).toBe("Rs 1,250.50");
  });

  it("formats business dates in day/month/year order", () => {
    expect(formatDate("2026-07-31")).toBe("31/07/2026");
  });

  it("creates safe two-letter initials", () => {
    expect(initials("Crown Administrator")).toBe("CA");
    expect(initials("Admin")).toBe("A");
  });
});
