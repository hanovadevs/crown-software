import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from ".";
import { billOfMaterialItems, billsOfMaterials, products, warehouses, workOrders } from "./schema";

export async function listBoms() {
  const boms = await db
    .select({
      id: billsOfMaterials.id,
      code: billsOfMaterials.code,
      finishedProductId: billsOfMaterials.finishedProductId,
      finishedProductName: products.name,
      finishedProductSku: products.sku,
      outputQuantity: billsOfMaterials.outputQuantity,
      versionNumber: billsOfMaterials.versionNumber,
      isActive: billsOfMaterials.isActive,
      notes: billsOfMaterials.notes,
    })
    .from(billsOfMaterials)
    .leftJoin(products, eq(billsOfMaterials.finishedProductId, products.id))
    .where(eq(billsOfMaterials.isActive, true));

  const result = [];
  for (const bom of boms) {
    const items = await db
      .select({
        id: billOfMaterialItems.id,
        materialProductId: billOfMaterialItems.materialProductId,
        materialName: products.name,
        materialSku: products.sku,
        materialUnit: products.unit,
        quantity: billOfMaterialItems.quantity,
        expectedWastePercent: billOfMaterialItems.expectedWastePercent,
      })
      .from(billOfMaterialItems)
      .leftJoin(products, eq(billOfMaterialItems.materialProductId, products.id))
      .where(eq(billOfMaterialItems.bomId, bom.id));

    result.push({ ...bom, items });
  }

  return result;
}

export async function getProductionFormData() {
  const [finishedProducts, subProducts, warehouseList, activeBoms] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, sku: products.sku, unit: products.unit })
      .from(products)
      .where(eq(products.isFinishedGood, true)),
    db
      .select({ id: products.id, name: products.name, sku: products.sku, unit: products.unit })
      .from(products)
      .where(eq(products.isRawMaterial, true)),
    db.select({ id: warehouses.id, name: warehouses.name, code: warehouses.code }).from(warehouses),
    listBoms(),
  ]);

  return { finishedProducts, subProducts, warehouseList, activeBoms };
}
