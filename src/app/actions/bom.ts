"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { billOfMaterialItems, billsOfMaterials, workOrders } from "@/db/schema";
import { requireUser } from "@/lib/auth";

import type { FormState } from "./business";

const bomSchema = z.object({
  finishedProductId: z.string().uuid("Invalid finished product ID"),
  code: z.string().min(2, "BOM Code is required"),
  outputQuantity: z.number().positive("Output quantity must be greater than 0"),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        materialProductId: z.string().uuid("Invalid material product ID"),
        quantity: z.number().positive("Item quantity must be greater than 0"),
        expectedWastePercent: z.number().min(0, "Waste percent cannot be negative").default(0),
      }),
    )
    .min(1, "At least one component material item is required"),
});

export async function saveBomAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "production" && user.role !== "inventory") {
    return { error: "Unauthorized to manage Bill of Materials" };
  }

  try {
    const rawItems = formData.get("itemsJson");
    const parsedItems = rawItems ? JSON.parse(rawItems as string) : [];

    const parsed = bomSchema.parse({
      finishedProductId: formData.get("finishedProductId"),
      code: formData.get("code"),
      outputQuantity: Number(formData.get("outputQuantity") || 1),
      notes: formData.get("notes") || undefined,
      items: parsedItems.map((item: any) => ({
        materialProductId: item.materialProductId,
        quantity: Number(item.quantity || 0),
        expectedWastePercent: Number(item.expectedWastePercent || 0),
      })),
    });

    await db.transaction(async (tx) => {
      // Check if BOM exists for code
      const existing = await tx
        .select()
        .from(billsOfMaterials)
        .where(eq(billsOfMaterials.code, parsed.code))
        .limit(1);

      let bomId: string;

      if (existing.length > 0) {
        bomId = existing[0].id;
        await tx
          .update(billsOfMaterials)
          .set({
            finishedProductId: parsed.finishedProductId,
            outputQuantity: parsed.outputQuantity.toString(),
            notes: parsed.notes,
            versionNumber: existing[0].versionNumber + 1,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(billsOfMaterials.id, bomId));

        // Delete existing items
        await tx.delete(billOfMaterialItems).where(eq(billOfMaterialItems.bomId, bomId));
      } else {
        const [newBom] = await tx
          .insert(billsOfMaterials)
          .values({
            code: parsed.code,
            finishedProductId: parsed.finishedProductId,
            outputQuantity: parsed.outputQuantity.toString(),
            notes: parsed.notes,
            isActive: true,
          })
          .returning();
        bomId = newBom.id;
      }

      // Insert BOM items
      for (const item of parsed.items) {
        await tx.insert(billOfMaterialItems).values({
          bomId,
          materialProductId: item.materialProductId,
          quantity: item.quantity.toString(),
          expectedWastePercent: item.expectedWastePercent.toString(),
        });
      }
    });

    revalidatePath("/stock");
    revalidatePath("/stock/bom");
    return { success: true };
  } catch (err: any) {
    console.error("saveBomAction error:", err);
    return { error: err.message || "Failed to save Bill of Materials recipe" };
  }
}

export async function deleteBomAction(bomId: string) {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "production" && user.role !== "inventory") {
    throw new Error("Unauthorized to delete Bill of Materials");
  }

  await db.transaction(async (tx) => {
    const [bom] = await tx.select().from(billsOfMaterials).where(eq(billsOfMaterials.id, bomId)).limit(1);
    if (!bom) return;

    const orders = await tx.select({ id: workOrders.id }).from(workOrders).where(eq(workOrders.bomId, bomId));
    if (orders.length > 0) {
      await tx.update(billsOfMaterials).set({ isActive: false, updatedAt: new Date() }).where(eq(billsOfMaterials.id, bomId));
      return;
    }

    await tx.delete(billOfMaterialItems).where(eq(billOfMaterialItems.bomId, bomId));
    await tx.delete(billsOfMaterials).where(eq(billsOfMaterials.id, bomId));
  });

  revalidatePath("/stock");
  revalidatePath("/stock/bom");
}
