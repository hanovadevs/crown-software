import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getGatePassFormOptions } from "@/db/gate-pass-queries";
import { GatePassForm } from "./gate-pass-form";

export const metadata: Metadata = { title: "New Gate Pass" };

function todayInKarachi() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function NewGatePassPage() {
  const options = await getGatePassFormOptions();
  return (
    <main className="page">
      <PageHeader
        title="New Gate Pass"
        description="Create an inward or outward gate pass challan"
      />
      <GatePassForm {...options} today={todayInKarachi()} />
    </main>
  );
}
