import { ArrowDownLeft, ArrowUpRight, ClipboardCheck, Eye, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listGatePasses } from "@/db/gate-pass-queries";
import { formatDate } from "@/lib/utils";
import { deleteGatePassAction } from "@/app/actions/gate-pass";
import { DeleteButton } from "@/components/delete-button";

export const metadata: Metadata = { title: "Gate Passes" };

export default async function GatePassListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; direction?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const direction = params.direction ?? "all";
  const items = await listGatePasses(q, direction);

  return (
    <main className="page">
      <PageHeader
        title="Gate Passes"
        description="Manage inward and outward gate pass challans"
        action={
          <Link className="button button-primary" href="/gate-pass/new">
            <Plus size={20} /> New Gate Pass
          </Link>
        }
      />

      <form className="card filter-bar" method="get">
        <div className="search-field">
          <span className="search-field-icon">⌕</span>
          <input
            className="input"
            name="q"
            placeholder="Search GP number, vehicle, driver, party…"
            defaultValue={q}
          />
        </div>
        <select className="input select-input" name="direction" defaultValue={direction}>
          <option value="all">All Directions</option>
          <option value="inward">Inward ↓</option>
          <option value="outward">Outward ↑</option>
        </select>
        <button className="button button-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="card panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>GP Number</th>
                <th>Direction</th>
                <th>Party</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Items</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((gp) => (
                  <tr key={gp.id}>
                    <td>
                      <strong>{gp.number}</strong>
                    </td>
                    <td>
                      <span
                        className={`badge ${gp.direction === "inward" ? "badge-success" : "badge-warning"}`}
                      >
                        {gp.direction === "inward" ? (
                          <><ArrowDownLeft size={14} /> Inward</>
                        ) : (
                          <><ArrowUpRight size={14} /> Outward</>
                        )}
                      </span>
                    </td>
                    <td>{gp.partyName ?? "—"}</td>
                    <td>{gp.vehicleNumber ?? "—"}</td>
                    <td>{gp.driverName ?? "—"}</td>
                    <td>{Number(gp.itemCount)}</td>
                    <td>{formatDate(gp.date)}</td>
                    <td>
                      <span
                        className={`badge ${
                          gp.status === "issued"
                            ? "badge-primary"
                            : gp.status === "received"
                              ? "badge-success"
                              : gp.status === "cancelled"
                                ? "badge-danger"
                                : "badge-secondary"
                        }`}
                      >
                        {gp.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="button button-secondary small-button"
                          href={`/gate-pass/${gp.id}`}
                        >
                          <Eye size={16} /> View
                        </Link>
                        <DeleteButton
                          action={deleteGatePassAction.bind(null, gp.id)}
                          confirmMessage={`Delete gate pass ${gp.number}? This will permanently remove this record.`}
                          label={`Delete ${gp.number}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="table-empty">
                    <ClipboardCheck size={40} strokeWidth={1.2} />
                    <p>No gate passes found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
