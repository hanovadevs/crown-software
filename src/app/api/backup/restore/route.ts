import { compare } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  BackupValidationError,
  createDatabaseBackup,
  inspectDatabaseBackup,
  restoreDatabase,
  saveSafetyBackup,
} from "@/lib/database-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Administrator access required." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Backup exceeds the 250 MB upload limit." }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("backup");
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (!(file instanceof File)) {
      return Response.json({ error: "Select a PostgreSQL .dump backup file." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "Backup exceeds the 250 MB upload limit." }, { status: 413 });
    }
    if (confirmation !== "RESTORE CROWN") {
      return Response.json({ error: "Enter RESTORE CROWN exactly to confirm." }, { status: 400 });
    }

    const [admin] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
    if (!admin || !(await compare(password, admin.passwordHash))) {
      return Response.json({ error: "Administrator password is incorrect." }, { status: 401 });
    }

    const incoming = Buffer.from(await file.arrayBuffer());
    const inspection = await inspectDatabaseBackup(incoming);
    const safetyBackup = await createDatabaseBackup();
    const safetyFilename = await saveSafetyBackup(safetyBackup);

    await restoreDatabase(incoming);

    const health = await pool.query<{ tables_ok: boolean }>(`
      SELECT
        to_regclass('public.users') IS NOT NULL
        AND to_regclass('public.parties') IS NOT NULL
        AND to_regclass('public.transactions') IS NOT NULL
        AND to_regclass('public.inventory_movements') IS NOT NULL
        AND to_regclass('public.audit_logs') IS NOT NULL AS tables_ok
    `);
    if (!health.rows[0]?.tables_ok) {
      throw new Error("Restore finished but required application tables are unavailable.");
    }

    const [restoredAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, session.user.username))
      .limit(1);
    if (restoredAdmin) {
      await db.insert(auditLogs).values({
        userId: restoredAdmin.id,
        action: "restore",
        entityType: "database",
        newValues: { filename: file.name, checksum: inspection.checksum, safetyBackup: safetyFilename },
      });
    }
    await db.execute(sql`DELETE FROM sessions`);
    await db.execute(sql`SELECT pg_notify('crown_updates', ${JSON.stringify({ entity: "database", action: "restored" })})`);

    return Response.json({
      success: true,
      message: "Database restored successfully. Sign in using the credentials from the restored backup.",
      safetyBackup: safetyFilename,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Database restore failed." },
      { status: error instanceof BackupValidationError ? 400 : 500 },
    );
  }
}
