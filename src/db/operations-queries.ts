import "server-only";

import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from ".";
import {
  appSettings,
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
    const [dbNotes, lowStockProducts, gatePassAlerts, partyBalances] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(or(eq(notifications.userId, userId), sql`${notifications.userId} IS NULL`))
        .orderBy(desc(notifications.createdAt))
        .limit(50),
      db.execute(sql`
        SELECT p.id, p.name, p.sku, p.unit, p.reorder_level, COALESCE(SUM(im.quantity_delta), 0) AS current_stock
        FROM products p
        LEFT JOIN inventory_movements im ON im.product_id = p.id
        WHERE p.is_active
        GROUP BY p.id
        HAVING COALESCE(SUM(im.quantity_delta), 0) <= p.reorder_level
        LIMIT 20
      `),
      db.execute(sql`
        SELECT id, gate_pass_number, direction, party_id, vehicle_number, driver_name, expected_return_date, created_at
        FROM gate_passes
        WHERE is_returnable = true AND status IN ('issued', 'draft')
        ORDER BY created_at DESC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT p.id, p.name, p.phone,
          ${parties.openingReceivable}
            + COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'posted' AND t.type = 'sale'), 0)
            - COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'posted' AND t.type = 'customer_receipt'), 0) AS receivable
        FROM parties p
        LEFT JOIN transactions t ON t.party_id = p.id
        WHERE p.is_active AND p.is_customer
        GROUP BY p.id
        HAVING (${parties.openingReceivable}
          + COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'posted' AND t.type = 'sale'), 0)
          - COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'posted' AND t.type = 'customer_receipt'), 0)) > 5000
        ORDER BY receivable DESC
        LIMIT 10
      `),
    ]);

    const generatedAlerts: Array<{
      id: string;
      title: string;
      message: string;
      type: "stock" | "gate_pass" | "payment" | "system";
      link: string;
      severity: "danger" | "warning" | "info";
      createdAt: Date;
    }> = [];

    // Low stock alerts
    for (const row of lowStockProducts.rows as Array<{ id: string; name: string; sku: string; unit: string; reorder_level: string; current_stock: string }>) {
      const stock = Number(row.current_stock);
      const min = Number(row.reorder_level);
      generatedAlerts.push({
        id: `stock-${row.id}`,
        title: `Low Stock Alert: ${row.name}`,
        message: `Current stock level is ${stock} ${row.unit} (reorder threshold: ${min} ${row.unit}). Consider restocking immediately.`,
        type: "stock",
        link: "/stock/adjust",
        severity: stock <= 0 ? "danger" : "warning",
        createdAt: new Date(),
      });
    }

    // Returnable Gate Pass Alerts
    for (const gp of gatePassAlerts.rows as Array<{ id: string; gate_pass_number: string; direction: string; vehicle_number: string; driver_name: string; created_at: Date }>) {
      generatedAlerts.push({
        id: `gp-${gp.id}`,
        title: `Returnable Gate Pass: ${gp.gate_pass_number}`,
        message: `Material dispatch ${gp.gate_pass_number} (${gp.driver_name || "Driver"} - ${gp.vehicle_number || "Vehicle"}) is marked returnable and awaiting return.`,
        type: "gate_pass",
        link: `/gate-pass/${gp.id}`,
        severity: "info",
        createdAt: new Date(gp.created_at),
      });
    }

    // Pending Receivable Reminders
    for (const p of partyBalances.rows as Array<{ id: string; name: string; phone: string; receivable: string }>) {
      const bal = Number(p.receivable);
      generatedAlerts.push({
        id: `party-${p.id}`,
        title: `Outstanding Receivable: ${p.name}`,
        message: `Pending customer ledger balance of PKR ${bal.toLocaleString()} requires collection/follow up.`,
        type: "payment",
        link: `/parties`,
        severity: bal > 100000 ? "danger" : "warning",
        createdAt: new Date(),
      });
    }

    // Merge DB notes
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

    return generatedAlerts;
  } catch (err) {
    console.error("listNotifications error:", err);
    return [];
  }
}

export async function globalSearch(query: string) {
  if (query.trim().length < 2) {
    return { parties: [], products: [], transactions: [] };
  }
  const term = `%${query.trim()}%`;
  const [partyResults, productResults, transactionResults] = await Promise.all([
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
  ]);
  return {
    parties: partyResults,
    products: productResults,
    transactions: transactionResults,
  };
}

export async function getCompanySettings() {
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
