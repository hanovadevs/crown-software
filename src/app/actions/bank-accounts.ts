"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, bankAccounts, journalEntries, journalLines, transactions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { hasPrecision } from "@/lib/accounting";
import type { FormState } from "./business";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  bankName: z.string().trim().min(2).max(160),
  accountNumber: z.string().trim().max(120),
  iban: z.string().trim().max(64),
  openingBalance: z.coerce.number().finite(),
});

export async function createBankAccountAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "admin") return { error: "Only an administrator can add bank accounts." };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the account details." };
  const value = parsed.data;
  if (!hasPrecision(value.openingBalance, 2)) return { error: "Opening balance must have at most two decimal places." };
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(bankAccounts).values({
        name: value.name, bankName: value.bankName,
        accountNumber: value.accountNumber || null, iban: value.iban || null,
        openingBalance: value.openingBalance.toFixed(2), isCashAccount: false,
      }).returning({ id: bankAccounts.id });
      await tx.insert(auditLogs).values({
        userId: user.id, action: "create", entityType: "bank_account", entityId: created.id,
        newValues: { name: value.name, bankName: value.bankName, openingBalance: value.openingBalance.toFixed(2) },
      });
    });
  } catch {
    return { error: "Could not add the account. Check whether this account name already exists." };
  }
  revalidatePath("/settings");
  revalidatePath("/transactions/new");
  revalidatePath("/reports");
  return { success: true };
}

export async function assignLegacyBankAccountAction(transactionId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "admin") return { error: "Only an administrator can assign historical bank transactions." };
  const parsed = z.string().uuid().safeParse(formData.get("bankAccountId"));
  if (!parsed.success) return { error: "Select a bank account." };
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
      const [item] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
      if (!item || item.status !== "posted" || item.bankAccountId || !["bank", "cheque"].includes(item.paymentMethod)) {
        throw new Error("This transaction is no longer eligible for bank assignment.");
      }
      const [account] = await tx.select().from(bankAccounts)
        .where(and(eq(bankAccounts.id, parsed.data), eq(bankAccounts.isActive, true), eq(bankAccounts.isCashAccount, false))).limit(1);
      if (!account) throw new Error("Select an active bank account.");
      const [entry] = await tx.select({ id: journalEntries.id }).from(journalEntries)
        .where(and(eq(journalEntries.sourceType, "transaction"), eq(journalEntries.sourceId, transactionId))).limit(1);
      if (!entry) throw new Error("The journal entry is missing; this transaction needs manual review.");
      const lines = await tx.select({ bankAccountId: journalLines.bankAccountId }).from(journalLines)
        .where(eq(journalLines.journalEntryId, entry.id));
      if (!lines.length || lines.some((line) => line.bankAccountId)) {
        throw new Error("The journal account link is inconsistent; this transaction needs manual review.");
      }
      await tx.update(transactions).set({ bankAccountId: account.id, updatedAt: new Date(), version: sql`${transactions.version} + 1` })
        .where(eq(transactions.id, transactionId));
      await tx.update(journalLines).set({ bankAccountId: account.id })
        .where(eq(journalLines.journalEntryId, entry.id));
      await tx.insert(auditLogs).values({
        userId: user.id, action: "update", entityType: "transaction", entityId: transactionId,
        oldValues: { bankAccountId: null },
        newValues: { bankAccountId: account.id, bankAccountName: account.name },
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Bank assignment failed." };
  }
  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return { success: true };
}
