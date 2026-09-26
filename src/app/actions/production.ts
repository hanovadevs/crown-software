"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, billOfMaterialItems, billsOfMaterials, inventoryMovements, products, warehouses, workOrders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { hasPrecision } from "@/lib/accounting";
import { nextDocumentNumber } from "@/db/documents";

import type { FormState } from "./business";

const productionRunSchema = z.object({
  bomId: z.string().uuid("Invalid BOM ID"),
  warehouseId: z.string().uuid("Invalid Warehouse ID"),
  quantityToProduce: z.number().positive("Quantity must be greater than 0"),
  notes: z.string().optional(),
});

export async function postProductionRunAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "production" && user.role !== "inventory") {
    return { error: "Unauthorized to launch production runs" };
  }

  try {
    const parsed = productionRunSchema.parse({
      bomId: formData.get("bomId"),
      warehouseId: formData.get("warehouseId"),
      quantityToProduce: Number(formData.get("quantityToProduce") || 1),
      notes: formData.get("notes") || undefined,
    });
    if (!hasPrecision(parsed.quantityToProduce, 3)) throw new Error("Production quantity can have at most three decimals.");

    await db.transaction(async (tx) => {
      // 1. Get BOM details
      const [bom] = await tx
        .select()
        .from(billsOfMaterials)
        .where(eq(billsOfMaterials.id, parsed.bomId))
        .limit(1);

      if (!bom || !bom.isActive) throw new Error("Active BOM recipe not found");

      const [[warehouse], [finishedProduct]] = await Promise.all([
        tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, parsed.warehouseId), eq(warehouses.isActive, true))).limit(1),
        tx.select({ id: products.id }).from(products).where(and(eq(products.id, bom.finishedProductId), eq(products.isActive, true))).limit(1),
      ]);
      if (!warehouse || !finishedProduct) throw new Error("The warehouse or finished product is unavailable.");

      const bomItems = await tx
        .select()
        .from(billOfMaterialItems)
        .where(eq(billOfMaterialItems.bomId, parsed.bomId));

      if (bomItems.length === 0) throw new Error("BOM recipe has no component sub-products assigned");

      const multiplier = parsed.quantityToProduce / Number(bom.outputQuantity || 1);
      if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error("The BOM output quantity is invalid.");
      const deductions = bomItems.map((item) => {
        const required = Number(item.quantity) * multiplier * (1 + Number(item.expectedWastePercent || 0) / 100);
        const quantity = Math.ceil(required * 1000 - 0.000001) / 1000;
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("The BOM contains an invalid material quantity.");
        return { productId: item.materialProductId, quantity };
      });
      const neededByProduct = new Map<string, number>();
      for (const item of deductions) neededByProduct.set(item.productId, (neededByProduct.get(item.productId) ?? 0) + item.quantity);
      const productIds = [...new Set([bom.finishedProductId, ...neededByProduct.keys()])].sort();
      for (const productId of productIds) {
        const locked = await tx.execute(sql`SELECT id FROM products WHERE id = ${productId} AND is_active FOR UPDATE`);
        if (!locked.rows.length) throw new Error("A BOM material is unavailable.");
      }
      for (const [productId, required] of neededByProduct) {
        const [stock] = await tx.select({ quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)` })
          .from(inventoryMovements).where(and(eq(inventoryMovements.productId, productId), eq(inventoryMovements.warehouseId, parsed.warehouseId)));
        if (Number(stock?.quantity ?? 0) < required) throw new Error("Insufficient material stock for this production run.");
      }
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const orderNumber = await nextDocumentNumber(
        tx as unknown as Parameters<typeof nextDocumentNumber>[0], "work_order", "WO", new Date(`${today}T00:00:00+05:00`),
      );

      // 2. Insert Completed Work Order
      const [wo] = await tx
        .insert(workOrders)
        .values({
          orderNumber,
          bomId: bom.id,
          warehouseId: parsed.warehouseId,
          plannedQuantity: parsed.quantityToProduce.toString(),
          completedQuantity: parsed.quantityToProduce.toString(),
          rejectedQuantity: "0",
          status: "completed",
          plannedStartDate: today,
          completedAt: new Date(),
          notes: parsed.notes,
          createdBy: user.id,
        })
        .returning();

      // 3. Add Finished Good Output (+Qty)
      await tx.insert(inventoryMovements).values({
        productId: bom.finishedProductId,
        warehouseId: parsed.warehouseId,
        movementType: "production_output",
        quantityDelta: parsed.quantityToProduce.toString(),
        reference: wo.orderNumber,
        notes: `Finished Goods Assembly Output (${wo.orderNumber})`,
        createdBy: user.id,
      });

      // 4. Automatically Deduct Sub-Product Component Inventories (-Qty)
      for (const item of deductions) {
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          warehouseId: parsed.warehouseId,
          movementType: "production_issue",
          quantityDelta: (-item.quantity).toFixed(3),
          reference: wo.orderNumber,
          notes: `Sub-Product Assembly Consumption for ${wo.orderNumber}`,
          createdBy: user.id,
        });
      }
      await tx.insert(auditLogs).values({
        userId: user.id, action: "post", entityType: "work_order", entityId: wo.id,
        newValues: { orderNumber, bomId: bom.id, quantity: parsed.quantityToProduce },
      });
      await tx.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "work_order", action: "created", id: wo.id })})`);
    });

    revalidatePath("/stock");
    revalidatePath("/dashboard");
    revalidatePath("/notifications");
    return { success: true };
  } catch (err: unknown) {
    console.error("postProductionRunAction error:", err);
    return { error: err instanceof Error ? err.message : "Failed to post production run" };
  }
}
