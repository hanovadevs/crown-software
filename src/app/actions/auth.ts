"use server";

import { compare } from "bcryptjs";
import { and, count, eq, gte } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, loginAttempts, users } from "@/db/schema";
import { createSession, destroySession } from "@/lib/auth";

export type LoginState = {
  error?: string;
};

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(80),
  password: z.string().min(1, "Enter your password").max(200),
});

function requestMetadata(headersList: Awaited<ReturnType<typeof headers>>) {
  return {
    ipAddress:
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersList.get("x-real-ip"),
    userAgent: headersList.get("user-agent"),
  };
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid login details" };
  }

  const username = parsed.data.username.toLowerCase();
  const headersList = await headers();
  const metadata = requestMetadata(headersList);
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);
  const [failedAttempts] = await db
    .select({ value: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.username, username),
        eq(loginAttempts.succeeded, false),
        gte(loginAttempts.attemptedAt, windowStart),
      ),
    );

  if ((failedAttempts?.value ?? 0) >= 8) {
    return {
      error: "Too many unsuccessful attempts. Please wait 15 minutes.",
    };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const valid = Boolean(
    user?.isActive && (await compare(parsed.data.password, user.passwordHash)),
  );

  await db.insert(loginAttempts).values({
    username,
    succeeded: valid,
    ...metadata,
  });

  if (!valid || !user) {
    return { error: "The username or password is incorrect." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "login",
      entityType: "session",
      ipAddress: metadata.ipAddress,
    });
  });

  await createSession(user.id, metadata);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
