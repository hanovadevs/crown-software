import { getSession } from "@/lib/auth";
import { backupChecksum, createDatabaseBackup } from "@/lib/database-backup";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return new Response("Administrator access required", { status: 403 });
  }
  try {
    const backup = await createDatabaseBackup();
    const checksum = backupChecksum(backup);
    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: "create",
      entityType: "database_backup",
      newValues: { checksum, bytes: backup.length },
    });
    const date = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
    return new Response(new Uint8Array(backup), {
      headers: {
        "Content-Type": "application/vnd.postgresql.dump",
        "Content-Disposition": `attachment; filename="crown-accumulator-${date}.dump"`,
        "Cache-Control": "no-store",
        "X-Backup-SHA256": checksum,
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      error instanceof Error ? error.message : "Backup could not be generated.",
      { status: 500 },
    );
  }
}
