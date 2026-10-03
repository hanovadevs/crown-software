"use server";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { nextDocumentNumber } from "@/db/documents";
import {
  auditLogs,
  bankAccounts,
  bills,
  billOfMaterialItems,
  billsOfMaterials,
  inventoryMovements,
  journalEntries,
  journalLines,
  ledgerAccounts,
  parties,
  products,
  transactions,
  warehouses,
  workers,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { hasPrecision, productTotal, projectCorrectedStock } from "@/lib/accounting";

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
  .pipe(z.number().finite().nonnegative());

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

  await db.execute(
    sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
      entity: "party",
      action: "created",
      id: party.id,
    })})`,
  );

  revalidatePath("/parties");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
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
    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "party",
        action: "updated",
        id: partyId,
      })})`,
    );
  });
  revalidatePath("/parties");
  revalidatePath(`/parties/${partyId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/parties/${partyId}`);
}

export async function deletePartyAction(partyId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have editing permission.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM parties WHERE id = ${partyId} FOR UPDATE`);
    const [party] = await tx.select().from(parties).where(eq(parties.id, partyId)).limit(1);
    if (!party || !party.isActive) return;
    const result = await tx.execute(sql`
      SELECT
        ${party.openingReceivable}::numeric
          + COALESCE(SUM(total_amount) FILTER (WHERE type = 'sale' AND status = 'posted' AND payment_method = 'credit'), 0)
          - COALESCE(SUM(total_amount) FILTER (WHERE type = 'customer_receipt' AND status = 'posted'), 0) AS receivable,
        ${party.openingPayable}::numeric
          + COALESCE(SUM(total_amount) FILTER (WHERE type = 'purchase' AND status = 'posted' AND payment_method = 'credit'), 0)
          - COALESCE(SUM(total_amount) FILTER (WHERE type = 'supplier_payment' AND status = 'posted'), 0) AS payable
      FROM transactions WHERE party_id = ${partyId}
    `);
    const balance = result.rows[0] as { receivable: string; payable: string };
    if (Number(balance.receivable) !== 0 || Number(balance.payable) !== 0) {
      throw new Error("Settle the party receivable and payable before archiving.");
    }
    await tx.update(parties).set({ isActive: false, updatedAt: new Date() }).where(eq(parties.id, partyId));
    await tx.insert(auditLogs).values({ userId: user.id, action: "archive", entityType: "party", entityId: partyId, oldValues: { name: party.name } });
    await tx.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "party", action: "archived", id: partyId })})`);
  });
  revalidatePath("/parties");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
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
    brand: formData.get("brand") || "SOLO",
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

    await db.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "product",
        action: "created",
        id: product.id,
      })})`,
    );
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

  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
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
      await tx.execute(
        sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
          entity: "product",
          action: "updated",
          id: productId,
        })})`,
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) return { error: "That product SKU already exists." };
    throw error;
  }
  revalidatePath("/products");
  revalidatePath(`/products/${productId}/edit`);
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect("/products");
}

export async function deleteProductAction(productId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have editing permission.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`);
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product || !product.isActive) return;
    const [stock] = await tx.select({ quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)` })
      .from(inventoryMovements).where(eq(inventoryMovements.productId, productId));
    if (Number(stock?.quantity ?? 0) !== 0) throw new Error("Bring product stock to zero before archiving.");
    const [usedInBom] = await tx.select({ id: billsOfMaterials.id }).from(billsOfMaterials)
      .where(and(eq(billsOfMaterials.finishedProductId, productId), eq(billsOfMaterials.isActive, true))).limit(1);
    const [usedAsMaterial] = await tx.select({ id: billOfMaterialItems.id }).from(billOfMaterialItems)
      .innerJoin(billsOfMaterials, eq(billOfMaterialItems.bomId, billsOfMaterials.id))
      .where(and(eq(billOfMaterialItems.materialProductId, productId), eq(billsOfMaterials.isActive, true))).limit(1);
    if (usedInBom || usedAsMaterial) throw new Error("Remove this product from active bills of materials before archiving.");
    await tx.update(products).set({ isActive: false, updatedAt: new Date() }).where(eq(products.id, productId));
    await tx.insert(auditLogs).values({ userId: user.id, action: "archive", entityType: "product", entityId: productId, oldValues: { sku: product.sku, name: product.name } });
    await tx.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "product", action: "archived", id: productId })})`);
  });
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
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
  totalAmount: z.coerce.number().finite().positive(),
  description: z.string().trim().min(2).max(2000),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(["cash", "bank", "cheque", "credit"]),
  reference: optionalString,
});

function parseTransactionForm(formData: FormData) {
  return transactionSchema.safeParse({
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
}

function transactionInputError(value: z.infer<typeof transactionSchema>): string | null {
  const partyRequired = ["sale", "purchase", "customer_receipt", "supplier_payment"].includes(value.type);
  const bankRequired = ["bank_deposit", "bank_withdrawal"].includes(value.type);
  if (partyRequired && !value.partyId) return "Select the customer or supplier for this transaction.";
  if (bankRequired && !value.bankAccountId) return "Select a bank or cash account.";
  if (value.productId && value.quantity <= 0) return "Quantity must be greater than zero for a product transaction.";
  if (value.productId && !["sale", "purchase"].includes(value.type)) return "Only sales and purchases can include a product.";
  if (!partyRequired && value.partyId) return "This transaction type cannot include a party.";
  if (!hasPrecision(value.totalAmount, 2)) return "Amount must have at most two decimal places.";
  if (value.productId && (!hasPrecision(value.quantity, 3) || !hasPrecision(value.unitPrice, 2) ||
    productTotal(value.quantity, value.unitPrice) !== value.totalAmount)) {
    return "Product total must equal quantity × unit price, rounded to two decimal places.";
  }
  if (["customer_receipt", "supplier_payment"].includes(value.type) && value.paymentMethod === "credit") {
    return "A receipt or supplier payment needs a cash, bank, or cheque payment method.";
  }
  return null;
}

function accountByCode(
  accounts: Array<{ id: string; code: string }>,
  code: string,
) {
  const account = accounts.find((candidate) => candidate.code === code);
  if (!account) throw new Error(`System ledger account ${code} is missing`);
  return account.id;
}

type TransactionInput = z.infer<typeof transactionSchema>;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PostingOptions = {
  warehouseId?: string | null;
  saleUnitCost?: string | null;
  stockAlreadyChecked?: boolean;
  originalPartyId?: string | null;
  originalProductId?: string | null;
  originalBankAccountId?: string | null;
  journalDate?: string;
};

async function postTransaction(tx: DbTransaction, user: Awaited<ReturnType<typeof requireUser>>, value: TransactionInput, options: PostingOptions = {}) {
  const bankRequired = ["bank_deposit", "bank_withdrawal"].includes(value.type);
  if (value.partyId) {
    const lockedParty = await tx.execute(sql`SELECT id, is_active, is_customer, is_supplier FROM parties WHERE id = ${value.partyId} FOR UPDATE`);
    const party = lockedParty.rows[0] as { is_active: boolean; is_customer: boolean; is_supplier: boolean } | undefined;
    if (!party || (!party.is_active && value.partyId !== options.originalPartyId)) throw new Error("The selected party is unavailable.");
    if (["sale", "customer_receipt"].includes(value.type) && !party.is_customer) throw new Error("The selected party is not registered as a customer.");
    if (["purchase", "supplier_payment"].includes(value.type) && !party.is_supplier) throw new Error("The selected party is not registered as a supplier.");
  }
  if (value.type === "sale" && value.reference) {
    const [issuedBill] = await tx.select({ billNumber: bills.billNumber }).from(bills)
      .where(and(eq(bills.billNumber, value.reference), eq(bills.partyId, value.partyId!), sql`${bills.postedTransactionId} IS NOT NULL`))
      .limit(1);
    if (issuedBill) throw new Error(`Invoice ${issuedBill.billNumber} already records this sale. Record a customer receipt for payment instead.`);
  }
  const [cashAccount] = await tx.select({ id: bankAccounts.id }).from(bankAccounts)
    .where(and(eq(bankAccounts.isActive, true), eq(bankAccounts.isCashAccount, true)))
    .orderBy(bankAccounts.createdAt, bankAccounts.id).limit(1);
  const [selectedAccount] = value.bankAccountId
    ? await tx.select({ id: bankAccounts.id, isCashAccount: bankAccounts.isCashAccount }).from(bankAccounts)
        .where(and(eq(bankAccounts.id, value.bankAccountId), options.originalBankAccountId
          ? or(eq(bankAccounts.isActive, true), eq(bankAccounts.id, options.originalBankAccountId))
          : eq(bankAccounts.isActive, true))).limit(1)
    : [];
  if (value.bankAccountId && !selectedAccount) throw new Error("The selected bank account is unavailable.");
  if (!bankRequired && ["bank", "cheque"].includes(value.paymentMethod) && (!selectedAccount || selectedAccount.isCashAccount)) {
    throw new Error("Select an active bank account for bank or cheque payments.");
  }
  if (!bankRequired && value.paymentMethod === "cash" && selectedAccount && !selectedAccount.isCashAccount) {
    throw new Error("Select a cash account for cash payments.");
  }
  if (bankRequired && !selectedAccount) throw new Error("Select an active cash or bank account.");
  const paymentMethod = bankRequired
    ? selectedAccount!.isCashAccount ? "cash" : "bank"
    : value.paymentMethod;
  const bankAccountId = bankRequired || ["bank", "cheque"].includes(paymentMethod)
    ? selectedAccount!.id
    : paymentMethod === "cash" ? selectedAccount?.id ?? cashAccount?.id : null;
  if (paymentMethod === "cash" && !bankAccountId) throw new Error("No active cash account is configured.");
  const [defaultWarehouse] = await tx
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(options.warehouseId ? eq(warehouses.id, options.warehouseId) : and(eq(warehouses.isDefault, true), eq(warehouses.isActive, true)))
    .limit(1);
  if (!defaultWarehouse) throw new Error("No default warehouse is configured");

  let selectedProduct:
    | { id: string; purchasePrice: string; name: string; isSellable: boolean; isPurchasable: boolean }
    | undefined;
  if (value.productId) {
    await tx.execute(sql`SELECT id FROM products WHERE id = ${value.productId} FOR UPDATE`);
    [selectedProduct] = await tx
      .select({
        id: products.id,
        purchasePrice: products.purchasePrice,
        name: products.name,
        isSellable: products.isSellable,
        isPurchasable: products.isPurchasable,
      })
      .from(products)
      .where(and(eq(products.id, value.productId), options.originalProductId
        ? or(eq(products.isActive, true), eq(products.id, options.originalProductId))
        : eq(products.isActive, true)))
      .limit(1);
    if (!selectedProduct) throw new Error("The selected product is unavailable");
    if (value.type === "sale" && !selectedProduct.isSellable) {
      throw new Error("The selected product is not marked as sellable");
    }
    if (value.type === "purchase" && !selectedProduct.isPurchasable) {
      throw new Error("The selected product is not marked as purchasable");
    }
  }

  if (!options.stockAlreadyChecked && value.type === "sale" && value.productId) {
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
      bankAccountId,
      warehouseId: defaultWarehouse.id,
      quantity: value.productId ? value.quantity.toFixed(3) : null,
      unitPrice: value.productId ? value.unitPrice.toFixed(2) : null,
      totalAmount: value.totalAmount.toFixed(2),
      paymentMethod,
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
        : Number(options.saleUnitCost ?? selectedProduct.purchasePrice).toFixed(4),
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
  const journalDate = options.journalDate ?? value.transactionDate;
  const entryNumber = await nextDocumentNumber(
    tx as unknown as Parameters<typeof nextDocumentNumber>[0],
    "journal",
    "JRN",
    new Date(`${journalDate}T00:00:00+05:00`),
  );
  const [entry] = await tx
    .insert(journalEntries)
    .values({
      entryNumber,
      entryDate: journalDate,
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
    bankAccountId,
  };

  const cashOrBank = cash;

  if (value.type === "sale") {
    lines.push(
      {
        ...base,
        accountId: paymentMethod === "credit" ? receivable : cashOrBank,
        side: "debit",
        amount,
      },
      { ...base, accountId: revenue, side: "credit", amount },
    );
    const cost =
      selectedProduct &&
      Number(options.saleUnitCost ?? selectedProduct.purchasePrice) * value.quantity;
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
      { ...base, accountId: selectedProduct ? inventory : costOfGoods, side: "debit", amount },
      {
        ...base,
        accountId: paymentMethod === "credit" ? payable : cashOrBank,
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
  return created;
}

export async function createTransactionAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };

  const parsed = parseTransactionForm(formData);

  if (!parsed.success) return validationState(parsed.error);

  const value = parsed.data;
  const inputError = transactionInputError(value);
  if (inputError) return { error: inputError };

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
      await postTransaction(tx, user, value);
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Insufficient stock") ||
        error.message.includes("unavailable") ||
        error.message.includes("warehouse") ||
        error.message.includes("not marked") ||
        error.message.includes("not registered") ||
        error.message.includes("Invoice") ||
        error.message.includes("account"))
    ) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/parties");
  revalidatePath("/stock");
  revalidatePath("/reports");
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
    await db.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "worker",
        action: "created",
        id: worker.id,
      })})`,
    );
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
  revalidatePath("/workers");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
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
      await tx.execute(
        sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
          entity: "worker",
          action: "updated",
          id: workerId,
        })})`,
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) return { error: "That worker code already exists." };
    throw error;
  }
  revalidatePath("/workers");
  revalidatePath(`/workers/${workerId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect("/workers");
}

export async function deleteWorkerAction(workerId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have editing permission.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM workers WHERE id = ${workerId} FOR UPDATE`);
    const [worker] = await tx.select().from(workers).where(eq(workers.id, workerId)).limit(1);
    if (!worker || worker.status === "inactive") return;
    await tx.update(workers).set({ status: "inactive", updatedAt: new Date() }).where(eq(workers.id, workerId));
    await tx.insert(auditLogs).values({ userId: user.id, action: "archive", entityType: "worker", entityId: workerId,
      oldValues: { status: worker.status }, newValues: { status: "inactive" } });
    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "worker",
        action: "archived",
        id: workerId,
      })})`,
    );
  });
  revalidatePath("/workers");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect("/workers");
}

async function reverseTransaction(tx: DbTransaction, user: Awaited<ReturnType<typeof requireUser>>, transactionId: string, options: { stockAlreadyChecked?: boolean } = {}) {
  await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
  const [original] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!original) throw new Error("Transaction no longer exists.");
  const [linkedBill] = await tx.select({ billNumber: bills.billNumber }).from(bills).where(eq(bills.postedTransactionId, transactionId)).limit(1);
  if (linkedBill) throw new Error(`Cancel invoice ${linkedBill.billNumber} to reverse its sale and stock together.`);
  if (original.status !== "posted") throw new Error("Only posted transactions can be reversed.");

  const movements = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.transactionId, transactionId));
  for (const productId of [...new Set(movements.map((movement) => movement.productId))].sort()) {
    await tx.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`);
  }
  for (const movement of movements) {
    if (!options.stockAlreadyChecked && Number(movement.quantityDelta) > 0) {
      const [stock] = await tx.select({ quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)` })
        .from(inventoryMovements)
        .where(and(eq(inventoryMovements.productId, movement.productId), eq(inventoryMovements.warehouseId, movement.warehouseId)));
      if (Number(stock?.quantity ?? 0) < Number(movement.quantityDelta)) {
        throw new Error("Cannot reverse this purchase because its stock has already been used.");
      }
    }
    await tx.insert(inventoryMovements).values({
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      transactionId,
      movementType: Number(movement.quantityDelta) < 0 ? "return_in" : "return_out",
      quantityDelta: (-Number(movement.quantityDelta)).toFixed(3),
      unitCost: movement.unitCost,
      reference: `REV-${original.transactionNumber}`,
      notes: `Reversal of ${original.transactionNumber}`,
      createdBy: user.id,
    });
  }

  const [entry] = await tx.select().from(journalEntries)
    .where(and(eq(journalEntries.sourceType, "transaction"), eq(journalEntries.sourceId, transactionId))).limit(1);
  if (!entry) throw new Error("The transaction journal entry is missing.");
  const originalLines = await tx.select().from(journalLines).where(eq(journalLines.journalEntryId, entry.id));
  if (!originalLines.length) throw new Error("The transaction journal lines are missing.");
  const reversalDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [reversal] = await tx.insert(journalEntries).values({
    entryNumber: await nextDocumentNumber(
      tx as unknown as Parameters<typeof nextDocumentNumber>[0],
      "journal", "JRN", new Date(`${reversalDate}T00:00:00+05:00`),
    ),
    entryDate: reversalDate,
    description: `Reversal of ${original.transactionNumber}: ${original.description}`,
    sourceType: "transaction_reversal",
    sourceId: transactionId,
    reversalOfId: entry.id,
    createdBy: user.id,
  }).returning({ id: journalEntries.id });
  await tx.insert(journalLines).values(originalLines.map((line) => ({
    journalEntryId: reversal.id,
    accountId: line.accountId,
    partyId: line.partyId,
    bankAccountId: line.bankAccountId,
    side: line.side === "debit" ? "credit" as const : "debit" as const,
    amount: line.amount,
    memo: `Reversal of ${original.transactionNumber}`,
  })));
  await tx.update(transactions).set({ status: "reversed", updatedAt: new Date(), version: sql`${transactions.version} + 1` })
    .where(eq(transactions.id, transactionId));
  if (original.type === "customer_receipt" && original.reference && original.partyId) {
    const [linkedBill] = await tx.select().from(bills).where(and(
      eq(bills.billNumber, original.reference), eq(bills.partyId, original.partyId), eq(bills.status, "paid"),
      sql`${bills.postedTransactionId} IS NOT NULL`,
    )).limit(1);
    if (linkedBill) {
      const [remaining] = await tx.select({ amount: sql<string>`COALESCE(SUM(${transactions.totalAmount}), 0)` })
        .from(transactions).where(and(
          eq(transactions.type, "customer_receipt"), eq(transactions.status, "posted"),
          eq(transactions.partyId, original.partyId), eq(transactions.reference, original.reference),
        ));
      if (Number(remaining?.amount ?? 0) < Number(linkedBill.totalAmount)) {
        await tx.update(bills).set({ status: "issued", updatedAt: new Date() }).where(eq(bills.id, linkedBill.id));
      }
    }
  }
  await tx.insert(auditLogs).values({
    userId: user.id, action: "reverse", entityType: "transaction", entityId: transactionId,
    oldValues: { status: original.status, amount: original.totalAmount },
    newValues: { status: "reversed", reversalJournalId: reversal.id },
  });
  await tx.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "transaction", action: "reversed", id: transactionId })})`);
  return original;
}

export async function deleteTransactionAction(transactionId: string) {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("You do not have editing permission.");
  await db.transaction(async (tx) => {
    await reverseTransaction(tx, user, transactionId);
  });
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/parties");
  revalidatePath("/stock");
  revalidatePath("/reports");
  revalidatePath("/bills");
  redirect(`/transactions/${transactionId}`);
}

export async function updateTransactionAction(
  transactionId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!canEdit(user.role)) return { error: "You do not have editing permission." };
  const parsed = parseTransactionForm(formData);
  if (!parsed.success) return validationState(parsed.error);
  const value = parsed.data;
  const inputError = transactionInputError(value);
  if (inputError) return { error: inputError };
  const expectedVersion = Number(formData.get("version"));
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { error: "Reload this transaction before editing." };

  let destinationId = transactionId;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
      const [existing] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
      if (!existing) throw new Error("Transaction no longer exists.");
      const [linkedBill] = await tx.select({ billNumber: bills.billNumber }).from(bills).where(eq(bills.postedTransactionId, transactionId)).limit(1);
      if (linkedBill) throw new Error(`Invoice ${linkedBill.billNumber} owns this sale. Cancel and reissue the invoice to correct its amount or stock.`);
      if (existing.status !== "posted") throw new Error("Only posted transactions can be edited.");
      if (existing.version !== expectedVersion) throw new Error("This transaction changed since you opened it. Reload before saving.");
      const changed = value.type !== existing.type || value.partyId !== existing.partyId ||
        value.productId !== existing.productId || value.transactionDate !== existing.transactionDate ||
        value.totalAmount.toFixed(2) !== existing.totalAmount ||
        (value.productId && (value.quantity.toFixed(3) !== existing.quantity || value.unitPrice.toFixed(2) !== existing.unitPrice)) ||
        (!["bank_deposit", "bank_withdrawal"].includes(value.type) && value.paymentMethod !== existing.paymentMethod) ||
        value.bankAccountId !== existing.bankAccountId ||
        value.description !== existing.description || value.reference !== existing.reference;
      if (!changed) return;

      const partyIds = [...new Set([existing.partyId, value.partyId].filter((id): id is string => Boolean(id)))].sort();
      for (const id of partyIds) await tx.execute(sql`SELECT id FROM parties WHERE id = ${id} FOR UPDATE`);
      const originalMovements = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.transactionId, transactionId));
      if (originalMovements.length !== (existing.productId ? 1 : 0) ||
        (existing.productId && originalMovements[0]?.productId !== existing.productId)) {
        throw new Error("The original stock movement is missing or ambiguous. Review this transaction before correcting it.");
      }
      const warehouseId = originalMovements[0]?.warehouseId ?? existing.warehouseId;
      const productIds = [...new Set([existing.productId, value.productId].filter((id): id is string => Boolean(id)))].sort();
      for (const id of productIds) await tx.execute(sql`SELECT id FROM products WHERE id = ${id} FOR UPDATE`);
      const stockPositions = [];
      for (const id of productIds) {
        const [stock] = await tx.select({ quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)` })
          .from(inventoryMovements).where(and(eq(inventoryMovements.productId, id), eq(inventoryMovements.warehouseId, warehouseId)));
        stockPositions.push({ productId: id, warehouseId, quantity: Number(stock?.quantity ?? 0) });
      }
      const replacementMovements = value.productId ? [{
        productId: value.productId, warehouseId,
        quantityDelta: value.type === "sale" ? -value.quantity : value.quantity,
      }] : [];
      const projected = projectCorrectedStock(stockPositions, originalMovements.map((movement) => ({
        productId: movement.productId, warehouseId: movement.warehouseId, quantityDelta: Number(movement.quantityDelta),
      })), replacementMovements);
      if (projected.some((position) => position.quantity < 0)) {
        throw new Error("This correction would leave negative stock. Check subsequent sales or choose a smaller quantity.");
      }

      const [paidBill] = existing.type === "customer_receipt" && existing.reference && existing.partyId
        ? await tx.select({ id: bills.id, totalAmount: bills.totalAmount }).from(bills).where(and(
            eq(bills.billNumber, existing.reference), eq(bills.partyId, existing.partyId), eq(bills.status, "paid"),
            sql`${bills.postedTransactionId} IS NOT NULL`,
          )).limit(1)
        : [];
      await reverseTransaction(tx, user, transactionId, { stockAlreadyChecked: true });
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const replacement = await postTransaction(tx, user, value, {
        stockAlreadyChecked: true, warehouseId,
        originalPartyId: existing.partyId, originalProductId: existing.productId,
        originalBankAccountId: existing.bankAccountId,
        saleUnitCost: value.type === "sale" && value.productId === existing.productId
          ? originalMovements[0]?.unitCost : null,
        journalDate: today,
      });
      destinationId = replacement.id;
      await tx.update(transactions).set({ reversedTransactionId: replacement.id }).where(eq(transactions.id, transactionId));
      if (paidBill && value.type === "customer_receipt" && value.partyId === existing.partyId && value.reference === existing.reference) {
        const [receipts] = await tx.select({ amount: sql<string>`COALESCE(SUM(${transactions.totalAmount}), 0)` })
          .from(transactions).where(and(eq(transactions.type, "customer_receipt"), eq(transactions.status, "posted"),
            eq(transactions.partyId, value.partyId!), eq(transactions.reference, value.reference!)));
        if (Number(receipts?.amount ?? 0) >= Number(paidBill.totalAmount)) {
          await tx.update(bills).set({ status: "paid", updatedAt: new Date() }).where(eq(bills.id, paidBill.id));
        }
      }
      await tx.insert(auditLogs).values({
        userId: user.id, action: "update", entityType: "transaction", entityId: transactionId,
        oldValues: { number: existing.transactionNumber, amount: existing.totalAmount, date: existing.transactionDate },
        newValues: { replacementId: replacement.id, number: replacement.transactionNumber, amount: replacement.totalAmount, date: replacement.transactionDate },
      });
      await tx.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "transaction", action: "corrected", id: replacement.id })})`);
    });
  } catch (error) {
    if (error instanceof Error && ["no longer exists", "missing", "Invoice", "Only posted", "changed since", "negative stock", "unavailable", "warehouse", "not marked", "not registered", "account", "stock movement", "already records"].some((part) => error.message.includes(part))) return { error: error.message };
    throw error;
  }
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath(`/transactions/${destinationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/parties");
  revalidatePath("/stock");
  revalidatePath("/reports");
  revalidatePath("/bills");
  redirect(`/transactions/${destinationId}`);
}
