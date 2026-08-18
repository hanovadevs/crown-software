import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { WhatsAppLedgerButton } from "@/components/whatsapp-ledger-button";
import { getBill } from "@/db/billing-queries";
import { formatDate, formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Bill / Invoice" };

function splitRupeesPaise(amount: number | string) {
  const num = Number(amount) || 0;
  const parts = num.toFixed(2).split(".");
  return {
    rs: Number(parts[0]).toLocaleString(),
    ps: parts[1] || "00",
  };
}

export default async function BillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getBill(id);
  if (!result) notFound();
  const { bill, items } = result;

  const isTaxInvoice = bill.type === "tax_invoice";

  const docTitle =
    bill.type === "tax_invoice"
      ? "Sales Tax / S.E.D. Invoice"
      : bill.type === "invoice"
        ? "Commercial Invoice"
        : "Quotation";

  const whatsappMessage = [
    `${docTitle} — ${bill.billNumber}`,
    `Date: ${formatDate(bill.billDate)}`,
    `Net Total: ${formatPKR(bill.totalAmount)}`,
    "",
    "Please find the detailed invoice PDF attached.",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="page invoice-page">
      <div className="invoice-actions no-print">
        <Link className="button button-secondary" href="/bills/new">
          <ArrowLeft size={19} /> New Bill
        </Link>
        <PrintButton label="Print / Save PDF" />
        <WhatsAppLedgerButton phone={bill.party.phone} message={whatsappMessage} />
      </div>

      {isTaxInvoice ? (
        <article className="invoice-sheet tax-invoice-sheet">
          <header className="tax-invoice-top">
            <div className="tax-title-box">
              <h1>SALES TAX / S.E.D. INVOICE</h1>
            </div>
            <div className="tax-copy-options">
              <span>Original</span>
              <span>Duplicate</span>
              <span>Triplicate</span>
            </div>
          </header>

          <section className="tax-header-meta">
            <div className="tax-meta-row">
              <div className="tax-meta-cell">
                <span className="label">Serial No.</span>
                <strong className="serial-no-highlight">{bill.billNumber}</strong>
              </div>
              <div className="tax-meta-cell">
                <span className="label">Date</span>
                <strong>{formatDate(bill.billDate)}</strong>
              </div>
              <div className="tax-meta-cell">
                <span className="label">Time of Supply</span>
                <strong>{bill.timeOfSupply || "10:30 AM"}</strong>
              </div>
            </div>

            <div className="tax-parties-grid">
              <div className="tax-party-col">
                <div className="tax-field-line">
                  <span className="field-label">Supplier&apos;s Name</span>
                  <span className="field-value">Crown Accumulator</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">Address</span>
                  <span className="field-value">55/28-C, AKBAR COLONY, MOMINPURA ROAD, DAROGHAWALA, LAHORE</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">Telephone No.</span>
                  <span className="field-value">+92 300 1234567</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">National Tax No.</span>
                  <span className="field-value">{bill.supplierNtn || "1234567-8"}</span>
                </div>
              </div>

              <div className="tax-party-col">
                <div className="tax-field-line">
                  <span className="field-label">Buyer&apos;s Name</span>
                  <span className="field-value">{bill.party.name}</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">Address</span>
                  <span className="field-value">{bill.party.address || "—"}</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">Telephone No.</span>
                  <span className="field-value">{bill.party.phone || "—"}</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">National Tax No.</span>
                  <span className="field-value">{bill.buyerNtn || bill.party.taxNumber || "—"}</span>
                </div>
              </div>
            </div>

            <div className="tax-field-line full-line">
              <span className="field-label">Terms of Sales</span>
              <span className="field-value">{bill.termsOfSales || "Cash"}</span>
            </div>
          </section>

          <table className="tax-data-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: "45px" }}>Qty</th>
                <th rowSpan={2}>Description</th>
                <th rowSpan={2} style={{ width: "90px" }}>Rate</th>
                <th colSpan={2}>
                  Amount Excluding S.T. & S.E.D.
                </th>
                <th colSpan={2}>
                  Sales Tax @ {Number(bill.taxRate)}%
                </th>
                <th colSpan={2}>
                  S.E.D. @ {Number(bill.sedRate)}%
                </th>
                <th colSpan={2}>
                  Amount Including Sales Tax & S.E.D.
                </th>
              </tr>
              <tr>
                <th style={{ width: "70px" }}>Rs.</th>
                <th style={{ width: "35px" }}>Ps.</th>
                <th style={{ width: "65px" }}>Rs.</th>
                <th style={{ width: "35px" }}>Ps.</th>
                <th style={{ width: "65px" }}>Rs.</th>
                <th style={{ width: "35px" }}>Ps.</th>
                <th style={{ width: "75px" }}>Rs.</th>
                <th style={{ width: "35px" }}>Ps.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const baseVal = Number(item.quantity) * Number(item.unitPrice);
                const stVal = Number(item.salesTaxAmount) || baseVal * (Number(bill.taxRate) / 100);
                const sedVal = Number(item.sedAmount) || baseVal * (Number(bill.sedRate) / 100);
                const incTotal = Number(item.lineTotal) || (baseVal + stVal + sedVal);

                const baseSplit = splitRupeesPaise(baseVal);
                const stSplit = splitRupeesPaise(stVal);
                const sedSplit = splitRupeesPaise(sedVal);
                const totalSplit = splitRupeesPaise(incTotal);

                return (
                  <tr key={item.id}>
                    <td className="text-center">{Number(item.quantity).toLocaleString()}</td>
                    <td>
                      <strong>{item.description}</strong>
                      {item.sku && <small className="sku-tag"> ({item.sku})</small>}
                    </td>
                    <td className="text-right">{Number(item.unitPrice).toLocaleString()}</td>
                    <td className="text-right">{baseSplit.rs}</td>
                    <td className="text-center">{baseSplit.ps}</td>
                    <td className="text-right">{stSplit.rs}</td>
                    <td className="text-center">{stSplit.ps}</td>
                    <td className="text-right">{sedSplit.rs}</td>
                    <td className="text-center">{sedSplit.ps}</td>
                    <td className="text-right"><strong>{totalSplit.rs}</strong></td>
                    <td className="text-center">{totalSplit.ps}</td>
                  </tr>
                );
              })}

              <tr className="tax-total-row">
                <td colSpan={3} className="text-right bold-label">
                  Total
                </td>
                <td className="text-right bold-value">{splitRupeesPaise(bill.subtotal).rs}</td>
                <td className="text-center bold-value">{splitRupeesPaise(bill.subtotal).ps}</td>
                <td className="text-right bold-value">{splitRupeesPaise(bill.taxAmount).rs}</td>
                <td className="text-center bold-value">{splitRupeesPaise(bill.taxAmount).ps}</td>
                <td className="text-right bold-value">{splitRupeesPaise(bill.sedAmount).rs}</td>
                <td className="text-center bold-value">{splitRupeesPaise(bill.sedAmount).ps}</td>
                <td className="text-right bold-value">{splitRupeesPaise(bill.totalAmount).rs}</td>
                <td className="text-center bold-value">{splitRupeesPaise(bill.totalAmount).ps}</td>
              </tr>
            </tbody>
          </table>

          <section className="tax-footer-summary">
            <div className="tax-totals-breakdown">
              <div className="tax-summary-line">
                <span>Sales Tax</span>
                <strong>{formatPKR(bill.taxAmount)}</strong>
              </div>
              <div className="tax-summary-line">
                <span>S.E.D.</span>
                <strong>{formatPKR(bill.sedAmount)}</strong>
              </div>
              <div className="tax-summary-line grand">
                <span>Net Tax Inclusive Value</span>
                <strong>{formatPKR(bill.totalAmount)}</strong>
              </div>
            </div>

            <div className="tax-signatures-box">
              <div className="sig-line">
                <span className="sig-label">Signature</span>
                <span className="sig-border" />
              </div>
              <div className="sig-line">
                <span className="sig-label">Name &amp; Designation</span>
                <span className="sig-border">{bill.createdBy}</span>
              </div>
            </div>
          </section>
        </article>
      ) : (
        <article className="invoice-sheet">
          <header className="invoice-head">
            <div className="invoice-brand">
              <Image
                className="print-brand-logo"
                src="/CrownAccumulatorbox.jpeg"
                alt="Crown Accumulator"
                width={300}
                height={291}
              />
              <div>
                <h1>Crown Accumulator</h1>
                <p style={{ fontWeight: 600, color: "#1e293b", margin: "2px 0" }}>55/28-C, Akbar Colony, Mominpura Road, Daroghawala, Lahore</p>
                <p style={{ fontSize: "12px", opacity: 0.8 }}>Battery Manufacturing &amp; Management System</p>
              </div>
            </div>
            <div className="invoice-solo">
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
          <div className="invoice-rule" />
          <section className="invoice-meta">
            <div>
              <span>Bill to</span>
              <h2>{bill.party.name}</h2>
              <p>{bill.party.contactPerson}</p>
              <p>{bill.party.address}</p>
              <p>{bill.party.phone}</p>
            </div>
            <dl>
              <div>
                <dt>{bill.type === "invoice" ? "Invoice" : "Quotation"} No.</dt>
                <dd>{bill.billNumber}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDate(bill.billDate)}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{formatDate(bill.dueDate)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className="capitalize">{bill.status}</dd>
              </div>
            </dl>
          </section>
          <table className="invoice-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.description}</strong>
                    {item.sku && <small>{item.sku}</small>}
                  </td>
                  <td>{Number(item.quantity).toLocaleString()}</td>
                  <td>{formatPKR(item.unitPrice)}</td>
                  <td>{formatPKR(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <section className="invoice-totals">
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPKR(bill.subtotal)}</dd>
              </div>
              <div>
                <dt>Tax ({Number(bill.taxRate)}%)</dt>
                <dd>{formatPKR(bill.taxAmount)}</dd>
              </div>
              {Number(bill.shippingAmount) > 0 && (
                <div>
                  <dt>Shipping</dt>
                  <dd>{formatPKR(bill.shippingAmount)}</dd>
                </div>
              )}
              {Number(bill.discountAmount) > 0 && (
                <div>
                  <dt>Discount</dt>
                  <dd>− {formatPKR(bill.discountAmount)}</dd>
                </div>
              )}
              <div className="invoice-total">
                <dt>Total</dt>
                <dd>{formatPKR(bill.totalAmount)}</dd>
              </div>
            </dl>
          </section>
          {bill.notes && (
            <section className="invoice-notes">
              <strong>Notes / Terms</strong>
              <p>{bill.notes}</p>
            </section>
          )}
          <footer className="invoice-footer">
            <p>Prepared by {bill.createdBy}</p>
            <p>Thank you for your business.</p>
          </footer>
        </article>
      )}
    </main>
  );
}
