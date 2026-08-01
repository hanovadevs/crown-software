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

export type ReportRow = Record<string, string | number>;

export type ReportFilters = {
  start?: string;
  end?: string;
  partyId?: string;
  productId?: string;
  workerId?: string;
  warehouseId?: string;
};

export type PartyInfo = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  openingReceivable: number;
  openingPayable: number;
};

export type SummaryStats = {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  label1?: string;
  val1?: string;
  label2?: string;
  val2?: string;
};

export type ReportResult = {
  title: string;
  columns: string[];
  rows: ReportRow[];
  partyInfo?: PartyInfo;
  summaryStats?: SummaryStats;
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
): Promise<ReportResult> {
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

    let totalDebit = 0;
    let totalCredit = 0;
    for (const d of data) {
      if (d.status !== "posted") continue;
      const amt = Number(d.amount);
      if (["sale", "supplier_payment", "bank_withdrawal"].includes(d.type)) {
        totalDebit += amt;
      } else {
        totalCredit += amt;
      }
    }

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
      summaryStats: {
        openingBalance: 0,
        totalDebit,
        totalCredit,
        closingBalance: totalDebit - totalCredit,
        label1: "Total Volume",
        val1: formatPKR(totalDebit + totalCredit),
      },
      rows: data.map((row) => ({
        Number: row.number,
        Type: row.type.replaceAll("_", " "),
        Description: row.description,
        Party: row.party ?? "—",
        Product: row.product ?? "—",
        Quantity: Number(row.quantity ?? 0),
        Amount: formatPKR(row.amount),
        Date: formatDate(row.date),
        Status: row.status,
        "Payment Method": row.paymentMethod.replaceAll("_", " "),
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

    const openingBalance = Number(party.openingReceivable) - Number(party.openingPayable);
    let runningBalance = openingBalance;
    let periodTotalDebit = 0;
    let periodTotalCredit = 0;

    const rows: ReportRow[] = [];

    // Pre-calculate running balance up to start date
    for (const item of activity) {
      if (item.status !== "posted") continue;
      const amount = Number(item.amount);
      const delta =
        item.type === "sale" || item.type === "supplier_payment"
          ? amount
          : item.type === "purchase" || item.type === "customer_receipt"
            ? -amount
            : 0;

      if (start && item.date < start) {
        runningBalance += delta;
      }
    }

    const effectiveOpening = runningBalance;

    // Push Opening Balance Row
    rows.push({
      Date: start ? formatDate(start) : "Opening",
      Number: "—",
      Type: "Opening Balance",
      Description: "Opening balance brought forward",
      Debit: "—",
      Credit: "—",
      Balance: `${formatPKR(Math.abs(effectiveOpening))} ${effectiveOpening >= 0 ? "Dr" : "Cr"}`,
      Payment: "—",
    });

    for (const item of activity) {
      if (item.status !== "posted") continue;
      if (start && item.date < start) continue;
      if (end && item.date > end) continue;

      const amount = Number(item.amount);
      const isDebit = item.type === "sale" || item.type === "supplier_payment";
      const isCredit = item.type === "purchase" || item.type === "customer_receipt";
      const delta = isDebit ? amount : isCredit ? -amount : 0;

      if (isDebit) periodTotalDebit += amount;
      if (isCredit) periodTotalCredit += amount;

      runningBalance += delta;

      rows.push({
        Date: formatDate(item.date),
        Number: item.number,
        Type: item.type.replaceAll("_", " ").toUpperCase(),
        Description: item.description,
        Debit: isDebit ? formatPKR(amount) : "—",
        Credit: isCredit ? formatPKR(amount) : "—",
        Balance: `${formatPKR(Math.abs(runningBalance))} ${runningBalance >= 0 ? "Dr" : "Cr"}`,
        Payment: item.paymentMethod.replaceAll("_", " "),
      });
    }

    const partyInfo: PartyInfo = {
      id: party.id,
      name: party.name,
      contactPerson: party.contactPerson,
      phone: party.phone,
      email: party.email,
      address: party.address,
      taxNumber: party.taxNumber,
      isCustomer: party.isCustomer,
      isSupplier: party.isSupplier,
      openingReceivable: Number(party.openingReceivable),
      openingPayable: Number(party.openingPayable),
    };

    return {
      title: `Party Ledger - ${party.name}`,
      columns: ["Date", "Number", "Type", "Description", "Debit", "Credit", "Balance", "Payment"],
      partyInfo,
      summaryStats: {
        openingBalance: effectiveOpening,
        totalDebit: periodTotalDebit,
        totalCredit: periodTotalCredit,
        closingBalance: runningBalance,
      },
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

    let totRec = 0;
    let totPay = 0;

    const rows = data.map((party) => {
      const rec = Number(party.receivable);
      const pay = Number(party.payable);
      totRec += rec;
      totPay += pay;
      const net = rec - pay;

      return {
        Party: party.name,
        Contact: party.contact ?? "—",
        Phone: party.phone ?? "—",
        Role: party.isCustomer && party.isSupplier ? "Customer & Supplier" : party.isCustomer ? "Customer" : "Supplier",
        Receivable: formatPKR(rec),
        Payable: formatPKR(pay),
        "Net Balance": `${formatPKR(Math.abs(net))} ${net >= 0 ? "Receivable" : "Payable"}`,
      };
    });

    return {
      title: "Parties Directory & Summary Ledger",
      columns: ["Party", "Contact", "Phone", "Role", "Receivable", "Payable", "Net Balance"],
      summaryStats: {
        openingBalance: 0,
        totalDebit: totRec,
        totalCredit: totPay,
        closingBalance: totRec - totPay,
        label1: "Total Receivables",
        val1: formatPKR(totRec),
        label2: "Total Payables",
        val2: formatPKR(totPay),
      },
      rows,
    };
  }

  if (type === "products") {
    const data = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name);

    return {
      title: "Product Catalog & Pricing Report",
      columns: ["SKU", "Product Name", "Category", "Brand", "Unit", "Sale Price", "Purchase Price", "Reorder Level"],
      summaryStats: {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        label1: "Total SKUs",
        val1: String(data.length),
      },
      rows: data.map((item) => ({
        SKU: item.sku,
        "Product Name": item.name,
        Category: item.category ?? "General",
        Brand: item.brand,
        Unit: item.unit,
        "Sale Price": formatPKR(item.salePrice),
        "Purchase Price": formatPKR(item.purchasePrice),
        "Reorder Level": `${Number(item.reorderLevel).toLocaleString()} ${item.unit}`,
      })),
    };
  }

  if (type === "stock") {
    const conditions: SQL[] = [eq(products.isActive, true)];
    if (filters.productId) conditions.push(eq(products.id, filters.productId));

    const data = await db.execute(sql`
      SELECT
        p.id,
        p.sku,
        p.name,
        p.brand,
        p.category,
        p.unit,
        p.purchase_price,
        p.reorder_level,
        COALESCE(SUM(im.quantity_delta), 0) AS current_stock
      FROM products p
      LEFT JOIN inventory_movements im ON im.product_id = p.id
      WHERE p.is_active
      ${filters.productId ? sql`AND p.id = ${filters.productId}` : sql``}
      GROUP BY p.id
      ORDER BY p.name
    `);

    let totalStockUnits = 0;
    let totalValuation = 0;

    const rows = data.rows.map((row) => {
      const stock = Number(row.current_stock);
      const price = Number(row.purchase_price);
      const val = stock * price;
      totalStockUnits += stock;
      totalValuation += val;

      return {
        SKU: String(row.sku),
        Product: String(row.name),
        Brand: String(row.brand),
        Category: String(row.category || "General"),
        "Current Stock": `${stock.toLocaleString()} ${row.unit}`,
        "Reorder Level": `${Number(row.reorder_level).toLocaleString()} ${row.unit}`,
        "Stock Valuation": formatPKR(val),
        Status: stock <= Number(row.reorder_level) ? (stock <= 0 ? "OUT OF STOCK" : "LOW STOCK") : "HEALTHY",
      };
    });

    return {
      title: "Inventory Stock Levels & Valuation Report",
      columns: ["SKU", "Product", "Brand", "Category", "Current Stock", "Reorder Level", "Stock Valuation", "Status"],
      summaryStats: {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        label1: "Total Units",
        val1: totalStockUnits.toLocaleString(),
        label2: "Inventory Valuation",
        val2: formatPKR(totalValuation),
      },
      rows,
    };
  }

  if (type === "inventory-movements") {
    const conditions: SQL[] = [];
    if (filters.productId) conditions.push(eq(inventoryMovements.productId, filters.productId));
    if (filters.warehouseId) conditions.push(eq(inventoryMovements.warehouseId, filters.warehouseId));
    if (start) conditions.push(gte(inventoryMovements.occurredAt, new Date(start)));
    if (end) conditions.push(lte(inventoryMovements.occurredAt, new Date(end)));

    const data = await db
      .select({
        movementId: inventoryMovements.id,
        productName: products.name,
        sku: products.sku,
        unit: products.unit,
        warehouseName: warehouses.name,
        movementType: inventoryMovements.movementType,
        quantityDelta: inventoryMovements.quantityDelta,
        unitCost: inventoryMovements.unitCost,
        occurredAt: inventoryMovements.occurredAt,
        reference: inventoryMovements.reference,
        notes: inventoryMovements.notes,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(inventoryMovements.productId, products.id))
      .innerJoin(warehouses, eq(inventoryMovements.warehouseId, warehouses.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(inventoryMovements.occurredAt));

    return {
      title: "Stock Movement History Report",
      columns: ["Product", "SKU", "Warehouse", "Movement Type", "Quantity Delta", "Reference", "Date"],
      summaryStats: {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        label1: "Total Movements",
        val1: String(data.length),
      },
      rows: data.map((item) => {
        const qty = Number(item.quantityDelta);
        return {
          Product: item.productName,
          SKU: item.sku,
          Warehouse: item.warehouseName,
          "Movement Type": String(item.movementType).replaceAll("_", " ").toUpperCase(),
          "Quantity Delta": qty > 0 ? `+${qty.toLocaleString()} ${item.unit}` : `${qty.toLocaleString()} ${item.unit}`,
          Reference: item.reference ?? "—",
          Date: formatDate(item.occurredAt),
        };
      }),
    };
  }

  if (type === "workers" || type === "worker-payment-status" || type === "worker-payments" || type === "individual-worker") {
    const data = await db
      .select()
      .from(workers)
      .where(eq(workers.status, "active"))
      .orderBy(workers.name);

    return {
      title: "Worker Payroll & Payment Status Report",
      columns: ["Worker Code", "Worker Name", "Role", "Phone", "Monthly Salary", "Status"],
      summaryStats: {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        label1: "Active Workers",
        val1: String(data.length),
      },
      rows: data.map((worker) => ({
        "Worker Code": worker.workerCode,
        "Worker Name": worker.name,
        Role: worker.designation ?? "Worker",
        Phone: worker.phone ?? "—",
        "Monthly Salary": formatPKR(worker.monthlySalary),
        Status: worker.status,
      })),
    };
  }

  if (type === "bank-balances") {
    const data = await db.execute(sql`
      SELECT
        b.id,
        b.name,
        b.bank_name,
        b.account_number,
        b.is_cash_account,
        b.opening_balance,
        ${Number(0)} + Number(b.opening_balance)
        + COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'posted' AND (t.type IN ('bank_deposit', 'customer_receipt') OR (t.type = 'sale' AND t.payment_method IN ('cash', 'bank')))), 0)
        - COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'posted' AND (t.type IN ('bank_withdrawal', 'supplier_payment') OR (t.type = 'purchase' AND t.payment_method IN ('cash', 'bank')))), 0)
        AS current_balance
      FROM bank_accounts b
      LEFT JOIN transactions t ON (t.bank_account_id = b.id OR (b.is_cash_account AND t.payment_method = 'cash'))
      WHERE b.is_active
      GROUP BY b.id
      ORDER BY b.name
    `);

    let totalCashBank = 0;
    const rows = data.rows.map((acc) => {
      const bal = Number(acc.current_balance);
      totalCashBank += bal;
      return {
        Account: String(acc.name),
        Bank: String(acc.bank_name || "Cash Account"),
        "Account #": String(acc.account_number || "—"),
        Type: acc.is_cash_account ? "Cash in Hand" : "Bank Account",
        Balance: formatPKR(bal),
      };
    });

    return {
      title: "Bank & Cash Accounts Liquidity Report",
      columns: ["Account", "Bank", "Account #", "Type", "Balance"],
      summaryStats: {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: totalCashBank,
        label1: "Total Liquidity",
        val1: formatPKR(totalCashBank),
      },
      rows,
    };
  }

  return { title: "Report", columns: [], rows: [] };
}

function inventoryMovementTypeEnumName(type: string) {
  return type.replaceAll("_", " ").toUpperCase();
}
