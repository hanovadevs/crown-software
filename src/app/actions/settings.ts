"use server";

import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";
import { destroySession, requireUser } from "@/lib/auth";
import type { FormState } from "./business";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[a-z]/, "Include a lowercase letter.")
      .regex(/[0-9]/, "Include a number."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "The new passwords do not match.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const authenticated = await requireUser();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the passwords." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, authenticated.id))
    .limit(1);
  if (!user || !(await compare(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "The current password is incorrect." };
  }

  const passwordHash = await hash(parsed.data.newPassword, 12);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "update",
      entityType: "password",
    });
  });
  await destroySession();
  redirect("/login");
}
