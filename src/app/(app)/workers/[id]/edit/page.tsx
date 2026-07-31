import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getWorker } from "@/db/operations-queries";
import { WorkerForm } from "../../new/worker-form";

export default async function EditWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = await getWorker(id);
  if (!worker) notFound();
  return (
    <main className="page form-page">
      <PageHeader title="Edit Worker" description="Update worker identity, role, and salary information" />
      <WorkerForm today={worker.joiningDate} worker={worker} />
    </main>
  );
}
