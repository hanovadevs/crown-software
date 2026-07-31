import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getReportFilterOptions } from "@/db/business-queries";
import { requireUser } from "@/lib/auth";
import { ReportBuilder } from "./report-builder";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requireUser();
  const options = await getReportFilterOptions();
  return (
    <main className="page">
      <PageHeader
        title={user.role === "inventory" ? "Inventory Reports" : "Reports"}
        description={
          user.role === "inventory"
            ? "Generate inventory levels, stock movement history, and product catalog reports"
            : "Generate focused reports for a specific party, product, stock item, warehouse, or worker"
        }
      />
      <ReportBuilder options={options} userRole={user.role} />
    </main>
  );
}
