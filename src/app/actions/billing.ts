"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { nextDocumentNumber } from "@/db/documents";
import {
  auditLogs,
  billItems,
  bills,
  parties,
  products,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { FormState } from "./business";

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
  const effectiveTaxRate = isTaxInvoice ? value.taxRate : value.taxRate;
  const effectiveSedRate = isTaxInvoice ? value.sedRate : 0;

  let subtotal = 0;
  let totalSalesTax = 0;
  let totalSed = 0;

  const processedItems = value.items.map((item) => {
    const baseAmount = item.quantity * item.unitPrice;
    const itemSalesTax = baseAmount * (effectiveTaxRate / 100);
    const itemSed = baseAmount * (effectiveSedRate / 100);
    const lineTotal = baseAmount + itemSalesTax + itemSed;

    subtotal += baseAmount;
    totalSalesTax += itemSalesTax;
    totalSed += itemSed;

    return {
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      salesTaxRate: effectiveTaxRate,
      salesTaxAmount: itemSalesTax,
      sedRate: effectiveSedRate,
      sedAmount: itemSed,
      lineTotal,
    };
  });

  const total =
    subtotal + totalSalesTax + totalSed + value.shippingAmount - value.discountAmount;
  if (total < 0) return { error: "Discount cannot exceed the bill total." };

  const prefixMap: Record<string, string> = {
    invoice: "INV",
    quotation: "QTN",
    tax_invoice: "STI",
  };

  const billId = await db.transaction(async (tx) => {
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

  redirect(`/bills/${billId}`);
}
