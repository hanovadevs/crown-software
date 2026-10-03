export type LedgerTransaction = {
  type: string;
  paymentMethod: string;
  status: string;
  amount: number | string;
};

// A party balance changes only when the posting uses receivables or payables.
// Cash and bank sales/purchases are settled at the time of posting.
export function partyLedgerDelta(item: LedgerTransaction): number {
  if (item.status !== "posted") return 0;
  const amount = Number(item.amount);
  if (item.type === "sale" && item.paymentMethod === "credit") return amount;
  if (item.type === "purchase" && item.paymentMethod === "credit") return -amount;
  if (item.type === "customer_receipt") return -amount;
  if (item.type === "supplier_payment") return amount;
  return 0;
}

export function partyLedgerEvents(
  activity: Array<LedgerTransaction & { id: string; number: string; date: string; description: string }>,
  reversals: Map<string, { entry_date: string; entry_number: string }>,
) {
  return activity.flatMap((item, index) => {
    if (item.status === "draft") return [];
    const reversal = item.status === "reversed" ? reversals.get(item.id) : undefined;
    if (item.status === "reversed" && !reversal) return [];
    const settled = (item.type === "sale" || item.type === "purchase") && item.paymentMethod !== "credit";
    const amount = Number(item.amount);
    const delta = settled ? item.type === "sale" ? amount : -amount : partyLedgerDelta({ ...item, status: "posted" });
    const original = {
      date: item.date, number: item.number, type: item.type.replaceAll("_", " ").toUpperCase(),
      description: item.description, paymentMethod: item.paymentMethod, delta, order: index * 4,
    };
    const settlement = settled ? [{
      date: item.date, number: item.number, type: item.type === "sale" ? "PAYMENT RECEIVED" : "PAYMENT MADE",
      description: `${item.paymentMethod.toUpperCase()} settlement of ${item.number}`,
      paymentMethod: item.paymentMethod, delta: -delta, order: index * 4 + 1,
    }] : [];
    const reversalEvents = reversal ? [
      { date: reversal.entry_date, number: reversal.entry_number, type: "REVERSAL", description: `Reversal of ${item.number}`,
        paymentMethod: item.paymentMethod, delta: -delta, order: index * 4 + 2 },
      ...(settled ? [{ date: reversal.entry_date, number: reversal.entry_number, type: "SETTLEMENT REVERSAL",
        description: `Reversal of settlement for ${item.number}`, paymentMethod: item.paymentMethod,
        delta, order: index * 4 + 3 }] : []),
    ] : [];
    return [original, ...settlement, ...reversalEvents];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
}

export function productTotal(quantity: number, unitPrice: number): number {
  const thousandths = Math.round(quantity * 1000);
  const cents = Math.round(unitPrice * 100);
  return Math.round((thousandths * cents) / 1000) / 100;
}

export function hasPrecision(value: number, places: number): boolean {
  const scaled = value * 10 ** places;
  return Number.isFinite(value) && Math.abs(scaled - Math.round(scaled)) < 0.000001;
}

export type StockPosition = { productId: string; warehouseId: string; quantity: number };
export type StockChange = { productId: string; warehouseId: string; quantityDelta: number };

// Corrections can reverse a consumed purchase when the replacement still covers the units used.
export function projectCorrectedStock(
  positions: StockPosition[],
  originalMovements: StockChange[],
  replacementMovements: StockChange[],
): StockPosition[] {
  const quantities = new Map<string, number>();
  const key = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;
  for (const item of positions) quantities.set(key(item.productId, item.warehouseId), Math.round(item.quantity * 1000));
  for (const item of originalMovements) {
    const id = key(item.productId, item.warehouseId);
    quantities.set(id, (quantities.get(id) ?? 0) - Math.round(item.quantityDelta * 1000));
  }
  for (const item of replacementMovements) {
    const id = key(item.productId, item.warehouseId);
    quantities.set(id, (quantities.get(id) ?? 0) + Math.round(item.quantityDelta * 1000));
  }
  return [...quantities].map(([id, quantity]) => {
    const [productId, warehouseId] = id.split(":");
    return { productId, warehouseId, quantity: quantity / 1000 };
  });
}

export function calculateBillTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
  sedRate: number,
  shippingAmount = 0,
  discountAmount = 0,
) {
  let subtotalCents = 0;
  let taxCents = 0;
  let sedCents = 0;
  const lines = items.map((item) => {
    const baseCents = Math.round(productTotal(item.quantity, item.unitPrice) * 100);
    const lineTaxCents = Math.round(baseCents * taxRate / 100);
    const lineSedCents = Math.round(baseCents * sedRate / 100);
    subtotalCents += baseCents;
    taxCents += lineTaxCents;
    sedCents += lineSedCents;
    return {
      baseAmount: baseCents / 100,
      salesTaxAmount: lineTaxCents / 100,
      sedAmount: lineSedCents / 100,
      lineTotal: (baseCents + lineTaxCents + lineSedCents) / 100,
    };
  });
  return {
    lines,
    subtotal: subtotalCents / 100,
    salesTaxAmount: taxCents / 100,
    sedAmount: sedCents / 100,
    total: (subtotalCents + taxCents + sedCents + Math.round(shippingAmount * 100) - Math.round(discountAmount * 100)) / 100,
  };
}
