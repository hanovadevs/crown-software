import { Copy, Eye, FileText, Plus, Printer, ReceiptText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, StatCard } from "@/components/ui";
import { listBills } from "@/db/billing-queries";
import { requireUser } from "@/lib/auth";
import { formatDate, formatPKR } from "@/lib/utils";
import { deleteBillAction } from "@/app/actions/billing";
import { DeleteButton } from "@/components/delete-button";

export const metadata: Metadata = { title: "Invoices & Bills History" };

export default async function BillsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const user = await requireUser();
  const { q = "", type = "all" } = await searchParams;
  const billList = await listBills(q, type);

  const totalRevenue = billList.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
  const taxInvoiceCount = billList.filter((b) => b.type === "tax_invoice").length;

  return (
    <main className="page">
      <PageHeader
        eyebrow="Sales & Document Ledger"
        title="Invoices & Bills History"
        description="Review, reprint, or regenerate previous commercial invoices, quotations, and official sales tax documents"
        action={
          <Link className="button button-primary" href="/bills/new">
            <Plus size={19} /> Generate New Bill
          </Link>
        }
      />

      {/* Summary Cards */}
      <section className="stats-grid" aria-label="Invoice Overview">
        <StatCard
          icon={ReceiptText}
          label="Total Documents Generated"
          value={String(billList.length)}
          hint="Invoices, quotations & tax records"
          color="#4169f6"
        />
        <StatCard
          icon={FileText}
          label="Total Invoiced Volume"
          value={formatPKR(totalRevenue)}
          hint="Cumulative billed gross value"
          color="#18c77a"
        />
        <StatCard
          icon={Printer}
          label="Sales Tax / S.E.D. Invoices"
          value={String(taxInvoiceCount)}
          hint="Official FBR tax compliance copies"
          color="#13b8d3"
        />
      </section>

      {/* Search & Filter Bar */}
      <form className="filter-bar" method="get">
        <div className="search-field">
          <Search size={18} />
          <input
            className="input search-input"
            defaultValue={q}
            name="q"
            placeholder="Search by Invoice # (e.g. INV-2026-00001) or customer name..."
            type="search"
          />
        </div>

        <div className="filter-group">
          <select className="select filter-select" defaultValue={type} name="type">
            <option value="all">All Document Types</option>
            <option value="invoice">Commercial Invoice (INV)</option>
            <option value="quotation">Quotation (QTN)</option>
            <option value="tax_invoice">Sales Tax Invoice (STI)</option>
          </select>
          <button className="button button-secondary" type="submit">
            Filter
          </button>
        </div>
      </form>

      {/* Bills Table */}
      <section className="card form-card">
        {billList.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document Number</th>
                  <th>Document Type</th>
                  <th>Customer Name</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th className="amount-cell">Total Amount</th>
                  <th>Status</th>
                  <th className="actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billList.map((bill) => {
                  const isTax = bill.type === "tax_invoice";
                  const isQtn = bill.type === "quotation";

                  return (
                    <tr key={bill.id}>
                      <td>
                        <div className="table-primary">
                          <span className={`table-icon ${isTax ? "cyan" : isQtn ? "orange" : "blue"}`}>
                            <ReceiptText size={18} />
                          </span>
                          <strong>{bill.billNumber}</strong>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            isTax ? "badge-primary" : isQtn ? "badge-warning" : "badge-success"
                          }`}
                          style={{ textTransform: "capitalize" }}
                        >
                          {bill.type.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>
                        <strong>{bill.partyName}</strong>
                        {bill.partyPhone && (
                          <small className="cell-subtitle">{bill.partyPhone}</small>
                        )}
                      </td>
                      <td>{formatDate(bill.billDate)}</td>
                      <td>
                        <strong>{bill.itemCount} Items</strong>
                      </td>
                      <td className="amount-cell">
                        <strong style={{ fontSize: "0.95rem" }}>{formatPKR(bill.totalAmount)}</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            bill.status === "paid"
                              ? "badge-success"
                              : bill.status === "cancelled"
                              ? "badge-danger"
                              : "badge-primary"
                          }`}
                          style={{ textTransform: "capitalize" }}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="table-actions">
                          <Link
                            className="button button-secondary small-button"
                            href={`/bills/${bill.id}`}
                            title="Review / Print Document"
                          >
                            <Eye size={15} /> Review & Print
                          </Link>
                          <Link
                            className="button button-secondary small-button"
                            href={`/bills/new?duplicateId=${bill.id}`}
                            title="Generate / Duplicate Previous Bill"
                          >
                            <Copy size={15} /> Duplicate
                          </Link>
                          <DeleteButton
                            action={deleteBillAction.bind(null, bill.id)}
                            confirmMessage={`Delete bill ${bill.billNumber}? This will permanently remove this invoice and its items.`}
                            label={`Delete ${bill.billNumber}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <ReceiptText size={42} />
            <h2>No invoices or bills found</h2>
            <p>Generate your first bill or adjust your search filter above.</p>
          </div>
        )}
      </section>
    </main>
  );
}
