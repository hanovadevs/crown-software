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
  return db
    .select()
    .from(notifications)
    .where(
      or(eq(notifications.userId, userId), sql`${notifications.userId} IS NULL`),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(100);
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
