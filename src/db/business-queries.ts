import "server-only";

import {
  and,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from ".";
import {
  bankAccounts,
  inventoryMovements,
  parties,
  products,
  transactions,
  warehouses,
  workers,
} from "./schema";

export async function listParties(search = "", type = "all") {
  const conditions: SQL[] = [eq(parties.isActive, true)];
  if (search) {
    conditions.push(
      or(
        ilike(parties.name, `%${search}%`),
        ilike(parties.contactPerson, `%${search}%`),
        ilike(parties.phone, `%${search}%`),
        ilike(parties.email, `%${search}%`),
      )!,
    );
  }
  if (type === "customer") conditions.push(eq(parties.isCustomer, true));
  if (type === "supplier") conditions.push(eq(parties.isSupplier, true));
  if (type === "both") {
    conditions.push(eq(parties.isCustomer, true), eq(parties.isSupplier, true));
  }

  return db
    .select({
      id: parties.id,
      name: parties.name,
      contactPerson: parties.contactPerson,
      phone: parties.phone,
      email: parties.email,
      address: parties.address,
      isCustomer: parties.isCustomer,
      isSupplier: parties.isSupplier,
      receivable: sql<string>`
        ${parties.openingReceivable}
        + COALESCE(SUM(${transactions.totalAmount}) FILTER (WHERE ${transactions.status} = 'posted' AND ${transactions.type} = 'sale'), 0)
        - COALESCE(SUM(${transactions.totalAmount}) FILTER (WHERE ${transactions.status} = 'posted' AND ${transactions.type} = 'customer_receipt'), 0)
      `,
      payable: sql<string>`
        ${parties.openingPayable}
        + COALESCE(SUM(${transactions.totalAmount}) FILTER (WHERE ${transactions.status} = 'posted' AND ${transactions.type} = 'purchase'), 0)
        - COALESCE(SUM(${transactions.totalAmount}) FILTER (WHERE ${transactions.status} = 'posted' AND ${transactions.type} = 'supplier_payment'), 0)
      `,
    })
    .from(parties)
    .leftJoin(transactions, eq(parties.id, transactions.partyId))
    .where(and(...conditions))
    .groupBy(parties.id)
    .orderBy(parties.name);
}

export async function getParty(partyId: string) {
  const [party] = await db
    .select()
    .from(parties)
    .where(and(eq(parties.id, partyId), eq(parties.isActive, true)))
    .limit(1);
  if (!party) return null;

  const [activity, balanceResult] = await Promise.all([
    db.select({
      id: transactions.id,
      number: transactions.transactionNumber,
      type: transactions.type,
      description: transactions.description,
      amount: transactions.totalAmount,
      date: transactions.transactionDate,
      status: transactions.status,
      paymentMethod: transactions.paymentMethod,
    })
    .from(transactions)
    .where(eq(transactions.partyId, partyId))
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
      .limit(100),
    db.execute(sql`
      SELECT
        ${Number(party.openingReceivable)}
          + COALESCE(SUM(total_amount) FILTER (WHERE type = 'sale' AND status = 'posted'), 0)
          - COALESCE(SUM(total_amount) FILTER (WHERE type = 'customer_receipt' AND status = 'posted'), 0) AS receivable,
        ${Number(party.openingPayable)}
          + COALESCE(SUM(total_amount) FILTER (WHERE type = 'purchase' AND status = 'posted'), 0)
          - COALESCE(SUM(total_amount) FILTER (WHERE type = 'supplier_payment' AND status = 'posted'), 0) AS payable
      FROM transactions
      WHERE party_id = ${partyId}
    `),
  ]);
  const balances = balanceResult.rows[0] as { receivable: string; payable: string };
  const receivable = Number(balances.receivable);
  const payable = Number(balances.payable);

  return { party, activity, receivable, payable };
}

export async function listProducts(search = "") {
  const condition = search
    ? and(
        eq(products.isActive, true),
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.category, `%${search}%`),
          ilike(products.brand, `%${search}%`),
        ),
      )
    : eq(products.isActive, true);

  return db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      brand: products.brand,
      unit: products.unit,
      salePrice: products.salePrice,
      purchasePrice: products.purchasePrice,
      reorderLevel: products.reorderLevel,
      isSellable: products.isSellable,
      isPurchasable: products.isPurchasable,
      isRawMaterial: products.isRawMaterial,
      isFinishedGood: products.isFinishedGood,
      stock: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)`,
    })
    .from(products)
    .leftJoin(inventoryMovements, eq(products.id, inventoryMovements.productId))
    .where(condition)
    .groupBy(products.id)
    .orderBy(products.name);
}

export async function getTransactionFormOptions() {
  const [partyOptions, productOptions, accountOptions] = await Promise.all([
    db
      .select({
        id: parties.id,
        name: parties.name,
        isCustomer: parties.isCustomer,
        isSupplier: parties.isSupplier,
      })
      .from(parties)
      .where(eq(parties.isActive, true))
      .orderBy(parties.name),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        salePrice: products.salePrice,
        purchasePrice: products.purchasePrice,
        isSellable: products.isSellable,
        isPurchasable: products.isPurchasable,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name),
    db
      .select({
        id: bankAccounts.id,
        name: bankAccounts.name,
        isCashAccount: bankAccounts.isCashAccount,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.isActive, true))
      .orderBy(bankAccounts.name),
  ]);

  return { parties: partyOptions, products: productOptions, accounts: accountOptions };
}

export async function getProduct(productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.isActive, true)))
    .limit(1);
  return product ?? null;
}

export async function listTransactions(search = "", type = "all", partyId = "all") {
  const conditions: SQL[] = [];
  if (type !== "all") {
    conditions.push(
      eq(
        transactions.type,
        type as
          | "sale"
          | "purchase"
          | "bank_deposit"
          | "bank_withdrawal"
          | "customer_receipt"
          | "supplier_payment"
          | "adjustment",
      ),
    );
  }
  if (partyId !== "all") conditions.push(eq(transactions.partyId, partyId));
  if (search) {
    conditions.push(
      or(
        ilike(transactions.transactionNumber, `%${search}%`),
        ilike(transactions.description, `%${search}%`),
        ilike(parties.name, `%${search}%`),
        ilike(products.name, `%${search}%`),
        ilike(bankAccounts.name, `%${search}%`),
      )!,
    );
  }

  return db
    .select({
      id: transactions.id,
      number: transactions.transactionNumber,
      type: transactions.type,
      status: transactions.status,
      description: transactions.description,
      partyName: parties.name,
      productName: products.name,
      productId: products.id,
      bankName: bankAccounts.name,
      quantity: transactions.quantity,
      unitPrice: transactions.unitPrice,
      amount: transactions.totalAmount,
      date: transactions.transactionDate,
      paymentMethod: transactions.paymentMethod,
    })
    .from(transactions)
    .leftJoin(parties, eq(transactions.partyId, parties.id))
    .leftJoin(products, eq(transactions.productId, products.id))
    .leftJoin(bankAccounts, eq(transactions.bankAccountId, bankAccounts.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
    .limit(200);
}

export async function getTransactionDetail(id: string) {
  const [transaction] = await db
    .select({
      id: transactions.id,
      number: transactions.transactionNumber,
      type: transactions.type,
      status: transactions.status,
      description: transactions.description,
      reference: transactions.reference,
      partyName: parties.name,
      partyId: parties.id,
      partyPhone: parties.phone,
      productName: products.name,
      productId: products.id,
      productSku: products.sku,
      bankName: bankAccounts.name,
      quantity: transactions.quantity,
      unitPrice: transactions.unitPrice,
      amount: transactions.totalAmount,
      date: transactions.transactionDate,
      paymentMethod: transactions.paymentMethod,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .leftJoin(parties, eq(transactions.partyId, parties.id))
    .leftJoin(products, eq(transactions.productId, products.id))
    .leftJoin(bankAccounts, eq(transactions.bankAccountId, bankAccounts.id))
    .where(eq(transactions.id, id))
    .limit(1);
  return transaction ?? null;
}

export async function stockSummary() {
  return db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      unit: products.unit,
      reorderLevel: products.reorderLevel,
      salePrice: products.salePrice,
      purchasePrice: products.purchasePrice,
      stock: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)`,
    })
    .from(products)
    .leftJoin(inventoryMovements, eq(products.id, inventoryMovements.productId))
    .where(eq(products.isActive, true))
    .groupBy(products.id)
    .orderBy(products.name);
}

export async function getStockAdjustmentOptions() {
  const [productOptions, warehouseOptions] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        unit: products.unit,
        purchasePrice: products.purchasePrice,
        stock: sql<string>`COALESCE((SELECT SUM(quantity_delta) FROM inventory_movements WHERE product_id = ${products.id}), 0)`,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name),
    db
      .select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.isActive, true))
      .orderBy(warehouses.name),
  ]);
  return { products: productOptions, warehouses: warehouseOptions };
}

export async function listStockMovements(limit = 100) {
  return db
    .select({
      id: inventoryMovements.id,
      productName: products.name,
      sku: products.sku,
      warehouseName: warehouses.name,
      movementType: inventoryMovements.movementType,
      quantityDelta: inventoryMovements.quantityDelta,
      unitCost: inventoryMovements.unitCost,
      reference: inventoryMovements.reference,
      notes: inventoryMovements.notes,
      occurredAt: inventoryMovements.occurredAt,
      transactionId: inventoryMovements.transactionId,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(inventoryMovements.productId, products.id))
    .innerJoin(warehouses, eq(inventoryMovements.warehouseId, warehouses.id))
    .orderBy(desc(inventoryMovements.occurredAt))
    .limit(limit);
}

export async function getReportFilterOptions() {
  try {
    const [partyOptions, productOptions, workerOptions, warehouseOptions] = await Promise.all([
      listParties(),
      db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).where(eq(products.isActive, true)).orderBy(products.name),
      db.select({ id: workers.id, name: workers.name, code: workers.workerCode, phone: workers.phone }).from(workers).orderBy(workers.name),
      db.select({ id: warehouses.id, name: warehouses.name, code: warehouses.code }).from(warehouses).where(eq(warehouses.isActive, true)).orderBy(warehouses.name),
    ]);
    return { parties: partyOptions, products: productOptions, workers: workerOptions, warehouses: warehouseOptions };
  } catch (error) {
    console.error("getReportFilterOptions error:", error);
    return { parties: [], products: [], workers: [], warehouses: [] };
  }
}
