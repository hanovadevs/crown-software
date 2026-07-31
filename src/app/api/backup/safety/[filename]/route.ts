import { getSession } from "@/lib/auth";
import { readSafetyBackup } from "@/lib/database-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return new Response("Administrator access required", { status: 403 });
  }
  try {
    const { filename } = await params;
    const backup = await readSafetyBackup(filename);
    return new Response(new Uint8Array(backup), {
      headers: {
        "Content-Type": "application/vnd.postgresql.dump",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Safety backup not found.", { status: 404 });
  }
}
