import { ArrowLeft, ArrowLeftRight, Building2, FileText, Mail, MapPin, Pencil, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getParty } from "@/db/business-queries";
import { formatDate, formatPKR } from "@/lib/utils";
import { deletePartyAction } from "@/app/actions/business";
import { DeleteButton } from "@/components/delete-button";
import { WhatsAppLedgerButton } from "@/components/whatsapp-ledger-button";

export const metadata: Metadata = { title: "Party Ledger" };

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getParty(id);
  if (!result) notFound();
  const { party, activity, receivable, payable } = result;
  const netBalance = receivable - payable;
  const whatsappMessage = [
    `Party Ledger Summary — ${party.name}`,
    `Receivable: ${formatPKR(receivable)}`,
    `Payable: ${formatPKR(payable)}`,
    `Net Balance: ${formatPKR(Math.abs(netBalance))} ${netBalance >= 0 ? "Receivable" : "Payable"}`,
    `Statement Date: ${formatDate(new Date())}`,
  ].join("\n");

  return (
    <main className="page">
      <div className="back-title">
        <Link className="icon-button" href="/parties" aria-label="Back to parties">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <div className="eyebrow">Party ledger</div>
          <h1 className="page-title">{party.name}</h1>
          <p className="page-description">
            {party.isCustomer && party.isSupplier
              ? "Customer & Supplier"
              : party.isCustomer
                ? "Customer"
                : "Supplier"}
          </p>
        </div>
        <div className="card-actions detail-actions">
          <WhatsAppLedgerButton phone={party.phone} message={whatsappMessage} triggerPrint={false} />
          <Link className="button button-secondary" href={`/reports/print?type=party-ledger&partyId=${id}`}><FileText size={16} /> Print ledger</Link>
          <Link className="button button-primary" href="/transactions/new"><ArrowLeftRight size={16} /> New transaction</Link>
          <Link className="button button-secondary" href={`/parties/${id}/edit`}><Pencil size={16} /> Edit</Link>
          <DeleteButton action={deletePartyAction.bind(null, id)} confirmMessage={`Delete ${party.name} and all linked records?`} label={`Delete ${party.name}`} />
        </div>
      </div>

      <section className="detail-layout">
        <article className="card panel">
          <h2 className="section-title">Contact information</h2>
          <div className="contact-list">
            <p>
              <Building2 size={18} /> {party.contactPerson || "No contact person"}
            </p>
            <p>
              <Phone size={18} /> {party.phone || "No phone"}
            </p>
            <p>
              <Mail size={18} /> {party.email || "No email"}
            </p>
            <p>
              <MapPin size={18} /> {party.address || "No address"}
            </p>
          </div>
        </article>
        <article className="card panel">
          <h2 className="section-title">Current balances</h2>
          <div className="summary-numbers">
            <div>
              <span>Receivable</span>
              <strong>{formatPKR(receivable)}</strong>
            </div>
            <div>
              <span>Payable</span>
              <strong>{formatPKR(payable)}</strong>
            </div>
          </div>
          <p className="muted-text">Includes opening balances and all posted transactions.</p>
        </article>
      </section>

      <section className="card table-card">
        <div className="table-title">
          <h2>Transaction history</h2>
          <span>{activity.length} records</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Type</th>
                <th>Description</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {activity.length ? (
                activity.map((item) => (
                  <tr key={item.id}>
                    <td><Link href={`/transactions/${item.id}`}>{item.number}</Link></td>
                    <td>
                      <span className="badge badge-primary">
                        {item.type.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>{item.description}</td>
                    <td>{item.paymentMethod.replaceAll("_", " ")}</td>
                    <td><span className={`badge ${item.status === "posted" ? "badge-success" : "badge-muted"}`}>{item.status}</span></td>
                    <td>{formatDate(item.date)}</td>
                    <td className="amount-cell">{formatPKR(item.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No transactions have been posted for this party.
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
