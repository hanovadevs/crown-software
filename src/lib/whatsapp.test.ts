import { describe, expect, it } from "vitest";
import { normalizeWhatsAppNumber, whatsappUrl } from "./whatsapp";

describe("WhatsApp links", () => {
  it("normalizes Pakistani mobile formats", () => {
    expect(normalizeWhatsAppNumber("0300-1234567")).toBe("923001234567");
    expect(normalizeWhatsAppNumber("300 1234567")).toBe("923001234567");
    expect(normalizeWhatsAppNumber("+92 300 1234567")).toBe("923001234567");
    expect(normalizeWhatsAppNumber("03446176261/03339180978")).toBe("923446176261");
    expect(normalizeWhatsAppNumber("0300-1234567, 0321-7654321")).toBe("923001234567");
  });
  it("rejects incomplete numbers", () => {
    expect(normalizeWhatsAppNumber("1234")).toBeNull();
  });
  it("encodes the ledger message", () => {
    expect(whatsappUrl("03001234567", "Balance: Rs 500")).toContain("Balance%3A%20Rs%20500");
  });
});
