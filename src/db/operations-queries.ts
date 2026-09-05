import "server-only";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from ".";
import {
  appSettings,
  bills,
  gatePasses,
  notifications,
  parties,
  products,
  transactions,
  workerPayments,
  workers,
} from "./schema";

export async function listWorkers() {
  return db
    .select({
      id: workers.id,
      code: workers.workerCode,
      name: workers.name,
      phone: workers.phone,
      designation: workers.designation,
      monthlySalary: workers.monthlySalary,
      joiningDate: workers.joiningDate,
      status: workers.status,
      totalPaid: sql<string>`COALESCE(SUM(${workerPayments.paidAmount}), 0)`,
    })
    .from(workers)
    .leftJoin(workerPayments, eq(workers.id, workerPayments.workerId))
    .groupBy(workers.id)
    .orderBy(workers.name);
}

export async function getWorker(id: string) {
  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  return worker ?? null;
}

export async function getWorkerWithPayments(id: string) {
  const worker = await getWorker(id);
  if (!worker) return null;
  const payments = await db
    .select()
    .from(workerPayments)
    .where(eq(workerPayments.workerId, id))
    .orderBy(desc(workerPayments.salaryMonth), desc(workerPayments.createdAt));
  return { worker, payments };
}

export async function getWorkerPaymentOptions() {
  return db
    .select({
      id: workers.id,
      code: workers.workerCode,
      name: workers.name,
      monthlySalary: workers.monthlySalary,
    })
    .from(workers)
    .where(eq(workers.status, "active"))
    .orderBy(workers.name);
}

export async function listNotifications(userId: string) {
  try {
    const generatedAlerts: Array<{
      id: string;
      title: string;
      message: string;
      type: "stock" | "gate_pass" | "payment" | "system";
      link: string;
      severity: "danger" | "warning" | "info";
      createdAt: Date;
    }> = [];

    // 1. Fetch Low Stock Products with Drizzle
    try {
      const activeProducts = await db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          unit: products.unit,
          reorderLevel: products.reorderLevel,
          currentStock: sql<string>`COALESCE((SELECT SUM(quantity_delta) FROM inventory_movements WHERE product_id = ${products.id}), 0)`,
        })
        .from(products)
        .where(eq(products.isActive, true))
        .limit(100);

      for (const prod of activeProducts) {
        const stock = Number(prod.currentStock || 0);
        const minThreshold = Number(prod.reorderLevel ?? 10);
        if (stock <= minThreshold) {
          generatedAlerts.push({
            id: `stock-${prod.id}`,
            title: `Low Stock Alert: ${prod.name}`,
            message: `Current stock level is ${stock} ${prod.unit} (reorder threshold: ${minThreshold} ${prod.unit}). Consider restocking immediately.`,
            type: "stock",
            link: "/stock/adjust",
            severity: stock <= 0 ? "danger" : "warning",
            createdAt: new Date(),
          });
        }
      }
    } catch (e) {
      console.warn("Low stock notification fetch warning:", e);
    }

    // 2. Fetch Returnable Gate Passes with Drizzle inArray
    try {
      const gpAlerts = await db
        .select({
          id: gatePasses.id,
          number: gatePasses.gatePassNumber,
          direction: gatePasses.direction,
          vehicleNumber: gatePasses.vehicleNumber,
          driverName: gatePasses.driverName,
          createdAt: gatePasses.createdAt,
        })
        .from(gatePasses)
        .where(and(eq(gatePasses.isReturnable, true), inArray(gatePasses.status, ["issued", "draft"])))
        .orderBy(desc(gatePasses.createdAt))
        .limit(10);

      for (const gp of gpAlerts) {
        generatedAlerts.push({
          id: `gp-${gp.id}`,
          title: `Returnable Gate Pass: ${gp.number}`,
          message: `Material dispatch ${gp.number} (${gp.driverName || "Driver"} - ${gp.vehicleNumber || "Vehicle"}) is marked returnable and awaiting return.`,
          type: "gate_pass",
          link: `/gate-pass/${gp.id}`,
          severity: "info",
          createdAt: new Date(gp.createdAt),
        });
      }
    } catch (e) {
      console.warn("Gate pass notification fetch warning:", e);
    }

    // 3. Fetch Customer Receivables with Drizzle
    try {
      const customerParties = await db
        .select({
          id: parties.id,
          name: parties.name,
          phone: parties.phone,
          receivable: sql<string>`
            ${parties.openingReceivable}
            + COALESCE((SELECT SUM(total_amount) FROM transactions WHERE party_id = ${parties.id} AND status = 'posted' AND type = 'sale'), 0)
            - COALESCE((SELECT SUM(total_amount) FROM transactions WHERE party_id = ${parties.id} AND status = 'posted' AND type = 'customer_receipt'), 0)
          `,
        })
        .from(parties)
        .where(and(eq(parties.isActive, true), eq(parties.isCustomer, true)))
        .limit(50);

      for (const cp of customerParties) {
        const bal = Number(cp.receivable || 0);
        if (bal > 5000) {
          generatedAlerts.push({
            id: `party-${cp.id}`,
            title: `Outstanding Receivable: ${cp.name}`,
            message: `Pending customer ledger balance of PKR ${bal.toLocaleString()} requires collection/follow up.`,
            type: "payment",
            link: "/parties",
            severity: bal > 100000 ? "danger" : "warning",
            createdAt: new Date(),
          });
        }
      }
    } catch (e) {
      console.warn("Receivable notification fetch warning:", e);
    }

    // 4. Fetch Stored DB Notifications
    try {
      const dbNotes = await db
        .select()
        .from(notifications)
        .where(or(eq(notifications.userId, userId), sql`${notifications.userId} IS NULL`))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      for (const note of dbNotes) {
        generatedAlerts.push({
          id: note.id,
          title: note.title,
          message: note.message,
          type: "system",
          link: "/dashboard",
          severity: "info",
          createdAt: note.createdAt,
        });
      }
    } catch (e) {
      console.warn("DB notifications fetch warning:", e);
    }

    return generatedAlerts;
  } catch (err) {
    console.error("listNotifications error:", err);
    return [];
  }
}

export async function globalSearch(query: string) {
  if (query.trim().length < 2) {
    return { parties: [], products: [], transactions: [], bills: [], gatePasses: [], workers: [] };
  }
  const term = `%${query.trim()}%`;
  const [partyResults, productResults, transactionResults, billResults, gatePassResults, workerResults] = await Promise.all([
    db
      .select({ id: parties.id, name: parties.name, phone: parties.phone })
      .from(parties)
      .where(
        or(
          ilike(parties.name, term),
          ilike(parties.contactPerson, term),
          ilike(parties.phone, term),
        ),
      )
      .limit(10),
    db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(or(ilike(products.name, term), ilike(products.sku, term)))
      .limit(10),
    db
      .select({
        id: transactions.id,
        number: transactions.transactionNumber,
        description: transactions.description,
      })
      .from(transactions)
      .where(
        or(
          ilike(transactions.transactionNumber, term),
          ilike(transactions.description, term),
        ),
      )
      .limit(10),
    db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        type: bills.type,
        totalAmount: bills.totalAmount,
      })
      .from(bills)
      .where(ilike(bills.billNumber, term))
      .limit(10),
    db
      .select({
        id: gatePasses.id,
        gatePassNumber: gatePasses.gatePassNumber,
        direction: gatePasses.direction,
        driverName: gatePasses.driverName,
        vehicleNumber: gatePasses.vehicleNumber,
      })
      .from(gatePasses)
      .where(
        or(
          ilike(gatePasses.gatePassNumber, term),
          ilike(gatePasses.driverName, term),
          ilike(gatePasses.vehicleNumber, term),
        ),
      )
      .limit(10),
    db
      .select({
        id: workers.id,
        name: workers.name,
        workerCode: workers.workerCode,
        designation: workers.designation,
      })
      .from(workers)
      .where(
        or(
          ilike(workers.name, term),
          ilike(workers.workerCode, term),
          ilike(workers.phone, term),
        ),
      )
      .limit(10),
  ]);
  return {
    parties: partyResults,
    products: productResults,
    transactions: transactionResults,
    bills: billResults,
    gatePasses: gatePassResults,
    workers: workerResults,
  };
}

export async function getCompanySettings() {
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
