import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from ".";
import { gatePassItems, gatePasses, parties, products } from "./schema";

export async function getGatePassFormOptions() {
  const [partyOptions, productOptions] = await Promise.all([
    db
      .select({
        id: parties.id,
        name: parties.name,
        phone: parties.phone,
        address: parties.address,
      })
      .from(parties)
      .where(eq(parties.isActive, true))
      .orderBy(parties.name),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        unit: products.unit,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name),
  ]);

  return { parties: partyOptions, products: productOptions };
}

export async function listGatePasses(search = "", direction = "all") {
  const conditions: SQL[] = [];
  if (direction === "inward") conditions.push(eq(gatePasses.direction, "inward"));
  if (direction === "outward") conditions.push(eq(gatePasses.direction, "outward"));
  if (search) {
    conditions.push(
      or(
        ilike(gatePasses.gatePassNumber, `%${search}%`),
        ilike(gatePasses.vehicleNumber, `%${search}%`),
        ilike(gatePasses.driverName, `%${search}%`),
        ilike(parties.name, `%${search}%`),
      )!,
    );
  }

  return db
    .select({
      id: gatePasses.id,
      number: gatePasses.gatePassNumber,
      direction: gatePasses.direction,
      status: gatePasses.status,
      partyName: parties.name,
      vehicleNumber: gatePasses.vehicleNumber,
      driverName: gatePasses.driverName,
      date: gatePasses.gatePassDate,
      isReturnable: gatePasses.isReturnable,
      itemCount: sql<string>`(SELECT COUNT(*) FROM gate_pass_items gpi WHERE gpi.gate_pass_id = ${gatePasses.id})`,
    })
    .from(gatePasses)
    .leftJoin(parties, eq(gatePasses.partyId, parties.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(gatePasses.gatePassDate), desc(gatePasses.createdAt))
    .limit(200);
}

export async function getGatePass(id: string) {
  const [gatePass] = await db
    .select({
      id: gatePasses.id,
      number: gatePasses.gatePassNumber,
      direction: gatePasses.direction,
      status: gatePasses.status,
      partyName: parties.name,
      partyPhone: parties.phone,
      partyAddress: parties.address,
      vehicleNumber: gatePasses.vehicleNumber,
      driverName: gatePasses.driverName,
      driverPhone: gatePasses.driverPhone,
      date: gatePasses.gatePassDate,
      remarks: gatePasses.remarks,
      isReturnable: gatePasses.isReturnable,
      expectedReturnDate: gatePasses.expectedReturnDate,
      authorizedBy: gatePasses.authorizedBy,
      receivedBy: gatePasses.receivedBy,
      gateKeeperName: gatePasses.gateKeeperName,
      createdAt: gatePasses.createdAt,
    })
    .from(gatePasses)
    .leftJoin(parties, eq(gatePasses.partyId, parties.id))
    .where(eq(gatePasses.id, id))
    .limit(1);

  if (!gatePass) return null;

  const items = await db
    .select({
      id: gatePassItems.id,
      description: gatePassItems.description,
      quantity: gatePassItems.quantity,
      unit: gatePassItems.unit,
      remarks: gatePassItems.remarks,
      productName: products.name,
      productSku: products.sku,
    })
    .from(gatePassItems)
    .leftJoin(products, eq(gatePassItems.productId, products.id))
    .where(eq(gatePassItems.gatePassId, id));

  return { gatePass, items };
}
