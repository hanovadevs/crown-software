import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from ".";
import { billItems, bills, parties, products, users } from "./schema";

export async function getBillFormOptions() {
  const [customers, productOptions] = await Promise.all([
    db
      .select({ id: parties.id, name: parties.name, taxNumber: parties.taxNumber, phone: parties.phone, address: parties.address })
      .from(parties)
      .where(eq(parties.isCustomer, true))
      .orderBy(parties.name),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        salePrice: products.salePrice,
      })
      .from(products)
      .where(and(eq(products.isActive, true), eq(products.isSellable, true)))
      .orderBy(products.name),
  ]);
  return { customers, products: productOptions };
}

export async function getBill(id: string) {
  const [bill] = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      type: bills.type,
      status: bills.status,
      billDate: bills.billDate,
      dueDate: bills.dueDate,
      supplierNtn: bills.supplierNtn,
      buyerNtn: bills.buyerNtn,
      timeOfSupply: bills.timeOfSupply,
      termsOfSales: bills.termsOfSales,
      subtotal: bills.subtotal,
      taxRate: bills.taxRate,
      taxAmount: bills.taxAmount,
      sedRate: bills.sedRate,
      sedAmount: bills.sedAmount,
      shippingAmount: bills.shippingAmount,
      discountAmount: bills.discountAmount,
      totalAmount: bills.totalAmount,
      notes: bills.notes,
      party: {
        name: parties.name,
        contactPerson: parties.contactPerson,
        phone: parties.phone,
        email: parties.email,
        address: parties.address,
        taxNumber: parties.taxNumber,
      },
      createdBy: users.displayName,
    })
    .from(bills)
    .innerJoin(parties, eq(bills.partyId, parties.id))
    .innerJoin(users, eq(bills.createdBy, users.id))
    .where(eq(bills.id, id))
    .limit(1);
  if (!bill) return null;

  const items = await db
    .select({
      id: billItems.id,
      description: billItems.description,
      quantity: billItems.quantity,
      unitPrice: billItems.unitPrice,
      salesTaxRate: billItems.salesTaxRate,
      salesTaxAmount: billItems.salesTaxAmount,
      sedRate: billItems.sedRate,
      sedAmount: billItems.sedAmount,
      lineTotal: billItems.lineTotal,
      sku: products.sku,
    })
    .from(billItems)
    .leftJoin(products, eq(billItems.productId, products.id))
    .where(eq(billItems.billId, id))
    .orderBy(asc(billItems.sortOrder));

  return { bill, items };
}

export async function listBills(search = "", type = "all") {
  const conditions = [];

  if (type === "invoice" || type === "quotation" || type === "tax_invoice") {
    conditions.push(eq(bills.type, type as "invoice" | "quotation" | "tax_invoice"));
  }

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      sql`(${bills.billNumber} ILIKE ${term} OR ${parties.name} ILIKE ${term})`,
    );
  }

  const billList = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      type: bills.type,
      status: bills.status,
      billDate: bills.billDate,
      dueDate: bills.dueDate,
      subtotal: bills.subtotal,
      taxAmount: bills.taxAmount,
      totalAmount: bills.totalAmount,
      partyName: parties.name,
      partyPhone: parties.phone,
      itemCount: sql<string>`(SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = ${bills.id})`,
    })
    .from(bills)
    .innerJoin(parties, eq(bills.partyId, parties.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${bills.billDate} DESC, ${bills.createdAt} DESC`)
    .limit(100);

  return billList;
}
