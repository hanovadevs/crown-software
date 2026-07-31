import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getBillFormOptions } from "@/db/billing-queries";
import { BillForm } from "./bill-form";

export const metadata: Metadata = { title: "Generate Bill" };

function todayInKarachi() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function NewBillPage() {
  const options = await getBillFormOptions();
  return (
    <main className="page">
      <PageHeader
        title="Generate Bill"
        description="Create invoices and quotations for your customers"
      />
      <BillForm {...options} today={todayInKarachi()} />
    </main>
  );
}
