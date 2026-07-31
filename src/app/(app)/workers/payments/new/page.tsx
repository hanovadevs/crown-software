import { PageHeader } from "@/components/ui";
import { getWorkerPaymentOptions } from "@/db/operations-queries";
import { WorkerPaymentForm } from "./worker-payment-form";

function todayInKarachi() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function NewWorkerPaymentPage({ searchParams }: { searchParams: Promise<{ worker?: string }> }) {
  const [workers, params] = await Promise.all([getWorkerPaymentOptions(), searchParams]);
  return <main className="page form-page"><PageHeader title="Worker Salary Payment" description="Post or update a monthly salary payment with accounting records" /><WorkerPaymentForm workers={workers} today={todayInKarachi()} initialWorkerId={params.worker} /></main>;
}
