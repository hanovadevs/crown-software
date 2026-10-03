import { describe, expect, it, vi } from "vitest";
import { nextDocumentNumber } from "./documents";

describe("document numbering", () => {
  it("uses the Karachi business year at the UTC year boundary", async () => {
    const execute = vi.fn(async () => ({ rows: [{ last_number: 7 }] }));
    const number = await nextDocumentNumber({ execute }, "transaction", "TXN", new Date("2025-12-31T20:00:00Z"));
    expect(number).toBe("TXN-2026-00007");
  });
});
