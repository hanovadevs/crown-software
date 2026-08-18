import { ArrowLeft, Banknote, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteWorkerPaymentAction } from "@/app/actions/operations";
import { DeleteButton } from "@/components/delete-button";
import { WhatsAppLedgerButton } from "@/components/whatsapp-ledger-button";
import { getWorkerWithPayments } from "@/db/operations-queries";
import { formatDate, formatPKR } from "@/lib/utils";

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getWorkerWithPayments(id);
  if (!result) notFound();
  const { worker, payments } = result;
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.paidAmount), 0);

  const whatsappMessage = [
    `Salary Statement — ${worker.name} (${worker.workerCode})`,
    worker.designation ? `Designation: ${worker.designation}` : null,
    `Monthly Salary: ${formatPKR(worker.monthlySalary)}`,
    `Total Paid: ${formatPKR(totalPaid)}`,
    `Payments Recorded: ${payments.length}`,
    `Statement Date: ${formatDate(new Date())}`,
  ].filter(Boolean).join("\n");

  return <main className="page">
    <div className="page-header"><div className="back-title"><Link className="icon-button" href="/workers" aria-label="Back to workers"><ArrowLeft size={21} /></Link><div><div className="eyebrow">Worker record</div><h1 className="page-title">{worker.name}</h1><p className="page-description">{worker.workerCode} · {worker.designation || "No designation"}</p></div></div><div className="card-actions"><WhatsAppLedgerButton phone={worker.phone} message={whatsappMessage} triggerPrint={false} /><Link className="button button-secondary" href={`/workers/${id}/edit`}><Pencil size={16} /> Edit Worker</Link><Link className="button button-primary" href={`/workers/payments/new?worker=${id}`}><Banknote size={17} /> Salary Payment</Link></div></div>
    <section className="stats-grid worker-stats"><article className="card stat-card"><div className="stat-label">Monthly Salary</div><div className="stat-value">{formatPKR(worker.monthlySalary)}</div></article><article className="card stat-card"><div className="stat-label">Total Paid</div><div className="stat-value">{formatPKR(totalPaid)}</div></article><article className="card stat-card"><div className="stat-label">Joining Date</div><div className="stat-value compact-value">{formatDate(worker.joiningDate)}</div></article><article className="card stat-card"><div className="stat-label">Status</div><div className="stat-value compact-value capitalize">{worker.status}</div></article></section>
    <div className="section-title-row"><h2 className="section-title">Salary Payment History</h2><span className="muted-text">{payments.length} records</span></div>
    <section className="card table-card"><div className="table-scroll"><table className="data-table"><thead><tr><th>Salary Month</th><th>Gross</th><th>Advance</th><th>Deductions</th><th>Paid</th><th>Status</th><th>Paid Date</th><th>Actions</th></tr></thead><tbody>{payments.length ? payments.map((payment) => <tr key={payment.id}><td>{new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${payment.salaryMonth}T00:00:00Z`))}</td><td>{formatPKR(payment.grossAmount)}</td><td>{formatPKR(payment.advanceAmount)}</td><td>{formatPKR(payment.deductionAmount)}</td><td className="amount-cell">{formatPKR(payment.paidAmount)}</td><td><span className={`badge ${payment.status === "paid" ? "badge-success" : payment.status === "partial" ? "badge-warning" : "badge-danger"}`}>{payment.status}</span></td><td>{formatDate(payment.paidAt)}</td><td><DeleteButton action={deleteWorkerPaymentAction.bind(null, payment.id)} confirmMessage="Delete this salary payment and its accounting entry?" label="Delete salary payment" /></td></tr>) : <tr><td className="table-empty" colSpan={8}>No salary payments have been posted.</td></tr>}</tbody></table></div></section>
  </main>;
}
