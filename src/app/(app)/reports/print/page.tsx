import type { Metadata } from "next";
import Image from "next/image";
import { PrintButton } from "@/components/print-button";
import { WhatsAppLedgerButton } from "@/components/whatsapp-ledger-button";
import { requireUser } from "@/lib/auth";
import { formatDate, formatPKR } from "@/lib/utils";
import {
  buildReport,
  reportTypes,
  type ReportType,
} from "@/lib/report-data";

export const metadata: Metadata = { title: "Print Report / Ledger" };

const stockReportsOnly = ["stock", "inventory-movements", "products"];

export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    start?: string;
    end?: string;
    partyId?: string;
    productId?: string;
    workerId?: string;
    warehouseId?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  let rawType = params.type;
  if (user.role === "inventory" && !stockReportsOnly.includes(rawType ?? "")) {
    rawType = "stock";
  }

  const type = reportTypes.includes(rawType as ReportType)
    ? (rawType as ReportType)
    : "transactions";

  const report = await buildReport(type, {
    start: params.start,
    end: params.end,
    partyId: user.role === "inventory" ? undefined : params.partyId,
    productId: params.productId,
    workerId: user.role === "inventory" ? undefined : params.workerId,
    warehouseId: params.warehouseId,
  });

  const periodText =
    params.start || params.end
      ? `${params.start || "Beginning"} – ${params.end || "Today"}`
      : "All Time";

  const party = report.partyInfo;
  const stats = report.summaryStats;

  const targetPhone = party?.phone || null;

  const whatsappMessage = [
    `Crown Accumulator - ${report.title}`,
    party ? `Party: ${party.name}` : null,
    party?.phone ? `Contact: ${party.phone}` : null,
    stats ? `Opening Balance: ${formatPKR(stats.openingBalance)}` : null,
    stats ? `Total Billed (Debits): ${formatPKR(stats.totalDebit)}` : null,
    stats ? `Total Paid (Credits): ${formatPKR(stats.totalCredit)}` : null,
    stats ? `Closing Balance: ${formatPKR(Math.abs(stats.closingBalance))} ${stats.closingBalance >= 0 ? "Receivable" : "Payable"}` : null,
    `Period: ${periodText}`,
    `Generated: ${formatDate(new Date())}`,
    "",
    "Thank you. Issued by Crown Accumulator Management System.",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="page printable-report-page">
      <div className="report-print-actions no-print">
        <a className="button button-secondary" href="/reports">
          Back to Reports
        </a>
        <PrintButton label="Print / Save PDF" />
        <WhatsAppLedgerButton
          phone={targetPhone}
          message={whatsappMessage}
          label="Send to WhatsApp"
        />
      </div>

      <article className="printable-report executive-report-sheet">
        {/* Letterhead Header */}
        <header className="report-letterhead">
          <div className="letterhead-brand">
            <Image
              className="print-brand-logo"
              src="/CrownAccumulatorbox.jpeg"
              alt="Crown Accumulator"
              width={300}
              height={291}
            />
            <div className="letterhead-info">
              <h1>Crown Accumulator</h1>
              <p className="letterhead-address">
                55/28-C, Akbar Colony, Mominpura Road, Daroghawala, Lahore
              </p>
              <p className="letterhead-contact">
                Phone: +92 300 1234567 · NTN: 1234567-8 · Battery Management System
              </p>
            </div>
          </div>
          <div className="letterhead-solo">
            <Image
              className="solo-logo"
              src="/solo-removebg-preview.png"
              alt="SOLO"
              width={675}
              height={379}
            />
            <small>Powered by SOLO</small>
          </div>
        </header>

        <div className="report-divider" />

        {/* Report Title Banner */}
        <div className="report-banner-row">
          <div>
            <h2 className="report-main-title">{report.title}</h2>
            <div className="report-meta-badges">
              <span className="meta-badge">Period: {periodText}</span>
              <span className="meta-badge">
                Generated:{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: "Asia/Karachi",
                }).format(new Date())}
              </span>
              <span className="meta-badge">Records: {report.rows.length}</span>
            </div>
          </div>
        </div>

        {/* Party Details Card (If Party Ledger) */}
        {party && (
          <section className="party-details-card">
            <div className="party-details-header">
              <h3>Party Information</h3>
              <span className="party-role-pill">
                {party.isCustomer && party.isSupplier
                  ? "Customer & Supplier"
                  : party.isCustomer
                    ? "Customer Account"
                    : "Supplier Account"}
              </span>
            </div>
            <div className="party-details-grid">
              <div className="party-detail-item">
                <span className="label">Party Name:</span>
                <strong>{party.name}</strong>
              </div>
              <div className="party-detail-item">
                <span className="label">Contact Person:</span>
                <span>{party.contactPerson || "—"}</span>
              </div>
              <div className="party-detail-item">
                <span className="label">Phone / Mobile:</span>
                <span>{party.phone || "—"}</span>
              </div>
              <div className="party-detail-item">
                <span className="label">Email Address:</span>
                <span>{party.email || "—"}</span>
              </div>
              <div className="party-detail-item party-span-2">
                <span className="label">Business Address:</span>
                <span>{party.address || "—"}</span>
              </div>
              <div className="party-detail-item">
                <span className="label">Tax NTN / STRN:</span>
                <span>{party.taxNumber || "—"}</span>
              </div>
            </div>
          </section>
        )}

        {/* Financial Summary Cards Grid */}
        {stats && (
          <section className="report-summary-cards">
            <div className="summary-card">
              <span className="card-label">Opening Balance</span>
              <strong className="card-value">
                {formatPKR(Math.abs(stats.openingBalance))}
              </strong>
              <small className="card-hint">
                {stats.openingBalance >= 0 ? "Receivable (Dr)" : "Payable (Cr)"}
              </small>
            </div>
            <div className="summary-card">
              <span className="card-label">{stats.label1 || "Total Debits (Billed)"}</span>
              <strong className="card-value debit-text">
                {stats.val1 || formatPKR(stats.totalDebit)}
              </strong>
              <small className="card-hint">Sales &amp; Debit Invoices</small>
            </div>
            <div className="summary-card">
              <span className="card-label">{stats.label2 || "Total Credits (Paid)"}</span>
              <strong className="card-value credit-text">
                {stats.val2 || formatPKR(stats.totalCredit)}
              </strong>
              <small className="card-hint">Receipts &amp; Payments</small>
            </div>
            <div className="summary-card highlight-card">
              <span className="card-label">Net Closing Balance</span>
              <strong
                className={`card-value ${
                  stats.closingBalance >= 0 ? "positive-val" : "negative-val"
                }`}
              >
                {formatPKR(Math.abs(stats.closingBalance))}
              </strong>
              <span
                className={`balance-badge ${
                  stats.closingBalance >= 0 ? "badge-dr" : "badge-cr"
                }`}
              >
                {stats.closingBalance >= 0 ? "NET RECEIVABLE" : "NET PAYABLE"}
              </span>
            </div>
          </section>
        )}

        {/* Main Data Table */}
        <div className="print-report-table-wrap">
          <table className="print-report-table">
            <thead>
              <tr>
                {report.columns.map((column) => (
                  <th
                    key={column}
                    className={
                      column === "Debit" || column === "Credit" || column === "Balance" || column === "Amount"
                        ? "text-right"
                        : ""
                    }
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index} className={row.Type === "Opening Balance" ? "opening-row" : ""}>
                  {report.columns.map((column) => {
                    const val = row[column];
                    const isDebit = column === "Debit" && val !== "—";
                    const isCredit = column === "Credit" && val !== "—";
                    const isNum = column === "Debit" || column === "Credit" || column === "Balance" || column === "Amount";

                    return (
                      <td
                        key={column}
                        className={`${isNum ? "text-right" : ""} ${
                          isDebit ? "debit-cell" : isCredit ? "credit-cell" : ""
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {stats && type === "party-ledger" && (
                <tr className="ledger-total-row">
                  <td colSpan={4} className="text-right bold-label">
                    TOTAL PERIOD VOLUME
                  </td>
                  <td className="text-right bold-value debit-text">
                    {formatPKR(stats.totalDebit)}
                  </td>
                  <td className="text-right bold-value credit-text">
                    {formatPKR(stats.totalCredit)}
                  </td>
                  <td className="text-right bold-value">
                    {formatPKR(Math.abs(stats.closingBalance))}{" "}
                    {stats.closingBalance >= 0 ? "Dr" : "Cr"}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Signatures */}
        <footer className="report-executive-footer">
          <div className="sig-block">
            <div className="sig-line-bar" />
            <span>Prepared By</span>
          </div>
          <div className="sig-block">
            <div className="sig-line-bar" />
            <span>Checked By</span>
          </div>
          <div className="sig-block">
            <div className="sig-line-bar" />
            <span>Authorized Signature &amp; Stamp</span>
          </div>
        </footer>
      </article>
    </main>
  );
}
