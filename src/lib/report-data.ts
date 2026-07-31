import "server-only";

import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  bankAccounts,
  inventoryMovements,
  parties,
  products,
  transactions,
  warehouses,
  workerPayments,
  workers,
} from "@/db/schema";
import { formatDate, formatPKR } from "./utils";

export const reportTypes = [
  "transactions",
  "party-ledger",
  "parties",
  "products",
  "stock",
  "inventory-movements",
  "workers",
  "worker-payment-status",
  "worker-payments",
  "individual-worker",
  "bank-balances",
] as const;
export type ReportType = (typeof reportTypes)[number];

type ReportRow = Record<string, string | number>;

export type ReportFilters = {
  start?: string;
  end?: string;
  partyId?: string;
  productId?: string;
  workerId?: string;
  warehouseId?: string;
};

function dateConditions(start?: string, end?: string) {
  const conditions: SQL[] = [];
  if (start) conditions.push(gte(transactions.transactionDate, start));
  if (end) conditions.push(lte(transactions.transactionDate, end));
  return conditions;
}

export async function buildReport(
  type: ReportType,
  filters: ReportFilters = {},
): Promise<{ title: string; columns: string[]; rows: ReportRow[] }> {
  const { start, end } = filters;
  if (type === "transactions") {
    const conditions = dateConditions(start, end);
    if (filters.partyId) conditions.push(eq(transactions.partyId, filters.partyId));
    if (filters.productId) conditions.push(eq(transactions.productId, filters.productId));
    const data = await db
      .select({
        number: transactions.transactionNumber,
        type: transactions.type,
        description: transactions.description,
        party: parties.name,
        product: products.name,
        quantity: transactions.quantity,
        amount: transactions.totalAmount,
        date: transactions.transactionDate,
        status: transactions.status,
        paymentMethod: transactions.paymentMethod,
      })
      .from(transactions)
      .leftJoin(parties, eq(transactions.partyId, parties.id))
      .leftJoin(products, eq(transactions.productId, products.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transactions.transactionDate));
    return {
      title: "Transactions Report",
      columns: [
        "Number",
        "Type",
        "Description",
        "Party",
        "Product",
        "Quantity",
        "Amount",
        "Date",
        "Status",
        "Payment Method",
      ],
      rows: data.map((row) => ({
        Number: row.number,
        Type: row.type.replaceAll("_", " "),
        Description: row.description,
        Party: row.party ?? "",
        Product: row.product ?? "",
        Quantity: Number(row.quantity ?? 0),
        Amount: formatPKR(row.amount),
        Date: formatDate(row.date),
        Status: row.status,
        "Payment Method": row.paymentMethod,
      })),
    };
  }

  if (type === "party-ledger" && filters.partyId) {
    const [party] = await db.select().from(parties).where(eq(parties.id, filters.partyId)).limit(1);
    if (!party) return { title: "Party Ledger", columns: [], rows: [] };
    const activity = await db
      .select({
        number: transactions.transactionNumber,
        type: transactions.type,
        description: transactions.description,
        amount: transactions.totalAmount,
        date: transactions.transactionDate,
        status: transactions.status,
        paymentMethod: transactions.paymentMethod,
      })
      .from(transactions)
      .where(eq(transactions.partyId, filters.partyId))
      .orderBy(asc(transactions.transactionDate), asc(transactions.createdAt));
    let balance = Number(party.openingReceivable) - Number(party.openingPayable);
    const rows: ReportRow[] = [];
    for (const item of activity) {
      if (item.status !== "posted") continue;
      const amount = Number(item.amount);
      const delta = item.type === "sale" || item.type === "supplier_payment"
        ? amount
        : item.type === "purchase" || item.type === "customer_receipt"
          ? -amount
          : 0;
      if (start && item.date < start) {
        balance += delta;
        continue;
      }
      if (end && item.date > end) continue;
      if (!rows.length) {
        rows.push({ Date: start ? formatDate(start) : "", Number: "", Type: "opening", Description: "Opening balance", Debit: "", Credit: "", Balance: formatPKR(balance), Payment: "" });
      }
      balance += delta;
      rows.push({
        Date: formatDate(item.date),
        Number: item.number,
        Type: item.type.replaceAll("_", " "),
        Description: item.description,
        Debit: delta > 0 ? formatPKR(delta) : "",
        Credit: delta < 0 ? formatPKR(Math.abs(delta)) : "",
        Balance: formatPKR(balance),
        Payment: item.paymentMethod.replaceAll("_", " "),
      });
    }
    if (!rows.length) {
      rows.push({ Date: start ? formatDate(start) : "", Number: "", Type: "opening", Description: "Opening balance", Debit: "", Credit: "", Balance: formatPKR(balance), Payment: "" });
    }
    return {
      title: `Party Ledger - ${party.name}`,
      columns: ["Date", "Number", "Type", "Description", "Debit", "Credit", "Balance", "Payment"],
      rows,
    };
  }

  if (type === "parties" || type === "party-ledger") {
    const partyConditions: SQL[] = [eq(parties.isActive, true)];
    if (filters.partyId) partyConditions.push(eq(parties.id, filters.partyId));
    const data = await db
      .select({
        name: parties.name,
        contact: parties.contactPerson,
        phone: parties.phone,
        email: parties.email,
        isCustomer: parties.isCustomer,
        isSupplier: parties.isSupplier,
        receivable: sql<string>`
          ${parties.openingReceivable}
          + COALESCE((SELECT SUM(total_amount) FROM transactions WHERE party_id = ${parties.id} AND type = 'sale' AND status = 'posted'), 0)
          - COALESCE((SELECT SUM(total_amount) FROM transactions WHERE party_id = ${parties.id} AND type = 'customer_receipt' AND status = 'posted'), 0)
        `,
        payable: sql<string>`
          ${parties.openingPayable}
          + COALESCE((SELECT SUM(total_amount) FROM transactions WHERE party_id = ${parties.id} AND type = 'purchase' AND status = 'posted'), 0)
          - COALESCE((SELECT SUM(total_amount) FROM transactions WHERE party_id = ${parties.id} AND type = 'supplier_payment' AND status = 'posted'), 0)
        `,
      })
      .from(parties)
      .where(and(...partyConditions))
      .orderBy(parties.name);
    return {
      title: type === "parties" ? "Parties Report" : "Party Ledger Report",
      columns: [
        "Name",
        "Type",
        "Contact",
        "Phone",
        "Email",
        "Receivable",
        "Payable",
      ],
      rows: data.map((row) => ({
        Name: row.name,
        Type:
          row.isCustomer && row.isSupplier
            ? "Customer & Supplier"
            : row.isCustomer
              ? "Customer"
              : "Supplier",
        Contact: row.contact ?? "",
        Phone: row.phone ?? "",
        Email: row.email ?? "",
        Receivable: formatPKR(row.receivable),
        Payable: formatPKR(row.payable),
      })),
    };
  }

  if (type === "products" || type === "stock") {
    const productConditions: SQL[] = [eq(products.isActive, true)];
    if (filters.productId) productConditions.push(eq(products.id, filters.productId));
    const data = await db
      .select({
        sku: products.sku,
        name: products.name,
        brand: products.brand,
        category: products.category,
        unit: products.unit,
        purchasePrice: products.purchasePrice,
        salePrice: products.salePrice,
        reorderLevel: products.reorderLevel,
        isSellable: products.isSellable,
        isPurchasable: products.isPurchasable,
        stock: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)`,
      })
      .from(products)
      .leftJoin(
        inventoryMovements,
        filters.warehouseId
          ? and(eq(products.id, inventoryMovements.productId), eq(inventoryMovements.warehouseId, filters.warehouseId))
          : eq(products.id, inventoryMovements.productId),
      )
      .where(and(...productConditions))
      .groupBy(products.id)
      .orderBy(products.name);
    return {
      title: type === "products" ? "Product Report" : "Stock Report",
      columns: [
        "SKU",
        "Product",
        "Brand",
        "Category",
        "Business Role",
        "Stock",
        "Unit",
        "Purchase Price",
        "Sale Price",
        "Stock Value",
        "Status",
      ],
      rows: data.map((row) => ({
        SKU: row.sku,
        Product: row.name,
        Brand: row.brand,
        Category: row.category ?? "",
        "Business Role": row.isSellable && row.isPurchasable ? "Sell & Purchase" : row.isSellable ? "Sell" : "Purchase",
        Stock: Number(row.stock),
        Unit: row.unit,
        "Purchase Price": formatPKR(row.purchasePrice),
        "Sale Price": formatPKR(row.salePrice),
        "Stock Value": formatPKR(Number(row.stock) * Number(row.purchasePrice)),
        Status:
          Number(row.stock) <= Number(row.reorderLevel) ? "Low stock" : "In stock",
      })),
    };
  }

  if (type === "inventory-movements") {
    const conditions: SQL[] = [];
    if (start) conditions.push(gte(inventoryMovements.occurredAt, new Date(`${start}T00:00:00`)));
    if (end) conditions.push(lte(inventoryMovements.occurredAt, new Date(`${end}T23:59:59.999`)));
    if (filters.productId) conditions.push(eq(inventoryMovements.productId, filters.productId));
    if (filters.warehouseId) conditions.push(eq(inventoryMovements.warehouseId, filters.warehouseId));
    const data = await db
      .select({
        reference: inventoryMovements.reference,
        product: products.name,
        sku: products.sku,
        warehouse: warehouses.name,
        type: inventoryMovements.movementType,
        quantity: inventoryMovements.quantityDelta,
        unitCost: inventoryMovements.unitCost,
        notes: inventoryMovements.notes,
        occurredAt: inventoryMovements.occurredAt,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(inventoryMovements.productId, products.id))
      .innerJoin(warehouses, eq(inventoryMovements.warehouseId, warehouses.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(inventoryMovements.occurredAt));
    return {
      title: "Inventory Movement Report",
      columns: ["Reference", "Product", "SKU", "Warehouse", "Movement", "Quantity", "Unit Cost", "Value", "Date", "Notes"],
      rows: data.map((row) => ({
        Reference: row.reference ?? "",
        Product: row.product,
        SKU: row.sku,
        Warehouse: row.warehouse,
        Movement: row.type.replaceAll("_", " "),
        Quantity: Number(row.quantity),
        "Unit Cost": formatPKR(row.unitCost),
        Value: formatPKR(Math.abs(Number(row.quantity)) * Number(row.unitCost)),
        Date: formatDate(row.occurredAt),
        Notes: row.notes ?? "",
      })),
    };
  }

  if (type === "worker-payments") {
    const conditions: SQL[] = [];
    if (start) conditions.push(gte(workerPayments.salaryMonth, start));
    if (end) conditions.push(lte(workerPayments.salaryMonth, end));
    if (filters.workerId) conditions.push(eq(workerPayments.workerId, filters.workerId));
    const data = await db
      .select({
        code: workers.workerCode,
        worker: workers.name,
        month: workerPayments.salaryMonth,
        gross: workerPayments.grossAmount,
        advance: workerPayments.advanceAmount,
        deduction: workerPayments.deductionAmount,
        paid: workerPayments.paidAmount,
        status: workerPayments.status,
        paidAt: workerPayments.paidAt,
        notes: workerPayments.notes,
      })
      .from(workerPayments)
      .innerJoin(workers, eq(workerPayments.workerId, workers.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(workerPayments.salaryMonth), asc(workers.name));
    return {
      title: "Worker Payment History",
      columns: ["Worker Code", "Worker", "Salary Month", "Gross Salary", "Advance", "Deduction", "Net Payable", "Paid", "Balance", "Status", "Paid Date", "Notes"],
      rows: data.map((row) => {
        const net = Number(row.gross) - Number(row.advance) - Number(row.deduction);
        return {
          "Worker Code": row.code,
          Worker: row.worker,
          "Salary Month": formatDate(row.month),
          "Gross Salary": formatPKR(row.gross),
          Advance: formatPKR(row.advance),
          Deduction: formatPKR(row.deduction),
          "Net Payable": formatPKR(net),
          Paid: formatPKR(row.paid),
          Balance: formatPKR(Math.max(net - Number(row.paid), 0)),
          Status: row.status,
          "Paid Date": row.paidAt ? formatDate(row.paidAt) : "",
          Notes: row.notes ?? "",
        };
      }),
    };
  }

  if (
    type === "workers" ||
    type === "worker-payment-status" ||
    type === "individual-worker"
  ) {
    const workerConditions: SQL[] = [];
    if (filters.workerId) workerConditions.push(eq(workers.id, filters.workerId));
    const data = await db
      .select({
        code: workers.workerCode,
        name: workers.name,
        designation: workers.designation,
        phone: workers.phone,
        salary: workers.monthlySalary,
        joiningDate: workers.joiningDate,
        status: workers.status,
        paid: sql<string>`COALESCE(SUM(${workerPayments.paidAmount}), 0)`,
        deductions: sql<string>`COALESCE(SUM(${workerPayments.deductionAmount}), 0)`,
      })
      .from(workers)
      .leftJoin(workerPayments, eq(workers.id, workerPayments.workerId))
      .where(workerConditions.length ? and(...workerConditions) : undefined)
      .groupBy(workers.id)
      .orderBy(workers.name);
    return {
      title:
        type === "workers"
          ? "Worker Report"
          : type === "worker-payment-status"
            ? "Worker Payment Status"
            : "Individual Worker Report",
      columns: [
        "Code",
        "Name",
        "Designation",
        "Phone",
        "Monthly Salary",
        "Total Paid",
        "Deductions",
        "Joining Date",
        "Status",
      ],
      rows: data.map((row) => ({
        Code: row.code,
        Name: row.name,
        Designation: row.designation ?? "",
        Phone: row.phone ?? "",
        "Monthly Salary": formatPKR(row.salary),
        "Total Paid": formatPKR(row.paid),
        Deductions: formatPKR(row.deductions),
        "Joining Date": formatDate(row.joiningDate),
        Status: row.status,
      })),
    };
  }

  const data = await db
    .select({
      name: bankAccounts.name,
      bank: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      opening: bankAccounts.openingBalance,
      movement: sql<string>`COALESCE(SUM(
        CASE
          WHEN ${transactions.type} IN ('bank_deposit', 'customer_receipt') THEN ${transactions.totalAmount}
          WHEN ${transactions.type} IN ('bank_withdrawal', 'supplier_payment') THEN -${transactions.totalAmount}
          ELSE 0
        END
      ), 0)`,
    })
    .from(bankAccounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.bankAccountId, bankAccounts.id),
        eq(transactions.status, "posted"),
      ),
    )
    .where(eq(bankAccounts.isActive, true))
    .groupBy(bankAccounts.id)
    .orderBy(asc(bankAccounts.name));
  return {
    title: "Bank Balance Report",
    columns: ["Account", "Bank", "Account Number", "Opening", "Movement", "Balance"],
    rows: data.map((row) => ({
      Account: row.name,
      Bank: row.bank ?? (row.name.includes("Cash") ? "Cash" : ""),
      "Account Number": row.accountNumber ?? "",
      Opening: formatPKR(row.opening),
      Movement: formatPKR(row.movement),
      Balance: formatPKR(Number(row.opening) + Number(row.movement)),
    })),
  };
}
