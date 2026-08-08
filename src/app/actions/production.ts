"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { billOfMaterialItems, billsOfMaterials, inventoryMovements, products, warehouses, workOrders } from "@/db/schema";
import { requireUser } from "@/lib/auth";

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

    await db.transaction(async (tx) => {
      // 1. Get BOM details
      const [bom] = await tx
        .select()
        .from(billsOfMaterials)
        .where(eq(billsOfMaterials.id, parsed.bomId))
        .limit(1);

      if (!bom) throw new Error("BOM recipe not found");

      const bomItems = await tx
        .select()
        .from(billOfMaterialItems)
        .where(eq(billOfMaterialItems.bomId, parsed.bomId));

      if (bomItems.length === 0) throw new Error("BOM recipe has no component sub-products assigned");

      const orderNumber = `WO-${Date.now().toString().slice(-6)}`;
      const multiplier = parsed.quantityToProduce / Number(bom.outputQuantity || 1);

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
          plannedStartDate: new Date().toISOString().split("T")[0],
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
      for (const item of bomItems) {
        const requiredQty = Number(item.quantity) * multiplier;
        const wasteFactor = 1 + Number(item.expectedWastePercent || 0) / 100;
        const totalDeduction = requiredQty * wasteFactor;

        await tx.insert(inventoryMovements).values({
          productId: item.materialProductId,
          warehouseId: parsed.warehouseId,
          movementType: "production_issue",
          quantityDelta: (-totalDeduction).toString(),
          reference: wo.orderNumber,
          notes: `Sub-Product Assembly Consumption for ${wo.orderNumber}`,
          createdBy: user.id,
        });
      }
    });

    revalidatePath("/stock");
    revalidatePath("/dashboard");
    revalidatePath("/notifications");
    return { success: true };
  } catch (err: any) {
    console.error("postProductionRunAction error:", err);
    return { error: err.message || "Failed to post production run" };
  }
}
