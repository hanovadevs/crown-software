import { Banknote, Eye, Pencil, Plus, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listWorkers } from "@/db/operations-queries";
import { formatDate, formatPKR } from "@/lib/utils";
import { deleteWorkerAction } from "@/app/actions/business";
import { DeleteButton } from "@/components/delete-button";

export const metadata: Metadata = { title: "Workers" };

export default async function WorkersPage() {
  const workerList = await listWorkers();
  return (
    <main className="page">
      <PageHeader
        title="Workers"
        description="Manage factory workers, salaries, and payment history"
        action={
          <div className="card-actions"><Link className="button button-secondary" href="/workers/payments/new"><Banknote size={18} /> Salary Payment</Link><Link className="button button-primary" href="/workers/new"><Plus size={20} /> Add Worker</Link></div>
        }
      />
      <section className="card table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Designation</th>
                <th>Phone</th>
                <th>Joining Date</th>
                <th>Monthly Salary</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workerList.length ? (
                workerList.map((worker) => (
                  <tr key={worker.id}>
                    <td>
                      <div className="table-primary">
                        <span className="table-icon purple">
                          <UserCheck size={19} />
                        </span>
                        <span>
                          <strong>{worker.name}</strong>
                          <small>{worker.code}</small>
                        </span>
                      </div>
                    </td>
                    <td>{worker.designation || "—"}</td>
                    <td>{worker.phone || "—"}</td>
                    <td>{formatDate(worker.joiningDate)}</td>
                    <td>{formatPKR(worker.monthlySalary)}</td>
                    <td className="amount-cell">{formatPKR(worker.totalPaid)}</td>
                    <td>
                      <span
                        className={`badge ${
                          worker.status === "active"
                            ? "badge-success"
                            : "badge-danger"
                        }`}
                      >
                        {worker.status}
                      </span>
                    </td>
                    <td>
                      <div className="card-actions">
                        <Link className="small-icon-button" href={`/workers/${worker.id}`} aria-label={`View ${worker.name}`}><Eye size={17} /></Link>
                        <Link className="small-icon-button" href={`/workers/${worker.id}/edit`} aria-label={`Edit ${worker.name}`}><Pencil size={17} /></Link>
                        <DeleteButton action={deleteWorkerAction.bind(null, worker.id)} confirmMessage={`Delete ${worker.name} and all salary payment records?`} label={`Delete ${worker.name}`} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={8}>
                    No workers have been added.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
