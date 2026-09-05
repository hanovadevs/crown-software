"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { nextDocumentNumber } from "@/db/documents";
import {
  auditLogs,
  inventoryMovements,
  journalEntries,
  journalLines,
  ledgerAccounts,
  notifications,
  products,
  warehouses,
  workerPayments,
  workers,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type OperationFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

const money = z.coerce.number().nonnegative();

function canEdit(role: string) {
  return role !== "viewer";
}

function accountId(accounts: Array<{ id: string; code: string }>, code: string) {
  const account = accounts.find((item) => item.code === code);
  if (!account) throw new Error(`System ledger account ${code} is missing.`);
  return account.id;
}

async function deleteSourceJournal(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sourceType: string,
  sourceId: string,
) {
  const entries = await tx
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, sourceType), eq(journalEntries.sourceId, sourceId)));
  if (!entries.length) return;
  const ids = entries.map((entry) => entry.id);
  await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, ids));
  await tx.delete(journalEntries).where(inArray(journalEntries.id, ids));
}

const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  mode: z.enum(["increase", "decrease", "set"]),
  quantity: z.coerce.number().positive(),
  unitCost: money,
  occurredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().min(3).max(1000),
});

export async function createStockAdjustmentAction(
  _previousState: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have inventory permission." };
  const parsed = stockAdjustmentSchema.safeParse({
    productId: formData.get("productId"),
    warehouseId: formData.get("warehouseId"),
    mode: formData.get("mode"),
    quantity: formData.get("quantity"),
    unitCost: formData.get("unitCost") ?? "0",
    occurredDate: formData.get("occurredDate"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: "Please correct the stock adjustment.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const value = parsed.data;

  try {
    await db.transaction(async (tx) => {
      const [[product], [warehouse], [stockResult]] = await Promise.all([
        tx.select().from(products).where(and(eq(products.id, value.productId), eq(products.isActive, true))).limit(1),
        tx.select().from(warehouses).where(and(eq(warehouses.id, value.warehouseId), eq(warehouses.isActive, true))).limit(1),
        tx.select({ stock: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)` })
          .from(inventoryMovements)
          .where(and(eq(inventoryMovements.productId, value.productId), eq(inventoryMovements.warehouseId, value.warehouseId))),
      ]);
      if (!product || !warehouse) throw new Error("The selected product or warehouse is unavailable.");
      const currentStock = Number(stockResult?.stock ?? 0);
      const delta = value.mode === "set"
        ? value.quantity - currentStock
        : value.mode === "increase"
          ? value.quantity
          : -value.quantity;
      if (delta === 0) throw new Error("The adjustment does not change the current stock.");
      if (currentStock + delta < 0) throw new Error("This adjustment would make stock negative.");

      const date = new Date(`${value.occurredDate}T12:00:00+05:00`);
      const reference = await nextDocumentNumber(
        tx as unknown as Parameters<typeof nextDocumentNumber>[0],
        "stock_adjustment",
        "ADJ",
        date,
      );
      const [movement] = await tx.insert(inventoryMovements).values({
        productId: product.id,
        warehouseId: warehouse.id,
        movementType: delta > 0 ? "adjustment_in" : "adjustment_out",
        quantityDelta: delta.toFixed(3),
        unitCost: value.unitCost.toFixed(4),
        occurredAt: date,
        reference,
        notes: value.notes,
        createdBy: user.id,
      }).returning({ id: inventoryMovements.id });

      const adjustmentValue = Math.abs(delta) * value.unitCost;
      if (adjustmentValue > 0) {
        const accounts = await tx.select({ id: ledgerAccounts.id, code: ledgerAccounts.code })
          .from(ledgerAccounts)
          .where(inArray(ledgerAccounts.code, ["1200", "3000", "5000"]));
        const [entry] = await tx.insert(journalEntries).values({
          entryNumber: await nextDocumentNumber(
            tx as unknown as Parameters<typeof nextDocumentNumber>[0],
            "journal",
            "JRN",
            date,
          ),
          entryDate: value.occurredDate,
          description: `Stock adjustment ${reference}: ${value.notes}`,
          sourceType: "stock_adjustment",
          sourceId: movement.id,
          createdBy: user.id,
        }).returning({ id: journalEntries.id });
        const amount = adjustmentValue.toFixed(2);
        await tx.insert(journalLines).values(delta > 0 ? [
          { journalEntryId: entry.id, accountId: accountId(accounts, "1200"), side: "debit", amount },
          { journalEntryId: entry.id, accountId: accountId(accounts, "3000"), side: "credit", amount },
        ] : [
          { journalEntryId: entry.id, accountId: accountId(accounts, "5000"), side: "debit", amount },
          { journalEntryId: entry.id, accountId: accountId(accounts, "1200"), side: "credit", amount },
        ]);
      }

      const finalStock = currentStock + delta;
      if (finalStock <= Number(product.reorderLevel)) {
        await tx.insert(notifications).values({
          title: "Low stock alert",
          message: `${product.name} is at ${finalStock.toLocaleString()} ${product.unit}. Reorder level: ${Number(product.reorderLevel).toLocaleString()}.`,
          type: "warning",
          href: "/stock",
        });
      }
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "post",
        entityType: "stock_adjustment",
        entityId: movement.id,
        newValues: { reference, productId: product.id, warehouseId: warehouse.id, delta: delta.toFixed(3), unitCost: value.unitCost.toFixed(4) },
      });
      await tx.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "stock", action: "adjusted", id: movement.id })})`);
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("unavailable") || error.message.includes("negative") || error.message.includes("does not change") || error.message.includes("missing"))) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath("/stock");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/reports");
  redirect("/stock");
}

const workerPaymentSchema = z.object({
  workerId: z.string().uuid(),
  salaryMonth: z.string().regex(/^\d{4}-\d{2}$/),
  grossAmount: money,
  advanceAmount: money,
  deductionAmount: money,
  paidAmount: money,
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
});

export async function saveWorkerPaymentAction(
  _previousState: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have payroll permission." };
  const parsed = workerPaymentSchema.safeParse({
    workerId: formData.get("workerId"),
    salaryMonth: formData.get("salaryMonth"),
    grossAmount: formData.get("grossAmount"),
    advanceAmount: formData.get("advanceAmount") ?? "0",
    deductionAmount: formData.get("deductionAmount") ?? "0",
    paidAmount: formData.get("paidAmount") ?? "0",
    paidDate: formData.get("paidDate") ?? "",
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return { error: "Please correct the payment information.", fieldErrors: parsed.error.flatten().fieldErrors };
  const value = parsed.data;
  const netPayable = value.grossAmount - value.advanceAmount - value.deductionAmount;
  if (netPayable < 0) return { error: "Advance and deductions cannot exceed gross salary." };
  if (value.paidAmount > netPayable) return { error: "Paid amount cannot exceed net payable salary." };
  if (value.paidAmount > 0 && !value.paidDate) return { error: "Enter the payment date." };
  const status = value.paidAmount === 0 ? "pending" : value.paidAmount < netPayable ? "partial" : "paid";
  const salaryMonth = `${value.salaryMonth}-01`;

  try {
    await db.transaction(async (tx) => {
      const [worker] = await tx.select().from(workers).where(and(eq(workers.id, value.workerId), eq(workers.status, "active"))).limit(1);
      if (!worker) throw new Error("The selected worker is unavailable.");
      const [existing] = await tx.select().from(workerPayments)
        .where(and(eq(workerPayments.workerId, worker.id), eq(workerPayments.salaryMonth, salaryMonth))).limit(1);
      let paymentId: string;
      if (existing) {
        paymentId = existing.id;
        await deleteSourceJournal(tx, "worker_payment", paymentId);
        await tx.update(workerPayments).set({
          grossAmount: value.grossAmount.toFixed(2),
          advanceAmount: value.advanceAmount.toFixed(2),
          deductionAmount: value.deductionAmount.toFixed(2),
          paidAmount: value.paidAmount.toFixed(2),
          status,
          paidAt: value.paidDate ? new Date(`${value.paidDate}T12:00:00+05:00`) : null,
          notes: value.notes || null,
          updatedAt: new Date(),
        }).where(eq(workerPayments.id, paymentId));
      } else {
        const [created] = await tx.insert(workerPayments).values({
          workerId: worker.id,
          salaryMonth,
          grossAmount: value.grossAmount.toFixed(2),
          advanceAmount: value.advanceAmount.toFixed(2),
          deductionAmount: value.deductionAmount.toFixed(2),
          paidAmount: value.paidAmount.toFixed(2),
          status,
          paidAt: value.paidDate ? new Date(`${value.paidDate}T12:00:00+05:00`) : null,
          notes: value.notes || null,
          createdBy: user.id,
        }).returning({ id: workerPayments.id });
        paymentId = created.id;
      }

      if (value.paidAmount > 0) {
        const accounts = await tx.select({ id: ledgerAccounts.id, code: ledgerAccounts.code })
          .from(ledgerAccounts).where(inArray(ledgerAccounts.code, ["1000", "5100"]));
        const entryDate = value.paidDate || `${value.salaryMonth}-01`;
        const [entry] = await tx.insert(journalEntries).values({
          entryNumber: await nextDocumentNumber(
            tx as unknown as Parameters<typeof nextDocumentNumber>[0], "journal", "JRN", new Date(`${entryDate}T12:00:00+05:00`),
          ),
          entryDate,
          description: `Salary payment: ${worker.name} (${value.salaryMonth})`,
          sourceType: "worker_payment",
          sourceId: paymentId,
          createdBy: user.id,
        }).returning({ id: journalEntries.id });
        const amount = value.paidAmount.toFixed(2);
        await tx.insert(journalLines).values([
          { journalEntryId: entry.id, accountId: accountId(accounts, "5100"), side: "debit", amount },
          { journalEntryId: entry.id, accountId: accountId(accounts, "1000"), side: "credit", amount },
        ]);
      }
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: existing ? "update" : "post",
        entityType: "worker_payment",
        entityId: paymentId,
        oldValues: existing ? { paidAmount: existing.paidAmount, status: existing.status } : null,
        newValues: { workerId: worker.id, salaryMonth, grossAmount: value.grossAmount.toFixed(2), paidAmount: value.paidAmount.toFixed(2), status },
      });
      await tx.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "worker_payment", action: existing ? "updated" : "created", id: paymentId })})`);
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("unavailable") || error.message.includes("missing"))) return { error: error.message };
    throw error;
  }
  revalidatePath("/workers");
  revalidatePath(`/workers/${value.workerId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/workers/${value.workerId}`);
}

export async function deleteWorkerPaymentAction(paymentId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have payroll permission.");
  let workerId = "";
  await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(workerPayments).where(eq(workerPayments.id, paymentId)).limit(1);
    if (!payment) return;
    workerId = payment.workerId;
    await deleteSourceJournal(tx, "worker_payment", paymentId);
    await tx.delete(workerPayments).where(eq(workerPayments.id, paymentId));
    await tx.insert(auditLogs).values({ userId: user.id, action: "archive", entityType: "worker_payment", entityId: paymentId });
    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "worker_payment",
        action: "deleted",
        id: paymentId,
      })})`,
    );
  });
  revalidatePath("/workers");
  if (workerId) revalidatePath(`/workers/${workerId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(workerId ? `/workers/${workerId}` : "/workers");
}
