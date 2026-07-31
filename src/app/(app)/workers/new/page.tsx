import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { WorkerForm } from "./worker-form";

export const metadata: Metadata = { title: "Add Worker" };

export default function NewWorkerPage() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <main className="page form-page">
      <PageHeader
        title="Add New Worker"
        description="Create a worker record for payroll and factory reporting"
      />
      <WorkerForm today={today} />
    </main>
  );
}
