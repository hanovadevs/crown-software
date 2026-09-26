"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { nextDocumentNumber } from "@/db/documents";
import {
  auditLogs,
  billItems,
  bills,
  inventoryMovements,
  journalEntries,
  journalLines,
  ledgerAccounts,
  parties,
  products,
  transactions,
  warehouses,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { FormState } from "./business";
import { calculateBillTotals, hasPrecision, productTotal } from "@/lib/accounting";

const itemSchema = z.object({
  productId: z.string().uuid().nullable(),
  description: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const billSchema = z.object({
  partyId: z.string().uuid(),
  type: z.enum(["invoice", "quotation", "tax_invoice"]),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
    .string()
    .transform((value) => value || null)
    .nullable(),
  supplierNtn: z.string().trim().max(80).transform((v) => v || null).nullable(),
  buyerNtn: z.string().trim().max(80).transform((v) => v || null).nullable(),
  timeOfSupply: z.string().trim().max(80).transform((v) => v || null).nullable(),
  termsOfSales: z.string().trim().max(160).transform((v) => v || null).nullable(),
  taxRate: z.coerce.number().min(0).max(100),
  sedRate: z.coerce.number().min(0).max(100),
  shippingAmount: z.coerce.number().nonnegative(),
  discountAmount: z.coerce.number().nonnegative(),
  notes: z.string().trim().max(3000).transform((value) => value || null),
  items: z.array(itemSchema).min(1).max(100),
});

export async function createBillAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role === "viewer") {
    return { error: "You do not have billing permission." };
  }

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
  } catch {
    return { error: "The bill items could not be read." };
  }

  const parsed = billSchema.safeParse({
    partyId: formData.get("partyId"),
    type: formData.get("type"),
    billDate: formData.get("billDate"),
    dueDate: formData.get("dueDate"),
    supplierNtn: formData.get("supplierNtn") || "",
    buyerNtn: formData.get("buyerNtn") || "",
    timeOfSupply: formData.get("timeOfSupply") || "",
    termsOfSales: formData.get("termsOfSales") || "",
    taxRate: formData.get("taxRate") || "0",
    sedRate: formData.get("sedRate") || "0",
    shippingAmount: formData.get("shippingAmount") || "0",
    discountAmount: formData.get("discountAmount") || "0",
    notes: formData.get("notes") || "",
    items,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the bill information.",
    };
  }

  const value = parsed.data;
  if (value.items.some((item) => !hasPrecision(item.quantity, 3) || !hasPrecision(item.unitPrice, 2)) ||
      !hasPrecision(value.shippingAmount, 2) || !hasPrecision(value.discountAmount, 2) ||
      !hasPrecision(value.taxRate, 4) || !hasPrecision(value.sedRate, 4)) {
    return { error: "Use at most three decimals for quantity, four for tax rates, and two for money." };
  }
  if (value.dueDate && value.dueDate < value.billDate) {
    return { error: "Due date cannot be earlier than the bill date." };
  }

  const [party] = await db
    .select({ id: parties.id, isCustomer: parties.isCustomer, taxNumber: parties.taxNumber })
    .from(parties)
    .where(and(eq(parties.id, value.partyId), eq(parties.isActive, true)))
    .limit(1);
  if (!party?.isCustomer) {
    return { error: "Select an active customer for this bill." };
  }

  const productIds = value.items
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  if (productIds.length) {
    const validProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.isActive, true)));
    if (new Set(validProducts.map((product) => product.id)).size !== new Set(productIds).size) {
      return { error: "One or more selected products are unavailable." };
    }
  }

  const isTaxInvoice = value.type === "tax_invoice";
  const effectiveTaxRate = value.taxRate;
  const effectiveSedRate = isTaxInvoice ? value.sedRate : 0;
  const calculated = calculateBillTotals(value.items, effectiveTaxRate, effectiveSedRate, value.shippingAmount, value.discountAmount);
  const processedItems = value.items.map((item, index) => ({
    ...item,
    salesTaxRate: effectiveTaxRate,
    salesTaxAmount: calculated.lines[index].salesTaxAmount,
    sedRate: effectiveSedRate,
    sedAmount: calculated.lines[index].sedAmount,
    lineTotal: calculated.lines[index].lineTotal,
  }));
  const { subtotal, total } = calculated;
  const totalSalesTax = calculated.salesTaxAmount;
  const totalSed = calculated.sedAmount;
  const revenueCents = Math.round(total * 100) - Math.round(totalSalesTax * 100) - Math.round(totalSed * 100);
  if (total <= 0 || revenueCents < 0) return { error: "Discount cannot exceed the untaxed bill amount." };

  const prefixMap: Record<string, string> = {
    invoice: "INV",
    quotation: "QTN",
    tax_invoice: "STI",
  };

  let billId: string;
  try {
  billId = await db.transaction(async (tx) => {
    const issueInvoice = value.type !== "quotation";
    const stockProducts = new Map<string, { quantity: number; unitCost: number }>();
    let warehouseId: string | null = null;
    if (issueInvoice) {
      for (const productId of [...new Set(productIds)].sort()) {
        await tx.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`);
        const [product] = await tx.select({ id: products.id, purchasePrice: products.purchasePrice })
          .from(products).where(and(eq(products.id, productId), eq(products.isActive, true), eq(products.isSellable, true))).limit(1);
        if (!product) throw new Error("An invoice product is no longer available for sale.");
        stockProducts.set(productId, { quantity: 0, unitCost: Number(product.purchasePrice) });
      }
      for (const item of value.items) {
        if (!item.productId) continue;
        stockProducts.get(item.productId)!.quantity += item.quantity;
      }
      if (stockProducts.size) {
        const [warehouse] = await tx.select({ id: warehouses.id }).from(warehouses)
          .where(eq(warehouses.isDefault, true)).limit(1);
        if (!warehouse) throw new Error("No default warehouse is configured.");
        warehouseId = warehouse.id;
        for (const [productId, product] of stockProducts) {
          const [stock] = await tx.select({ quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)` })
            .from(inventoryMovements).where(and(eq(inventoryMovements.productId, productId), eq(inventoryMovements.warehouseId, warehouseId)));
          if (Number(stock?.quantity ?? 0) < product.quantity) throw new Error("Insufficient stock to issue this invoice.");
        }
      }
    }
    const billNumber = await nextDocumentNumber(
      tx as unknown as Parameters<typeof nextDocumentNumber>[0],
      value.type,
      prefixMap[value.type] || "INV",
      new Date(`${value.billDate}T00:00:00+05:00`),
    );
    const [created] = await tx
      .insert(bills)
      .values({
        billNumber,
        type: value.type,
        status: "issued",
        partyId: value.partyId,
        billDate: value.billDate,
        dueDate: value.dueDate,
        supplierNtn: value.supplierNtn,
        buyerNtn: value.buyerNtn || party.taxNumber,
        timeOfSupply: value.timeOfSupply,
        termsOfSales: value.termsOfSales,
        subtotal: subtotal.toFixed(2),
        taxRate: effectiveTaxRate.toFixed(4),
        taxAmount: totalSalesTax.toFixed(2),
        sedRate: effectiveSedRate.toFixed(4),
        sedAmount: totalSed.toFixed(2),
        shippingAmount: value.shippingAmount.toFixed(2),
        discountAmount: value.discountAmount.toFixed(2),
        totalAmount: total.toFixed(2),
        notes: value.notes,
        createdBy: user.id,
      })
      .returning({ id: bills.id });

    await tx.insert(billItems).values(
      processedItems.map((item, index) => ({
        billId: created.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity.toFixed(3),
        unitPrice: item.unitPrice.toFixed(2),
        salesTaxRate: item.salesTaxRate.toFixed(4),
        salesTaxAmount: item.salesTaxAmount.toFixed(2),
        sedRate: item.sedRate.toFixed(4),
        sedAmount: item.sedAmount.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
        sortOrder: index,
      })),
    );

    if (issueInvoice) {
      const transactionNumber = await nextDocumentNumber(tx as unknown as Parameters<typeof nextDocumentNumber>[0], "transaction", "TXN", new Date(`${value.billDate}T00:00:00+05:00`));
      const [sale] = await tx.insert(transactions).values({
        transactionNumber, type: "sale", partyId: value.partyId, warehouseId,
        totalAmount: total.toFixed(2), paymentMethod: "credit",
        description: `Invoice ${billNumber}`, reference: billNumber,
        transactionDate: value.billDate, createdBy: user.id,
      }).returning({ id: transactions.id });
      await tx.update(bills).set({ postedTransactionId: sale.id }).where(eq(bills.id, created.id));
      let costCents = 0;
      for (const [productId, product] of stockProducts) {
        await tx.insert(inventoryMovements).values({
          productId, warehouseId: warehouseId!, transactionId: sale.id,
          movementType: "sale", quantityDelta: (-product.quantity).toFixed(3),
          unitCost: product.unitCost.toFixed(4), reference: billNumber,
          notes: `Issued invoice ${billNumber}`, createdBy: user.id,
        });
        costCents += Math.round(productTotal(product.quantity, product.unitCost) * 100);
      }
      const taxAccounts = [];
      if (totalSalesTax > 0) taxAccounts.push({ code: "2100", name: "Sales Tax Payable", type: "liability" as const, isSystem: true });
      if (totalSed > 0) taxAccounts.push({ code: "2110", name: "SED Payable", type: "liability" as const, isSystem: true });
      if (taxAccounts.length) await tx.insert(ledgerAccounts).values(taxAccounts).onConflictDoNothing();
      const accounts = await tx.select({ id: ledgerAccounts.id, code: ledgerAccounts.code }).from(ledgerAccounts)
        .where(inArray(ledgerAccounts.code, ["1100", "1200", "4000", "5000", "2100", "2110"]));
      const account = (code: string) => {
        const found = accounts.find((item) => item.code === code);
        if (!found) throw new Error(`Ledger account ${code} is not configured.`);
        return found.id;
      };
      const entryNumber = await nextDocumentNumber(tx as unknown as Parameters<typeof nextDocumentNumber>[0], "journal", "JRN", new Date(`${value.billDate}T00:00:00+05:00`));
      const [entry] = await tx.insert(journalEntries).values({
        entryNumber, entryDate: value.billDate, description: `Issued invoice ${billNumber}`,
        sourceType: "transaction", sourceId: sale.id, createdBy: user.id,
      }).returning({ id: journalEntries.id });
      const lines: Array<typeof journalLines.$inferInsert> = [
        { journalEntryId: entry.id, accountId: account("1100"), partyId: value.partyId, side: "debit", amount: total.toFixed(2) },
      ];
      if (revenueCents > 0) lines.push({ journalEntryId: entry.id, accountId: account("4000"), partyId: value.partyId, side: "credit", amount: (revenueCents / 100).toFixed(2) });
      if (totalSalesTax > 0) lines.push({ journalEntryId: entry.id, accountId: account("2100"), partyId: value.partyId, side: "credit", amount: totalSalesTax.toFixed(2) });
      if (totalSed > 0) lines.push({ journalEntryId: entry.id, accountId: account("2110"), partyId: value.partyId, side: "credit", amount: totalSed.toFixed(2) });
      if (costCents > 0) lines.push(
        { journalEntryId: entry.id, accountId: account("5000"), partyId: value.partyId, side: "debit", amount: (costCents / 100).toFixed(2) },
        { journalEntryId: entry.id, accountId: account("1200"), partyId: value.partyId, side: "credit", amount: (costCents / 100).toFixed(2) },
      );
      await tx.insert(journalLines).values(lines);
    }

    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "create",
      entityType: "bill",
      entityId: created.id,
      newValues: { billNumber, type: value.type, totalAmount: total.toFixed(2) },
    });
    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "bill",
        action: "created",
        id: created.id,
      })})`,
    );
    return created.id;
  });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The bill could not be issued." };
  }

  revalidatePath("/bills");
  revalidatePath("/dashboard");
  revalidatePath("/parties");
  revalidatePath("/reports");
  revalidatePath("/stock");
  redirect(`/bills/${billId}`);
}

export async function updateBillStatusAction(
  billId: string,
  newStatus: "issued" | "paid" | "cancelled",
) {
  const user = await requireUser();
  if (user.role === "viewer") {
    throw new Error("You do not have permission to update bills.");
  }

  if (newStatus === "cancelled") {
    await cancelBill(billId, user.id);
    revalidateBillPaths(billId);
    return;
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM bills WHERE id = ${billId} FOR UPDATE`);
    const [bill] = await tx.select().from(bills).where(eq(bills.id, billId)).limit(1);
    if (!bill) throw new Error("Bill not found.");
    if (bill.type === "quotation" && newStatus === "paid") throw new Error("A quotation cannot be marked paid.");
    if (bill.status === "cancelled") throw new Error("A cancelled bill cannot be reopened. Duplicate it to create a new bill.");
    if (newStatus === "paid" && bill.postedTransactionId) {
      const [receipts] = await tx.select({ amount: sql<string>`COALESCE(SUM(${transactions.totalAmount}), 0)` })
        .from(transactions).where(and(
          eq(transactions.type, "customer_receipt"), eq(transactions.status, "posted"),
          eq(transactions.partyId, bill.partyId), eq(transactions.reference, bill.billNumber),
        ));
      if (Number(receipts?.amount ?? 0) < Number(bill.totalAmount)) {
        throw new Error(`Record customer receipts totalling ${bill.totalAmount} with reference ${bill.billNumber} before marking this invoice paid.`);
      }
    }

    await tx
      .update(bills)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(bills.id, billId));

    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "update",
      entityType: "bill",
      entityId: billId,
      oldValues: { status: bill.status },
      newValues: { status: newStatus },
    });

    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "bill",
        action: "status_changed",
        id: billId,
      })})`,
    );
  });

  revalidateBillPaths(billId);
}

export async function deleteBillAction(billId: string) {
  const user = await requireUser();
  if (user.role === "viewer") {
    throw new Error("You do not have permission to delete bills.");
  }

  await cancelBill(billId, user.id);
  revalidateBillPaths(billId);
  redirect("/bills");
}

function revalidateBillPaths(billId: string) {
  for (const path of ["/bills", `/bills/${billId}`, "/dashboard", "/parties", "/transactions", "/stock", "/reports"]) revalidatePath(path);
}

async function cancelBill(billId: string, userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM bills WHERE id = ${billId} FOR UPDATE`);
    const [bill] = await tx.select().from(bills).where(eq(bills.id, billId)).limit(1);
    if (!bill || bill.status === "cancelled") return;
    if (bill.status === "paid") throw new Error("Re-open the paid bill before cancelling it.");

    if (bill.postedTransactionId) {
      const [receipts] = await tx.select({ count: sql<number>`COUNT(*)` }).from(transactions)
        .where(and(eq(transactions.type, "customer_receipt"), eq(transactions.status, "posted"),
          eq(transactions.partyId, bill.partyId), eq(transactions.reference, bill.billNumber)));
      if (Number(receipts?.count ?? 0) > 0) throw new Error("Reverse receipts linked to this invoice before cancelling it.");
      const transactionId = bill.postedTransactionId;
      await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
      const [sale] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
      if (!sale || sale.status !== "posted") throw new Error("The invoice sale is missing or already reversed.");
      const movements = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.transactionId, transactionId));
      for (const productId of [...new Set(movements.map((movement) => movement.productId))].sort()) {
        await tx.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`);
      }
      if (movements.length) await tx.insert(inventoryMovements).values(movements.map((movement) => ({
        productId: movement.productId, warehouseId: movement.warehouseId, transactionId,
        movementType: "return_in" as const, quantityDelta: (-Number(movement.quantityDelta)).toFixed(3),
        unitCost: movement.unitCost, reference: `REV-${bill.billNumber}`,
        notes: `Cancellation of ${bill.billNumber}`, createdBy: userId,
      })));
      const [entry] = await tx.select().from(journalEntries)
        .where(and(eq(journalEntries.sourceType, "transaction"), eq(journalEntries.sourceId, transactionId))).limit(1);
      if (!entry) throw new Error("The invoice journal entry is missing.");
      const lines = await tx.select().from(journalLines).where(eq(journalLines.journalEntryId, entry.id));
      if (!lines.length) throw new Error("The invoice journal lines are missing.");
      const reversalDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const [reversal] = await tx.insert(journalEntries).values({
        entryNumber: await nextDocumentNumber(tx as unknown as Parameters<typeof nextDocumentNumber>[0], "journal", "JRN", new Date(`${reversalDate}T00:00:00+05:00`)),
        entryDate: reversalDate, description: `Cancellation of ${bill.billNumber}`,
        sourceType: "transaction_reversal", sourceId: transactionId, reversalOfId: entry.id, createdBy: userId,
      }).returning({ id: journalEntries.id });
      await tx.insert(journalLines).values(lines.map((line) => ({
        journalEntryId: reversal.id, accountId: line.accountId, partyId: line.partyId,
        bankAccountId: line.bankAccountId, side: line.side === "debit" ? "credit" as const : "debit" as const,
        amount: line.amount, memo: `Cancellation of ${bill.billNumber}`,
      })));
      await tx.update(transactions).set({ status: "reversed", updatedAt: new Date(), version: sql`${transactions.version} + 1` })
        .where(eq(transactions.id, transactionId));
      await tx.insert(auditLogs).values({
        userId, action: "reverse", entityType: "transaction", entityId: transactionId,
        oldValues: { status: sale.status, amount: sale.totalAmount },
        newValues: { status: "reversed", reversalJournalId: reversal.id },
      });
    }

    await tx.update(bills).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bills.id, billId));

    await tx.insert(auditLogs).values({
      userId,
      action: "archive",
      entityType: "bill",
      entityId: billId,
      oldValues: { billNumber: bill.billNumber, totalAmount: bill.totalAmount },
    });

    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "bill",
        action: "cancelled",
        id: billId,
      })})`,
    );
  });
}
