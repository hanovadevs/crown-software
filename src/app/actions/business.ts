"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { nextDocumentNumber } from "@/db/documents";
import {
  auditLogs,
  billOfMaterialItems,
  billItems,
  billsOfMaterials,
  bills,
  inventoryMovements,
  journalEntries,
  journalLines,
  ledgerAccounts,
  parties,
  products,
  qualityChecks,
  transactions,
  warehouses,
  workers,
  workerPayments,
  workOrders,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type FormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
};

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => value || null),
);
const optionalMoney = z
  .union([z.string(), z.number()])
  .transform((value) => (value === "" ? 0 : Number(value)))
  .pipe(z.number().nonnegative());

function canEdit(role: string) {
  return role !== "viewer";
}

function validationState(error: z.ZodError): FormState {
  return {
    error: "Please correct the highlighted information.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

const partySchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    contactPerson: optionalString,
    phone: optionalString,
    email: z
      .string()
      .trim()
      .email()
      .or(z.literal(""))
      .transform((value) => value || null),
    address: optionalString,
    taxNumber: optionalString,
    isCustomer: z.boolean(),
    isSupplier: z.boolean(),
    openingReceivable: optionalMoney,
    openingPayable: optionalMoney,
  })
  .refine((value) => value.isCustomer || value.isSupplier, {
    message: "Select Customer, Supplier, or both.",
    path: ["isCustomer"],
  });

export async function createPartyAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };

  const parsed = partySchema.safeParse({
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    taxNumber: formData.get("taxNumber"),
    isCustomer: formData.get("isCustomer") === "on",
    isSupplier: formData.get("isSupplier") === "on",
    openingReceivable: formData.get("openingReceivable") ?? "0",
    openingPayable: formData.get("openingPayable") ?? "0",
  });

  if (!parsed.success) return validationState(parsed.error);

  const [party] = await db
    .insert(parties)
    .values({
      ...parsed.data,
      openingReceivable: parsed.data.openingReceivable.toFixed(2),
      openingPayable: parsed.data.openingPayable.toFixed(2),
    })
    .returning();

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "create",
    entityType: "party",
    entityId: party.id,
    newValues: {
      name: party.name,
      isCustomer: party.isCustomer,
      isSupplier: party.isSupplier,
    },
  });

  revalidatePath("/", "layout");
  redirect("/parties");
}

export async function updatePartyAction(
  partyId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };
  const parsed = partySchema.safeParse({
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    taxNumber: formData.get("taxNumber"),
    isCustomer: formData.get("isCustomer") === "on",
    isSupplier: formData.get("isSupplier") === "on",
    openingReceivable: formData.get("openingReceivable") ?? "0",
    openingPayable: formData.get("openingPayable") ?? "0",
  });
  if (!parsed.success) return validationState(parsed.error);

  const [existing] = await db.select().from(parties).where(eq(parties.id, partyId)).limit(1);
  if (!existing) return { error: "Party no longer exists." };
  await db.transaction(async (tx) => {
    await tx.update(parties).set({
      ...parsed.data,
      openingReceivable: parsed.data.openingReceivable.toFixed(2),
      openingPayable: parsed.data.openingPayable.toFixed(2),
      version: sql`${parties.version} + 1`,
      updatedAt: new Date(),
    }).where(eq(parties.id, partyId));
    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "update",
      entityType: "party",
      entityId: partyId,
      oldValues: { name: existing.name, isCustomer: existing.isCustomer, isSupplier: existing.isSupplier },
      newValues: { name: parsed.data.name, isCustomer: parsed.data.isCustomer, isSupplier: parsed.data.isSupplier },
    });
  });
  revalidatePath("/", "layout");
  redirect(`/parties/${partyId}`);
}

export async function deletePartyAction(partyId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have editing permission.");
  await db.transaction(async (tx) => {
    const related = await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.partyId, partyId));
    for (const item of related) await deleteTransactionRecords(tx, item.id);
    const relatedBills = await tx.select({ id: bills.id }).from(bills).where(eq(bills.partyId, partyId));
    if (relatedBills.length) {
      await tx.delete(billItems).where(inArray(billItems.billId, relatedBills.map((item) => item.id)));
      await tx.delete(bills).where(eq(bills.partyId, partyId));
    }
    await tx.delete(journalLines).where(eq(journalLines.partyId, partyId));
    await tx.delete(parties).where(eq(parties.id, partyId));
    await tx.insert(auditLogs).values({ userId: user.id, action: "archive", entityType: "party", entityId: partyId });
  });
  revalidatePath("/", "layout");
  redirect("/parties");
}

const productSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    sku: z.string().trim().min(2).max(80),
    category: optionalString,
    brand: z.string().trim().min(1).max(120),
    unit: z.string().trim().min(1).max(40),
    description: optionalString,
    salePrice: optionalMoney,
    purchasePrice: optionalMoney,
    reorderLevel: optionalMoney,
    isSellable: z.boolean(),
    isPurchasable: z.boolean(),
    isRawMaterial: z.boolean(),
    isFinishedGood: z.boolean(),
  })
  .refine((value) => value.isSellable || value.isPurchasable, {
    message: "Select Sellable, Purchasable, or both.",
    path: ["isSellable"],
  });

function productFormValue(formData: FormData) {
  return {
    name: formData.get("name"),
    sku: formData.get("sku"),
    category: formData.get("category"),
    brand: formData.get("brand") || "Crown",
    unit: formData.get("unit") || "Pieces",
    description: formData.get("description"),
    salePrice: formData.get("salePrice") ?? "0",
    purchasePrice: formData.get("purchasePrice") ?? "0",
    reorderLevel: formData.get("reorderLevel") ?? "0",
    isSellable: formData.get("isSellable") === "on",
    isPurchasable: formData.get("isPurchasable") === "on",
    isRawMaterial: formData.get("isRawMaterial") === "on",
    isFinishedGood: formData.get("isFinishedGood") === "on",
  };
}

export async function createProductAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };

  const parsed = productSchema.safeParse(productFormValue(formData));

  if (!parsed.success) return validationState(parsed.error);

  try {
    const [product] = await db
      .insert(products)
      .values({
        ...parsed.data,
        sku: parsed.data.sku.toUpperCase(),
        salePrice: parsed.data.salePrice.toFixed(2),
        purchasePrice: parsed.data.purchasePrice.toFixed(2),
        reorderLevel: parsed.data.reorderLevel.toFixed(3),
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "create",
      entityType: "product",
      entityId: product.id,
      newValues: { sku: product.sku, name: product.name },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("products_sku_unique") ||
        error.message.includes("duplicate key"))
    ) {
      return { error: "That product SKU already exists." };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  redirect("/products");
}

export async function updateProductAction(
  productId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };
  const parsed = productSchema.safeParse(productFormValue(formData));
  if (!parsed.success) return validationState(parsed.error);
  const [existing] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!existing) return { error: "Product no longer exists." };
  try {
    await db.transaction(async (tx) => {
      await tx.update(products).set({
        ...parsed.data,
        sku: parsed.data.sku.toUpperCase(),
        salePrice: parsed.data.salePrice.toFixed(2),
        purchasePrice: parsed.data.purchasePrice.toFixed(2),
        reorderLevel: parsed.data.reorderLevel.toFixed(3),
        version: sql`${products.version} + 1`,
        updatedAt: new Date(),
      }).where(eq(products.id, productId));
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "update",
        entityType: "product",
        entityId: productId,
        oldValues: { sku: existing.sku, name: existing.name, isSellable: existing.isSellable, isPurchasable: existing.isPurchasable },
        newValues: { sku: parsed.data.sku.toUpperCase(), name: parsed.data.name, isSellable: parsed.data.isSellable, isPurchasable: parsed.data.isPurchasable },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) return { error: "That product SKU already exists." };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/products");
}

export async function deleteProductAction(productId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have editing permission.");

  await db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return;

    const relatedTransactions = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.productId, productId));
    for (const transaction of relatedTransactions) {
      await deleteTransactionRecords(tx, transaction.id);
    }

    const remainingMovements = await tx
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.productId, productId));
    if (remainingMovements.length) {
      const movementIds = remainingMovements.map((movement) => movement.id);
      const adjustmentEntries = await tx
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.sourceType, "stock_adjustment"),
            inArray(journalEntries.sourceId, movementIds),
          ),
        );
      if (adjustmentEntries.length) {
        const entryIds = adjustmentEntries.map((entry) => entry.id);
        await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, entryIds));
        await tx.delete(journalEntries).where(inArray(journalEntries.id, entryIds));
      }
      await tx.delete(inventoryMovements).where(eq(inventoryMovements.productId, productId));
    }

    await tx.update(billItems).set({ productId: null }).where(eq(billItems.productId, productId));

    const [finishedBoms, materialBoms] = await Promise.all([
      tx.select({ id: billsOfMaterials.id }).from(billsOfMaterials).where(eq(billsOfMaterials.finishedProductId, productId)),
      tx.select({ id: billOfMaterialItems.bomId }).from(billOfMaterialItems).where(eq(billOfMaterialItems.materialProductId, productId)),
    ]);
    const bomIds = [...new Set([...finishedBoms.map((bom) => bom.id), ...materialBoms.map((bom) => bom.id)])];
    if (bomIds.length) {
      const workOrderIds = (
        await tx.select({ id: workOrders.id }).from(workOrders).where(inArray(workOrders.bomId, bomIds))
      ).map((order) => order.id);
      if (workOrderIds.length) {
        await tx.delete(qualityChecks).where(inArray(qualityChecks.workOrderId, workOrderIds));
        await tx.delete(workOrders).where(inArray(workOrders.id, workOrderIds));
      }
      await tx.delete(billOfMaterialItems).where(inArray(billOfMaterialItems.bomId, bomIds));
      await tx.delete(billsOfMaterials).where(inArray(billsOfMaterials.id, bomIds));
    }

    await tx.delete(products).where(eq(products.id, productId));
    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "archive",
      entityType: "product",
      entityId: productId,
      oldValues: {
        sku: product.sku,
        name: product.name,
        removedTransactions: relatedTransactions.length,
        removedStockMovements: remainingMovements.length,
        removedManufacturingDefinitions: bomIds.length,
      },
    });
    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "product",
        action: "deleted",
        id: productId,
      })})`,
    );
  });

  revalidatePath("/", "layout");
  redirect("/products");
}

const transactionSchema = z.object({
  type: z.enum([
    "sale",
    "purchase",
    "bank_deposit",
    "bank_withdrawal",
    "customer_receipt",
    "supplier_payment",
  ]),
  partyId: optionalString,
  productId: optionalString,
  bankAccountId: optionalString,
  quantity: optionalMoney,
  unitPrice: optionalMoney,
  totalAmount: z.coerce.number().positive(),
  description: z.string().trim().min(2).max(2000),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(["cash", "bank", "cheque", "credit"]),
  reference: optionalString,
});

function accountByCode(
  accounts: Array<{ id: string; code: string }>,
  code: string,
) {
  const account = accounts.find((candidate) => candidate.code === code);
  if (!account) throw new Error(`System ledger account ${code} is missing`);
  return account.id;
}

type CrownDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function deleteTransactionRecords(tx: CrownDbTransaction, transactionId: string) {
  const entries = await tx
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, "transaction"), eq(journalEntries.sourceId, transactionId)));
  if (entries.length) {
    const entryIds = entries.map((entry) => entry.id);
    await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, entryIds));
    await tx.delete(journalEntries).where(inArray(journalEntries.id, entryIds));
  }
  await tx.delete(inventoryMovements).where(eq(inventoryMovements.transactionId, transactionId));
  await tx.delete(transactions).where(eq(transactions.id, transactionId));
}

export async function createTransactionAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };

  const parsed = transactionSchema.safeParse({
    type: formData.get("type"),
    partyId: formData.get("partyId"),
    productId: formData.get("productId"),
    bankAccountId: formData.get("bankAccountId"),
    quantity: formData.get("quantity") ?? "0",
    unitPrice: formData.get("unitPrice") ?? "0",
    totalAmount: formData.get("totalAmount"),
    description: formData.get("description"),
    transactionDate: formData.get("transactionDate"),
    paymentMethod: formData.get("paymentMethod") || "cash",
    reference: formData.get("reference"),
  });

  if (!parsed.success) return validationState(parsed.error);

  const value = parsed.data;
  const partyRequired = [
    "sale",
    "purchase",
    "customer_receipt",
    "supplier_payment",
  ].includes(value.type);
  const bankRequired = ["bank_deposit", "bank_withdrawal"].includes(value.type);

  if (partyRequired && !value.partyId) {
    return { error: "Select the customer or supplier for this transaction." };
  }
  if (bankRequired && !value.bankAccountId) {
    return { error: "Select a bank or cash account." };
  }
  if (value.productId && value.quantity <= 0) {
    return { error: "Quantity must be greater than zero for a product transaction." };
  }

  if (value.partyId) {
    const [party] = await db
      .select()
      .from(parties)
      .where(and(eq(parties.id, value.partyId), eq(parties.isActive, true)))
      .limit(1);
    if (!party) return { error: "The selected party is unavailable." };
    if (
      ["sale", "customer_receipt"].includes(value.type) &&
      !party.isCustomer
    ) {
      return { error: "The selected party is not registered as a customer." };
    }
    if (
      ["purchase", "supplier_payment"].includes(value.type) &&
      !party.isSupplier
    ) {
      return { error: "The selected party is not registered as a supplier." };
    }
  }

  try {
    await db.transaction(async (tx) => {
      const [defaultWarehouse] = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(eq(warehouses.isDefault, true))
        .limit(1);
      if (!defaultWarehouse) throw new Error("No default warehouse is configured");

      let selectedProduct:
        | { id: string; purchasePrice: string; name: string; isSellable: boolean; isPurchasable: boolean }
        | undefined;
      if (value.productId) {
        [selectedProduct] = await tx
          .select({
            id: products.id,
            purchasePrice: products.purchasePrice,
            name: products.name,
            isSellable: products.isSellable,
            isPurchasable: products.isPurchasable,
          })
          .from(products)
          .where(and(eq(products.id, value.productId), eq(products.isActive, true)))
          .limit(1);
        if (!selectedProduct) throw new Error("The selected product is unavailable");
        if (value.type === "sale" && !selectedProduct.isSellable) {
          throw new Error("The selected product is not marked as sellable");
        }
        if (value.type === "purchase" && !selectedProduct.isPurchasable) {
          throw new Error("The selected product is not marked as purchasable");
        }
      }

      if (value.type === "sale" && value.productId) {
        const [stockResult] = await tx
          .select({
            stock: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)`,
          })
          .from(inventoryMovements)
          .where(
            and(
              eq(inventoryMovements.productId, value.productId),
              eq(inventoryMovements.warehouseId, defaultWarehouse.id),
            ),
          );
        if (Number(stockResult?.stock ?? 0) < value.quantity) {
          throw new Error("Insufficient stock for this sale");
        }
      }

      const transactionNumber = await nextDocumentNumber(
        tx as unknown as Parameters<typeof nextDocumentNumber>[0],
        "transaction",
        "TXN",
        new Date(`${value.transactionDate}T00:00:00+05:00`),
      );
      const [created] = await tx
        .insert(transactions)
        .values({
          transactionNumber,
          type: value.type,
          partyId: value.partyId,
          productId: value.productId,
          bankAccountId: value.bankAccountId,
          warehouseId: defaultWarehouse.id,
          quantity: value.productId ? value.quantity.toFixed(3) : null,
          unitPrice: value.productId ? value.unitPrice.toFixed(2) : null,
          totalAmount: value.totalAmount.toFixed(2),
          paymentMethod: value.paymentMethod,
          description: value.description,
          reference: value.reference,
          transactionDate: value.transactionDate,
          createdBy: user.id,
        })
        .returning();

      if (
        selectedProduct &&
        (value.type === "sale" || value.type === "purchase")
      ) {
        await tx.insert(inventoryMovements).values({
          productId: selectedProduct.id,
          warehouseId: defaultWarehouse.id,
          transactionId: created.id,
          movementType: value.type,
          quantityDelta:
            value.type === "sale"
              ? (-value.quantity).toFixed(3)
              : value.quantity.toFixed(3),
          unitCost:
            value.type === "purchase"
              ? value.unitPrice.toFixed(4)
              : Number(selectedProduct.purchasePrice).toFixed(4),
          reference: transactionNumber,
          notes: value.description,
          createdBy: user.id,
        });
      }

      const accounts = await tx
        .select({ id: ledgerAccounts.id, code: ledgerAccounts.code })
        .from(ledgerAccounts)
        .where(
          inArray(ledgerAccounts.code, [
            "1000",
            "1100",
            "1200",
            "2000",
            "3000",
            "4000",
            "5000",
          ]),
        );
      const entryNumber = await nextDocumentNumber(
        tx as unknown as Parameters<typeof nextDocumentNumber>[0],
        "journal",
        "JRN",
        new Date(`${value.transactionDate}T00:00:00+05:00`),
      );
      const [entry] = await tx
        .insert(journalEntries)
        .values({
          entryNumber,
          entryDate: value.transactionDate,
          description: value.description,
          sourceType: "transaction",
          sourceId: created.id,
          createdBy: user.id,
        })
        .returning({ id: journalEntries.id });

      const amount = value.totalAmount.toFixed(2);
      const cash = accountByCode(accounts, "1000");
      const receivable = accountByCode(accounts, "1100");
      const inventory = accountByCode(accounts, "1200");
      const payable = accountByCode(accounts, "2000");
      const equity = accountByCode(accounts, "3000");
      const revenue = accountByCode(accounts, "4000");
      const costOfGoods = accountByCode(accounts, "5000");
      const lines: Array<typeof journalLines.$inferInsert> = [];
      const base = {
        journalEntryId: entry.id,
        partyId: value.partyId,
        bankAccountId: value.bankAccountId,
      };

      const cashOrBank = value.paymentMethod === "credit" ? cash : (value.bankAccountId ? cash : cash);

      if (value.type === "sale") {
        lines.push(
          {
            ...base,
            accountId: value.paymentMethod === "credit" ? receivable : cashOrBank,
            side: "debit",
            amount,
          },
          { ...base, accountId: revenue, side: "credit", amount },
        );
        const cost =
          selectedProduct &&
          Number(selectedProduct.purchasePrice) * value.quantity;
        if (cost && cost > 0) {
          lines.push(
            {
              ...base,
              accountId: costOfGoods,
              side: "debit",
              amount: cost.toFixed(2),
            },
            {
              ...base,
              accountId: inventory,
              side: "credit",
              amount: cost.toFixed(2),
            },
          );
        }
      } else if (value.type === "purchase") {
        lines.push(
          { ...base, accountId: inventory, side: "debit", amount },
          {
            ...base,
            accountId: value.paymentMethod === "credit" ? payable : cashOrBank,
            side: "credit",
            amount,
          },
        );
      } else if (value.type === "bank_deposit") {
        lines.push(
          { ...base, accountId: cashOrBank, side: "debit", amount },
          { ...base, accountId: equity, side: "credit", amount },
        );
      } else if (value.type === "bank_withdrawal") {
        lines.push(
          { ...base, accountId: equity, side: "debit", amount },
          { ...base, accountId: cashOrBank, side: "credit", amount },
        );
      } else if (value.type === "customer_receipt") {
        lines.push(
          { ...base, accountId: cashOrBank, side: "debit", amount },
          { ...base, accountId: receivable, side: "credit", amount },
        );
      } else {
        lines.push(
          { ...base, accountId: payable, side: "debit", amount },
          { ...base, accountId: cashOrBank, side: "credit", amount },
        );
      }

      await tx.insert(journalLines).values(lines);
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "post",
        entityType: "transaction",
        entityId: created.id,
        newValues: {
          transactionNumber,
          type: value.type,
          totalAmount: amount,
        },
      });
      await tx.execute(
        sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
          entity: "transaction",
          action: "created",
          id: created.id,
        })})`,
      );
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Insufficient stock") ||
        error.message.includes("unavailable") ||
        error.message.includes("warehouse") ||
        error.message.includes("not marked"))
    ) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  redirect("/transactions");
}

const workerSchema = z.object({
  workerCode: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  phone: optionalString,
  address: optionalString,
  nationalId: optionalString,
  designation: optionalString,
  monthlySalary: optionalMoney,
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createWorkerAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };
  const parsed = workerSchema.safeParse({
    workerCode: formData.get("workerCode"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    nationalId: formData.get("nationalId"),
    designation: formData.get("designation"),
    monthlySalary: formData.get("monthlySalary") ?? "0",
    joiningDate: formData.get("joiningDate"),
  });
  if (!parsed.success) return validationState(parsed.error);

  try {
    const [worker] = await db
      .insert(workers)
      .values({
        ...parsed.data,
        workerCode: parsed.data.workerCode.toUpperCase(),
        monthlySalary: parsed.data.monthlySalary.toFixed(2),
      })
      .returning();
    await db.insert(auditLogs).values({
      userId: user.id,
      action: "create",
      entityType: "worker",
      entityId: worker.id,
      newValues: { code: worker.workerCode, name: worker.name },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("workers_code_unique") ||
        error.message.includes("duplicate key"))
    ) {
      return { error: "That worker code already exists." };
    }
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/workers");
}

export async function updateWorkerAction(
  workerId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };
  const parsed = workerSchema.safeParse({
    workerCode: formData.get("workerCode"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    nationalId: formData.get("nationalId"),
    designation: formData.get("designation"),
    monthlySalary: formData.get("monthlySalary") ?? "0",
    joiningDate: formData.get("joiningDate"),
  });
  if (!parsed.success) return validationState(parsed.error);
  try {
    const [existing] = await db.select().from(workers).where(eq(workers.id, workerId)).limit(1);
    if (!existing) return { error: "Worker no longer exists." };
    await db.transaction(async (tx) => {
      await tx.update(workers).set({
        ...parsed.data,
        workerCode: parsed.data.workerCode.toUpperCase(),
        monthlySalary: parsed.data.monthlySalary.toFixed(2),
        updatedAt: new Date(),
      }).where(eq(workers.id, workerId));
      await tx.insert(auditLogs).values({
        userId: user.id, action: "update", entityType: "worker", entityId: workerId,
        oldValues: { code: existing.workerCode, name: existing.name },
        newValues: { code: parsed.data.workerCode.toUpperCase(), name: parsed.data.name },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) return { error: "That worker code already exists." };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/workers");
}

export async function deleteWorkerAction(workerId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have editing permission.");
  await db.transaction(async (tx) => {
    const paymentIds = (await tx.select({ id: workerPayments.id }).from(workerPayments).where(eq(workerPayments.workerId, workerId))).map((payment) => payment.id);
    if (paymentIds.length) {
      const entryIds = (await tx.select({ id: journalEntries.id }).from(journalEntries)
        .where(and(eq(journalEntries.sourceType, "worker_payment"), inArray(journalEntries.sourceId, paymentIds)))).map((entry) => entry.id);
      if (entryIds.length) {
        await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, entryIds));
        await tx.delete(journalEntries).where(inArray(journalEntries.id, entryIds));
      }
    }
    await tx.delete(workerPayments).where(eq(workerPayments.workerId, workerId));
    await tx.delete(workers).where(eq(workers.id, workerId));
    await tx.insert(auditLogs).values({ userId: user.id, action: "archive", entityType: "worker", entityId: workerId });
  });
  revalidatePath("/", "layout");
  redirect("/workers");
}

export async function deleteTransactionAction(transactionId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have editing permission.");
  await db.transaction(async (tx) => {
    await deleteTransactionRecords(tx, transactionId);
    await tx.insert(auditLogs).values({ userId: user.id, action: "archive", entityType: "transaction", entityId: transactionId });
  });
  revalidatePath("/", "layout");
  redirect("/transactions");
}

const transactionEditSchema = z.object({
  quantity: optionalMoney,
  unitPrice: optionalMoney,
  totalAmount: z.coerce.number().positive(),
  description: z.string().trim().min(2).max(2000),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: optionalString,
});

export async function updateTransactionAction(
  transactionId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };
  const parsed = transactionEditSchema.safeParse({
    quantity: formData.get("quantity") ?? "0",
    unitPrice: formData.get("unitPrice") ?? "0",
    totalAmount: formData.get("totalAmount"),
    description: formData.get("description"),
    transactionDate: formData.get("transactionDate"),
    reference: formData.get("reference"),
  });
  if (!parsed.success) return validationState(parsed.error);
  const value = parsed.data;

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
      if (!existing) throw new Error("Transaction no longer exists.");
      if (existing.productId && value.quantity <= 0) throw new Error("Quantity must be greater than zero.");

      const [product] = existing.productId
        ? await tx.select({ purchasePrice: products.purchasePrice }).from(products).where(eq(products.id, existing.productId)).limit(1)
        : [];
      const [movement] = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.transactionId, transactionId)).limit(1);
      if (existing.type === "sale" && existing.productId && existing.warehouseId) {
        const [stockResult] = await tx.select({ stock: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)` })
          .from(inventoryMovements)
          .where(and(eq(inventoryMovements.productId, existing.productId), eq(inventoryMovements.warehouseId, existing.warehouseId)));
        const availableWithoutThisSale = Number(stockResult?.stock ?? 0) - Number(movement?.quantityDelta ?? 0);
        if (availableWithoutThisSale < value.quantity) throw new Error("Insufficient stock for this sale");
      }

      await tx.update(transactions).set({
        quantity: existing.productId ? value.quantity.toFixed(3) : null,
        unitPrice: existing.productId ? value.unitPrice.toFixed(2) : null,
        totalAmount: value.totalAmount.toFixed(2),
        description: value.description,
        transactionDate: value.transactionDate,
        reference: value.reference,
        version: sql`${transactions.version} + 1`,
        updatedAt: new Date(),
      }).where(eq(transactions.id, transactionId));

      if (movement) {
        await tx.update(inventoryMovements).set({
          quantityDelta: existing.type === "sale" ? (-value.quantity).toFixed(3) : value.quantity.toFixed(3),
          unitCost: existing.type === "purchase" ? value.unitPrice.toFixed(4) : Number(product?.purchasePrice ?? 0).toFixed(4),
          notes: value.description,
        }).where(eq(inventoryMovements.id, movement.id));
      }

      const [entry] = await tx.select().from(journalEntries)
        .where(and(eq(journalEntries.sourceType, "transaction"), eq(journalEntries.sourceId, transactionId))).limit(1);
      if (!entry) throw new Error("The transaction journal entry is missing.");
      await tx.delete(journalLines).where(eq(journalLines.journalEntryId, entry.id));
      await tx.update(journalEntries).set({ entryDate: value.transactionDate, description: value.description }).where(eq(journalEntries.id, entry.id));

      const accounts = await tx.select({ id: ledgerAccounts.id, code: ledgerAccounts.code }).from(ledgerAccounts)
        .where(inArray(ledgerAccounts.code, ["1000", "1100", "1200", "2000", "3000", "4000", "5000"]));
      const amount = value.totalAmount.toFixed(2);
      const base = { journalEntryId: entry.id, partyId: existing.partyId, bankAccountId: existing.bankAccountId };
      const lines: Array<typeof journalLines.$inferInsert> = [];
      const cash = accountByCode(accounts, "1000");
      const receivable = accountByCode(accounts, "1100");
      const inventory = accountByCode(accounts, "1200");
      const payable = accountByCode(accounts, "2000");
      const equity = accountByCode(accounts, "3000");
      if (existing.type === "sale") {
        lines.push(
          { ...base, accountId: existing.paymentMethod === "credit" ? receivable : cash, side: "debit", amount },
          { ...base, accountId: accountByCode(accounts, "4000"), side: "credit", amount },
        );
        const cost = product && Number(product.purchasePrice) * value.quantity;
        if (cost && cost > 0) lines.push(
          { ...base, accountId: accountByCode(accounts, "5000"), side: "debit", amount: cost.toFixed(2) },
          { ...base, accountId: inventory, side: "credit", amount: cost.toFixed(2) },
        );
      } else if (existing.type === "purchase") {
        lines.push(
          { ...base, accountId: inventory, side: "debit", amount },
          { ...base, accountId: existing.paymentMethod === "credit" ? payable : cash, side: "credit", amount },
        );
      } else if (existing.type === "bank_deposit") {
        lines.push({ ...base, accountId: cash, side: "debit", amount }, { ...base, accountId: equity, side: "credit", amount });
      } else if (existing.type === "bank_withdrawal") {
        lines.push({ ...base, accountId: equity, side: "debit", amount }, { ...base, accountId: cash, side: "credit", amount });
      } else if (existing.type === "customer_receipt") {
        lines.push({ ...base, accountId: cash, side: "debit", amount }, { ...base, accountId: receivable, side: "credit", amount });
      } else {
        lines.push({ ...base, accountId: payable, side: "debit", amount }, { ...base, accountId: cash, side: "credit", amount });
      }
      await tx.insert(journalLines).values(lines);
      await tx.insert(auditLogs).values({
        userId: user.id, action: "update", entityType: "transaction", entityId: transactionId,
        oldValues: { amount: existing.totalAmount, quantity: existing.quantity },
        newValues: { amount, quantity: existing.productId ? value.quantity.toFixed(3) : null },
      });
      await tx.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "transaction", action: "updated", id: transactionId })})`);
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Insufficient stock") || error.message.includes("no longer exists") || error.message.includes("missing"))) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(`/transactions/${transactionId}`);
}
