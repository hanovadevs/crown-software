import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { WhatsAppLedgerButton } from "@/components/whatsapp-ledger-button";
import { DeleteButton } from "@/components/delete-button";
import { deleteBillAction, updateBillStatusAction } from "@/app/actions/billing";
import { getBill } from "@/db/billing-queries";
import { getCompanySettings } from "@/db/operations-queries";
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
  const [result, settings] = await Promise.all([
    getBill(id),
    getCompanySettings(),
  ]);
  if (!result) notFound();
  const { bill, items } = result;

  const company = (settings?.company ?? {}) as Record<string, string>;
  const companyName = company.name || "Crown Accumulator";
  const companyAddress = company.address || "55/28-C, AKBAR COLONY, MOMINPURA ROAD, DAROGHAWALA, LAHORE";
  const companyPhone = company.phone || "+92 300 1234567";
  const companyNtn = bill.supplierNtn || company.taxNumber || "1234567-8";

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
        <div className="invoice-actions-group">
          <Link className="button button-secondary" href="/bills">
            <ArrowLeft size={18} /> All Bills
          </Link>
          <Link className="button button-secondary" href="/bills/new">
            New Bill
          </Link>
        </div>
        <div className="invoice-actions-group">
          <PrintButton label="Print / Save PDF" />
          <WhatsAppLedgerButton
            phone={bill.party.phone}
            message={whatsappMessage}
            documentName={bill.billNumber}
          />
          {bill.status === "issued" && (
            <>
              <form action={updateBillStatusAction.bind(null, id, "paid")}>
                <button className="button button-success" type="submit">
                  <CheckCircle2 size={16} /> Mark as Paid
                </button>
              </form>
              <form action={updateBillStatusAction.bind(null, id, "cancelled")}>
                <button className="button button-secondary" type="submit">
                  <XCircle size={16} /> Cancel Bill
                </button>
              </form>
            </>
          )}
          {bill.status !== "issued" && (
            <form action={updateBillStatusAction.bind(null, id, "issued")}>
              <button className="button button-secondary" type="submit">
                <RotateCcw size={16} /> Re-open (Mark Issued)
              </button>
            </form>
          )}
          <DeleteButton
            action={deleteBillAction.bind(null, id)}
            confirmMessage={`Delete bill ${bill.billNumber}? This will permanently remove this invoice.`}
            label={`Delete ${bill.billNumber}`}
          />
        </div>
      </div>

      {isTaxInvoice ? (
        <article className="invoice-sheet tax-invoice-sheet">
          {/* Corporate Letterhead Header */}
          <header className="tax-letterhead">
            <div className="tax-letterhead-brand">
              <div className="tax-logo-frame">
                <Image
                  className="tax-brand-logo"
                  src="/CrownAccumulatorbox.jpeg"
                  alt={companyName}
                  width={300}
                  height={291}
                  priority
                />
              </div>
              <div className="tax-brand-details">
                <h1 className="tax-company-name">{companyName}</h1>
                <p className="tax-company-address">{companyAddress}</p>
                <div className="tax-company-contact">
                  <span>Phone: {companyPhone}</span>
                  <span className="tax-contact-sep">•</span>
                  <span>NTN: {companyNtn}</span>
                  <span className="tax-contact-sep">•</span>
                  <span>STRN: 12-00-1234-567-89</span>
                </div>
              </div>
            </div>

            <div className="tax-letterhead-co-brand">
              <div className="solo-logo-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="solo-logo-img"
                  src="/solo-removebg-preview.png"
                  alt="SOLO"
                  width={104}
                  height={48}
                />
              </div>
              <span className="tax-co-tag">Official Co-Brand Partner</span>
            </div>
          </header>

          {/* Statutory Title Box & Copy Selection */}
          <div className="tax-invoice-top">
            <div className="tax-title-box">
              <h2>SALES TAX / S.E.D. INVOICE</h2>
              <span className="tax-statutory-ref">Issued under Section 23 of Sales Tax Act, 1990 &amp; Federal Excise Act, 2005</span>
            </div>
            <div className="tax-copy-options">
              <span className="active-copy">✓ Original (Buyer)</span>
              <span>Duplicate (Supplier)</span>
              <span>Triplicate (Record)</span>
            </div>
          </div>

          <section className="tax-header-meta">
            <div className="tax-meta-row">
              <div className="tax-meta-cell">
                <span className="label">Serial / Invoice No.</span>
                <strong className="serial-no-highlight">{bill.billNumber}</strong>
              </div>
              <div className="tax-meta-cell">
                <span className="label">Date of Supply</span>
                <strong>{formatDate(bill.billDate)}</strong>
              </div>
              <div className="tax-meta-cell">
                <span className="label">Time of Supply</span>
                <strong>{bill.timeOfSupply || "10:30 AM"}</strong>
              </div>
            </div>

            <div className="tax-parties-grid">
              <div className="tax-party-col">
                <div className="tax-party-badge">SUPPLIER (CONSIGNOR)</div>
                <div className="tax-field-line">
                  <span className="field-label">Name</span>
                  <span className="field-value"><strong>{companyName}</strong></span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">Factory Address</span>
                  <span className="field-value">{companyAddress}</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">Telephone No.</span>
                  <span className="field-value">{companyPhone}</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">National Tax No. (NTN)</span>
                  <span className="field-value"><strong>{companyNtn}</strong></span>
                </div>
              </div>

              <div className="tax-party-col">
                <div className="tax-party-badge">BUYER (CONSIGNEE)</div>
                <div className="tax-field-line">
                  <span className="field-label">Name</span>
                  <span className="field-value"><strong>{bill.party.name}</strong></span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">Buyer Address</span>
                  <span className="field-value">{bill.party.address || "—"}</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">Telephone No.</span>
                  <span className="field-value">{bill.party.phone || "—"}</span>
                </div>
                <div className="tax-field-line">
                  <span className="field-label">National Tax No. (NTN)</span>
                  <span className="field-value"><strong>{bill.buyerNtn || bill.party.taxNumber || "—"}</strong></span>
                </div>
              </div>
            </div>

            <div className="tax-field-line full-line tax-terms-row">
              <span className="field-label">Terms of Sales</span>
              <span className="field-value"><strong>{bill.termsOfSales || "Cash"}</strong></span>
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
              <div className="brand-logo-frame">
                <Image
                  className="print-brand-logo"
                  src="/CrownAccumulatorbox.jpeg"
                  alt={companyName}
                  width={300}
                  height={291}
                  priority
                />
              </div>
              <div className="brand-details">
                <div className="brand-title-wrap">
                  <h1 className="brand-company-title">{companyName}</h1>
                </div>
                <p className="brand-address">{companyAddress}</p>
                <div className="brand-contact">
                  <span>Phone: {companyPhone}</span>
                  <span className="contact-sep">•</span>
                  <span>NTN: {companyNtn}</span>
                  <span className="contact-sep">•</span>
                  <span>Lahore, Pakistan</span>
                </div>
              </div>
            </div>

            <div className="invoice-head-right">
              <div className="invoice-type-pill">
                {bill.type === "invoice"
                  ? "COMMERCIAL INVOICE"
                  : bill.type === "tax_invoice"
                    ? "SALES TAX INVOICE"
                    : "OFFICIAL PRICE QUOTATION"}
              </div>
              <div className="solo-badge-container">
                <div className="solo-logo-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="solo-logo-img"
                    src="/solo-removebg-preview.png"
                    alt="SOLO Batteries"
                    width={104}
                    height={48}
                  />
                </div>
                <span className="solo-tagline">Powered by SOLO</span>
              </div>
            </div>
          </header>

          <div className="invoice-rule" />

          <section className="invoice-meta">
            <div className="invoice-party-card">
              <span className="party-card-eyebrow">Billed To (Customer)</span>
              <h2>{bill.party.name}</h2>
              {bill.party.contactPerson && <p className="party-contact-person">Attn: {bill.party.contactPerson}</p>}
              <p className="party-address">{bill.party.address || "Lahore, Pakistan"}</p>
              <p className="party-phone">Tel: {bill.party.phone || "—"}</p>
              {bill.party.taxNumber && <p className="party-tax">NTN/STRN: {bill.party.taxNumber}</p>}
            </div>
            <dl className="invoice-meta-dl">
              <div>
                <dt>{bill.type === "invoice" ? "Invoice" : "Quotation"} No.</dt>
                <dd className="invoice-meta-number">{bill.billNumber}</dd>
              </div>
              <div>
                <dt>Issue Date</dt>
                <dd>{formatDate(bill.billDate)}</dd>
              </div>
              <div>
                <dt>Due Date</dt>
                <dd>{formatDate(bill.dueDate)}</dd>
              </div>
              <div>
                <dt>Document Status</dt>
                <dd>
                  <span
                    className={`badge ${
                      bill.status === "paid"
                        ? "badge-success"
                        : bill.status === "issued"
                          ? "badge-primary"
                          : bill.status === "cancelled"
                            ? "badge-danger"
                            : "badge-secondary"
                    }`}
                  >
                    {bill.status.toUpperCase()}
                  </span>
                </dd>
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
          {/* Executive 2-Column Bottom Section: Bank/Terms on Left, Structured Totals on Right */}
          <div className="invoice-bottom-grid">
            <div className="invoice-bottom-left">
              <div className="invoice-bank-card">
                <div className="bank-card-header">
                  <span className="bank-card-title">Bank &amp; Payment Details</span>
                </div>
                <div className="bank-card-body">
                  <div className="bank-detail-row">
                    <span className="bank-label">Bank:</span>
                    <strong className="bank-val">Bank Alfalah Ltd / Meezan Bank</strong>
                  </div>
                  <div className="bank-detail-row">
                    <span className="bank-label">Account Title:</span>
                    <strong className="bank-val">Crown Accumulator</strong>
                  </div>
                  <div className="bank-detail-row">
                    <span className="bank-label">Payment Mode:</span>
                    <span className="bank-val">Crossed Cheque / Online Transfer / Cash</span>
                  </div>
                </div>
              </div>

              <div className="invoice-terms-card">
                <span className="terms-title">Terms &amp; Conditions</span>
                <ul className="terms-list">
                  <li>Payment is due within agreed terms from invoice date.</li>
                  <li>Warranty claims subject to physical inspection &amp; warranty verification.</li>
                  <li>Goods once sold will not be returned or exchanged without authorized gate pass.</li>
                  {bill.notes && (
                    <li className="custom-note">
                      <strong>Note:</strong> {bill.notes}
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="invoice-bottom-right">
              <div className="invoice-totals-box">
                <div className="totals-row">
                  <span className="totals-label">Subtotal</span>
                  <span className="totals-val">{formatPKR(bill.subtotal)}</span>
                </div>
                {Number(bill.taxRate) > 0 && (
                  <div className="totals-row">
                    <span className="totals-label">Sales Tax ({Number(bill.taxRate)}%)</span>
                    <span className="totals-val">{formatPKR(bill.taxAmount)}</span>
                  </div>
                )}
                {Number(bill.shippingAmount) > 0 && (
                  <div className="totals-row">
                    <span className="totals-label">Freight / Shipping</span>
                    <span className="totals-val">{formatPKR(bill.shippingAmount)}</span>
                  </div>
                )}
                {Number(bill.discountAmount) > 0 && (
                  <div className="totals-row discount">
                    <span className="totals-label">Special Discount</span>
                    <span className="totals-val">− {formatPKR(bill.discountAmount)}</span>
                  </div>
                )}
                <div className="totals-row grand-total">
                  <span className="totals-label">Balance Due</span>
                  <span className="totals-val">{formatPKR(bill.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Column Formal Signatures & Stamp Block */}
          <div className="invoice-signatures-block">
            <div className="sig-col">
              <span className="sig-person">{bill.createdBy || "System Operator"}</span>
              <div className="sig-line" />
              <span className="sig-title">Prepared By</span>
            </div>
            <div className="sig-col">
              <div className="sig-line-empty" />
              <div className="sig-line" />
              <span className="sig-title">Customer / Receiver Signature</span>
            </div>
            <div className="sig-col stamp-col">
              <div className="sig-stamp-placeholder">
                <span className="stamp-text">Official Stamp</span>
              </div>
              <div className="sig-line" />
              <span className="sig-title">Authorized Signatory</span>
            </div>
          </div>
        </article>
      )}
    </main>
  );
}
