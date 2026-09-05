"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { nextDocumentNumber } from "@/db/documents";
import { auditLogs, gatePassItems, gatePasses } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { FormState } from "./business";

const itemSchema = z.object({
  productId: z.string().uuid().nullable(),
  description: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(30),
  remarks: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null)
    .nullable(),
});

const gatePassSchema = z.object({
  direction: z.enum(["inward", "outward"]),
  partyId: z
    .string()
    .transform((v) => v || null)
    .nullable(),
  vehicleNumber: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || null)
    .nullable(),
  driverName: z
    .string()
    .trim()
    .max(160)
    .transform((v) => v || null)
    .nullable(),
  driverPhone: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v || null)
    .nullable(),
  gatePassDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: z
    .string()
    .trim()
    .max(3000)
    .transform((v) => v || null)
    .nullable(),
  isReturnable: z.boolean(),
  expectedReturnDate: z
    .string()
    .transform((v) => v || null)
    .nullable(),
  authorizedBy: z
    .string()
    .trim()
    .max(160)
    .transform((v) => v || null)
    .nullable(),
  receivedBy: z
    .string()
    .trim()
    .max(160)
    .transform((v) => v || null)
    .nullable(),
  gateKeeperName: z
    .string()
    .trim()
    .max(160)
    .transform((v) => v || null)
    .nullable(),
  items: z.array(itemSchema).min(1).max(50),
});

export async function createGatePassAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role === "viewer") {
    return { error: "You do not have permission to create gate passes." };
  }

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
  } catch {
    return { error: "The gate pass items could not be read." };
  }

  const parsed = gatePassSchema.safeParse({
    direction: formData.get("direction"),
    partyId: formData.get("partyId") || "",
    vehicleNumber: formData.get("vehicleNumber") || "",
    driverName: formData.get("driverName") || "",
    driverPhone: formData.get("driverPhone") || "",
    gatePassDate: formData.get("gatePassDate"),
    remarks: formData.get("remarks") || "",
    isReturnable: formData.get("isReturnable") === "on",
    expectedReturnDate: formData.get("expectedReturnDate") || "",
    authorizedBy: formData.get("authorizedBy") || "",
    receivedBy: formData.get("receivedBy") || "",
    gateKeeperName: formData.get("gateKeeperName") || "",
    items,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the gate pass information.",
    };
  }

  const value = parsed.data;
  let createdId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const gatePassNumber = await nextDocumentNumber(
        tx as unknown as Parameters<typeof nextDocumentNumber>[0],
        "gate_pass",
        "GP",
        new Date(`${value.gatePassDate}T00:00:00+05:00`),
      );

      const [created] = await tx
        .insert(gatePasses)
        .values({
          gatePassNumber,
          direction: value.direction,
          partyId: value.partyId,
          vehicleNumber: value.vehicleNumber,
          driverName: value.driverName,
          driverPhone: value.driverPhone,
          gatePassDate: value.gatePassDate,
          remarks: value.remarks,
          isReturnable: value.isReturnable,
          expectedReturnDate: value.expectedReturnDate,
          authorizedBy: value.authorizedBy,
          receivedBy: value.receivedBy,
          gateKeeperName: value.gateKeeperName,
          createdBy: user.id,
        })
        .returning({ id: gatePasses.id });

      createdId = created.id;

      await tx.insert(gatePassItems).values(
        value.items.map((item) => ({
          gatePassId: created.id,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity.toFixed(3),
          unit: item.unit,
          remarks: item.remarks,
        })),
      );

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "create",
        entityType: "gate_pass",
        entityId: created.id,
        newValues: {
          gatePassNumber,
          direction: value.direction,
          itemCount: value.items.length,
        },
      });

      await tx.execute(
        sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
          entity: "gate_pass",
          action: "created",
          id: created.id,
        })})`,
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Failed to create gate pass: ${message}` };
  }

  revalidatePath("/gate-pass");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  redirect(`/gate-pass/${createdId}`);
}

export async function updateGatePassStatusAction(
  gatePassId: string,
  newStatus: "draft" | "issued" | "received" | "cancelled",
) {
  const user = await requireUser();
  if (user.role === "viewer") {
    throw new Error("You do not have permission to update gate passes.");
  }

  await db.transaction(async (tx) => {
    const [gp] = await tx.select().from(gatePasses).where(eq(gatePasses.id, gatePassId)).limit(1);
    if (!gp) throw new Error("Gate pass not found.");

    await tx
      .update(gatePasses)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(gatePasses.id, gatePassId));

    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "update",
      entityType: "gate_pass",
      entityId: gatePassId,
      oldValues: { status: gp.status },
      newValues: { status: newStatus },
    });

    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "gate_pass",
        action: "status_changed",
        id: gatePassId,
      })})`,
    );
  });

  revalidatePath("/gate-pass");
  revalidatePath(`/gate-pass/${gatePassId}`);
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

export async function deleteGatePassAction(gatePassId: string) {
  const user = await requireUser();
  if (user.role === "viewer") {
    throw new Error("You do not have permission to delete gate passes.");
  }

  await db.transaction(async (tx) => {
    const [gp] = await tx.select().from(gatePasses).where(eq(gatePasses.id, gatePassId)).limit(1);
    if (!gp) return;

    await tx.delete(gatePassItems).where(eq(gatePassItems.gatePassId, gatePassId));
    await tx.delete(gatePasses).where(eq(gatePasses.id, gatePassId));

    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "archive",
      entityType: "gate_pass",
      entityId: gatePassId,
      oldValues: { gatePassNumber: gp.gatePassNumber },
    });

    await tx.execute(
      sql`SELECT pg_notify('crown_updates', ${JSON.stringify({
        entity: "gate_pass",
        action: "deleted",
        id: gatePassId,
      })})`,
    );
  });

  revalidatePath("/gate-pass");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  redirect("/gate-pass");
}
