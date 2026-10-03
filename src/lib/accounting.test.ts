import { describe, expect, it } from "vitest";
import { calculateBillTotals, hasPrecision, partyLedgerDelta, partyLedgerEvents, productTotal, projectCorrectedStock } from "./accounting";

describe("party ledger posting", () => {
  it("counts only credit sales and purchases as debt", () => {
    expect(partyLedgerDelta({ type: "sale", paymentMethod: "credit", status: "posted", amount: "1000.00" })).toBe(1000);
    expect(partyLedgerDelta({ type: "sale", paymentMethod: "cash", status: "posted", amount: "1000.00" })).toBe(0);
    expect(partyLedgerDelta({ type: "purchase", paymentMethod: "credit", status: "posted", amount: "500.00" })).toBe(-500);
    expect(partyLedgerDelta({ type: "purchase", paymentMethod: "bank", status: "posted", amount: "500.00" })).toBe(0);
  });

  it("includes receipts and supplier payments but excludes reversed postings", () => {
    expect(partyLedgerDelta({ type: "customer_receipt", paymentMethod: "bank", status: "posted", amount: "150.00" })).toBe(-150);
    expect(partyLedgerDelta({ type: "supplier_payment", paymentMethod: "cash", status: "posted", amount: "75.00" })).toBe(75);
    expect(partyLedgerDelta({ type: "sale", paymentMethod: "credit", status: "reversed", amount: "100.00" })).toBe(0);
  });

  it("keeps a dated original and offsetting reversal for historical statements", () => {
    const events = partyLedgerEvents([{
      id: "sale-1", number: "TXN-1", date: "2026-01-01", description: "Battery sale",
      type: "sale", paymentMethod: "credit", status: "reversed", amount: "100.00",
    }], new Map([["sale-1", { entry_date: "2026-02-01", entry_number: "JRN-2" }]]));
    expect(events.map((event) => [event.date, event.delta])).toEqual([
      ["2026-01-01", 100], ["2026-02-01", -100],
    ]);
  });

  it("applies a corrected amount on the correction date without changing an earlier closing balance", () => {
    const events = partyLedgerEvents([
      { id: "old", number: "TXN-1", date: "2026-09-01", description: "Original sale",
        type: "sale", paymentMethod: "credit", status: "reversed", amount: "100.00" },
      { id: "new", number: "TXN-2", date: "2026-10-03", description: "Corrected sale",
        type: "sale", paymentMethod: "credit", status: "posted", amount: "125.00" },
    ], new Map([["old", { entry_date: "2026-10-03", entry_number: "JRN-2" }]]));
    expect(events.filter((event) => event.date <= "2026-09-30").reduce((balance, event) => balance + event.delta, 0)).toBe(100);
    expect(events.reduce((balance, event) => balance + event.delta, 0)).toBe(125);
  });

  it("shows a settled sale and matching payment without changing the balance", () => {
    const events = partyLedgerEvents([{
      id: "sale-2", number: "TXN-2", date: "2026-09-03", description: "Bank sale",
      type: "sale", paymentMethod: "bank", status: "posted", amount: "33000.00",
    }], new Map());
    expect(events.map((event) => [event.type, event.delta])).toEqual([
      ["SALE", 33000], ["PAYMENT RECEIVED", -33000],
    ]);
    expect(events.reduce((sum, event) => sum + event.delta, 0)).toBe(0);
  });

  it("reverses both the sale and settlement on the reversal date", () => {
    const events = partyLedgerEvents([{
      id: "sale-3", number: "TXN-3", date: "2026-09-03", description: "Cash sale",
      type: "sale", paymentMethod: "cash", status: "reversed", amount: "100.00",
    }], new Map([["sale-3", { entry_date: "2026-09-04", entry_number: "JRN-3" }]]));
    expect(events.map((event) => event.delta)).toEqual([100, -100, -100, 100]);
  });
});

describe("bill totals", () => {
  it("adds rounded line values to the exact displayed total", () => {
    const result = calculateBillTotals([
      { quantity: 0.005, unitPrice: 1 },
      { quantity: 0.005, unitPrice: 1 },
    ], 0, 0);
    expect(result.lines.map((line) => line.lineTotal)).toEqual([0.01, 0.01]);
    expect(result.subtotal).toBe(0.02);
    expect(result.total).toBe(0.02);
  });

  it("rounds tax per line and includes shipping and discount", () => {
    const result = calculateBillTotals([{ quantity: 1, unitPrice: 10 }], 18, 1, 2, 1);
    expect(result.lines[0]).toEqual({ baseAmount: 10, salesTaxAmount: 1.8, sedAmount: 0.1, lineTotal: 11.9 });
    expect(result.total).toBe(12.9);
  });
});

describe("product transaction amount", () => {
  it("rounds three-place quantities at the cent", () => {
    expect(productTotal(1.005, 10.01)).toBe(10.06);
    expect(productTotal(3, 19.99)).toBe(59.97);
    expect(hasPrecision(1.005, 3)).toBe(true);
    expect(hasPrecision(1.0005, 3)).toBe(false);
  });
});

describe("transaction correction stock", () => {
  it("allows a smaller replacement purchase when the final stock remains positive", () => {
    expect(projectCorrectedStock(
      [{ productId: "p", warehouseId: "w", quantity: 10 }],
      [{ productId: "p", warehouseId: "w", quantityDelta: 100 }],
      [{ productId: "p", warehouseId: "w", quantityDelta: 95 }],
    )).toEqual([{ productId: "p", warehouseId: "w", quantity: 5 }]);
  });

  it("detects stock shortages when correcting a sale to a larger quantity", () => {
    expect(projectCorrectedStock(
      [{ productId: "p", warehouseId: "w", quantity: 2 }],
      [{ productId: "p", warehouseId: "w", quantityDelta: -3 }],
      [{ productId: "p", warehouseId: "w", quantityDelta: -6 }],
    )[0].quantity).toBe(-1);
  });
});
