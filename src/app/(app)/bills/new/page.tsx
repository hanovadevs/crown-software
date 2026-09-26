import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getBill, getBillFormOptions } from "@/db/billing-queries";
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

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateId?: string }>;
}) {
  const { duplicateId } = await searchParams;
  const options = await getBillFormOptions();
  let initialBillData = null;

  if (duplicateId) {
    initialBillData = await getBill(duplicateId);
  }

  return (
    <main className="page">
      <PageHeader
        title={initialBillData ? `New Bill Based on ${initialBillData.bill.billNumber}` : "Generate Bill"}
        description="Issuing an invoice posts the customer sale and deducts linked product stock. Quotations do not post; record payments in Transactions."
      />
      <BillForm {...options} today={todayInKarachi()} initialBillData={initialBillData} />
    </main>
  );
}
