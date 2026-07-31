import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getReportFilterOptions } from "@/db/business-queries";
import { ReportBuilder } from "./report-builder";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const options = await getReportFilterOptions();
  return (
    <main className="page">
      <PageHeader title="Reports" description="Generate focused reports for a specific party, product, stock item, warehouse, or worker" />
      <ReportBuilder options={options} />
    </main>
  );
}
