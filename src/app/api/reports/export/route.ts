import { getSession } from "@/lib/auth";
import {
  buildReport,
  reportTypes,
  type ReportType,
} from "@/lib/report-data";

export const dynamic = "force-dynamic";

const stockReportsOnly = ["stock", "inventory-movements", "products"];

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  let requestedType = url.searchParams.get("type");
  if (session.user.role === "inventory" && !stockReportsOnly.includes(requestedType ?? "")) {
    requestedType = "stock";
  }

  const type = reportTypes.includes(requestedType as ReportType)
    ? (requestedType as ReportType)
    : "transactions";

  const report = await buildReport(
    type,
    {
      start: url.searchParams.get("start") ?? undefined,
      end: url.searchParams.get("end") ?? undefined,
      partyId: session.user.role === "inventory" ? undefined : (url.searchParams.get("partyId") ?? undefined),
      productId: url.searchParams.get("productId") ?? undefined,
      workerId: session.user.role === "inventory" ? undefined : (url.searchParams.get("workerId") ?? undefined),
      warehouseId: url.searchParams.get("warehouseId") ?? undefined,
    },
  );

  const csv = [
    report.columns.map(csvCell).join(","),
    ...report.rows.map((row) =>
      report.columns.map((column) => csvCell(row[column] ?? "")).join(","),
    ),
  ].join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-report.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
