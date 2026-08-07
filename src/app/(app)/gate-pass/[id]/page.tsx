import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getGatePass } from "@/db/gate-pass-queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Gate Pass" };

export default async function GatePassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getGatePass(id);
  if (!result) notFound();
  const { gatePass, items } = result;

  const isInward = gatePass.direction === "inward";
  const directionLabel = isInward ? "INWARD" : "OUTWARD";

  return (
    <main className="page invoice-page">
      <div className="invoice-actions no-print">
        <Link className="button button-secondary" href="/gate-pass">
          <ArrowLeft size={19} /> All Gate Passes
        </Link>
        <Link className="button button-primary" href="/gate-pass/new">
          New Gate Pass
        </Link>
        <PrintButton label="Print / Save PDF" />
      </div>

      <article className="invoice-sheet gate-pass-sheet">
        {/* Letterhead */}
        <header className="gp-header">
          <div className="gp-company">
            <h1 className="gp-company-name">CROWN ACCUMULATOR</h1>
            <p className="gp-company-sub">Manufacturers of Crown &amp; SOLO Batteries</p>
            <p className="gp-company-address">
              55/28-C, AKBAR COLONY, MOMINPURA ROAD, DAROGHAWALA, LAHORE
            </p>
            <p className="gp-company-phone">Phone: +92 300 1234567</p>
          </div>
          <div className={`gp-direction-badge ${isInward ? "inward" : "outward"}`}>
            {isInward ? <ArrowDownLeft size={28} /> : <ArrowUpRight size={28} />}
            <span>{directionLabel}</span>
          </div>
        </header>

        <div className="gp-title-bar">
          <h2 className="gp-title">GATE PASS — {directionLabel}</h2>
        </div>

        {/* Meta row */}
        <section className="gp-meta-grid">
          <div className="gp-meta-cell">
            <span className="label">Gate Pass No.</span>
            <strong>{gatePass.number}</strong>
          </div>
          <div className="gp-meta-cell">
            <span className="label">Date</span>
            <strong>{formatDate(gatePass.date)}</strong>
          </div>
          <div className="gp-meta-cell">
            <span className="label">Status</span>
            <span
              className={`badge ${
                gatePass.status === "issued"
                  ? "badge-primary"
                  : gatePass.status === "received"
                    ? "badge-success"
                    : gatePass.status === "cancelled"
                      ? "badge-danger"
                      : "badge-secondary"
              }`}
            >
              {gatePass.status.toUpperCase()}
            </span>
          </div>
          {gatePass.isReturnable && (
            <div className="gp-meta-cell">
              <span className="label">Returnable</span>
              <strong>YES{gatePass.expectedReturnDate ? ` (by ${formatDate(gatePass.expectedReturnDate)})` : ""}</strong>
            </div>
          )}
        </section>

        {/* Party & Vehicle Info */}
        <section className="gp-info-grid">
          <div className="gp-info-col">
            <h3>Party / Consignee</h3>
            <div className="gp-field">
              <span>Name:</span>
              <strong>{gatePass.partyName || "—"}</strong>
            </div>
            <div className="gp-field">
              <span>Address:</span>
              <strong>{gatePass.partyAddress || "—"}</strong>
            </div>
            <div className="gp-field">
              <span>Phone:</span>
              <strong>{gatePass.partyPhone || "—"}</strong>
            </div>
          </div>
          <div className="gp-info-col">
            <h3>Vehicle &amp; Driver</h3>
            <div className="gp-field">
              <span>Vehicle No:</span>
              <strong>{gatePass.vehicleNumber || "—"}</strong>
            </div>
            <div className="gp-field">
              <span>Driver Name:</span>
              <strong>{gatePass.driverName || "—"}</strong>
            </div>
            <div className="gp-field">
              <span>Driver Phone:</span>
              <strong>{gatePass.driverPhone || "—"}</strong>
            </div>
          </div>
        </section>

        {/* Items Table */}
        <table className="gp-items-table">
          <thead>
            <tr>
              <th style={{ width: "45px" }}>S.No</th>
              <th>Description of Goods / Materials</th>
              <th style={{ width: "90px" }}>Quantity</th>
              <th style={{ width: "70px" }}>Unit</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td className="center">{idx + 1}</td>
                <td>
                  <strong>{item.description}</strong>
                  {item.productSku && (
                    <small className="cell-subtitle">SKU: {item.productSku}</small>
                  )}
                </td>
                <td className="center">{Number(item.quantity).toLocaleString()}</td>
                <td className="center">{item.unit}</td>
                <td>{item.remarks || "—"}</td>
              </tr>
            ))}
            {/* Empty rows for handwritten entries */}
            {items.length < 8 &&
              Array.from({ length: 8 - items.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="gp-empty-row">
                  <td className="center">{items.length + i + 1}</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Remarks */}
        {gatePass.remarks && (
          <div className="gp-remarks">
            <strong>Remarks:</strong> {gatePass.remarks}
          </div>
        )}

        {/* Signature Block */}
        <footer className="gp-signatures">
          <div className="gp-sig-cell">
            <div className="gp-sig-name">{gatePass.authorizedBy || ""}</div>
            <div className="gp-sig-line" />
            <span>Authorized By</span>
          </div>
          <div className="gp-sig-cell">
            <div className="gp-sig-name">{gatePass.gateKeeperName || ""}</div>
            <div className="gp-sig-line" />
            <span>Gate Keeper</span>
          </div>
          <div className="gp-sig-cell">
            <div className="gp-sig-name">{gatePass.receivedBy || ""}</div>
            <div className="gp-sig-line" />
            <span>{isInward ? "Received By (Store)" : "Received By (Party)"}</span>
          </div>
        </footer>

        <p className="gp-footer-note">
          This gate pass is the property of Crown Accumulator. Unauthorized use is prohibited.
        </p>
      </article>
    </main>
  );
}
