import { Building2, Eye, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { DeleteButton } from "@/components/delete-button";
import { deletePartyAction } from "@/app/actions/business";
import { listParties } from "@/db/business-queries";
import { formatPKR } from "@/lib/utils";
import { WhatsAppLedgerButton } from "@/components/whatsapp-ledger-button";

export const metadata: Metadata = { title: "Customers & Suppliers" };

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const type = params.type ?? "all";
  const partyList = await listParties(search, type);

  return (
    <main className="page">
      <PageHeader
        title="Customers & Suppliers"
        description="Manage customers, suppliers, and companies that work as both"
        action={
          <Link className="button button-primary" href="/parties/new">
            <Plus size={20} />
            Add Party
          </Link>
        }
      />

      <form className="card filter-bar" method="get">
        <div className="search-field">
          <span className="search-field-icon">⌕</span>
          <input
            className="input"
            defaultValue={search}
            name="q"
            placeholder="Search by name, contact, phone, or email…"
            aria-label="Search parties"
          />
        </div>
        <select className="select filter-select" defaultValue={type} name="type">
          <option value="all">All Parties</option>
          <option value="customer">Customers</option>
          <option value="supplier">Suppliers</option>
          <option value="both">Customer & Supplier</option>
        </select>
        <button className="button button-secondary filter-button" type="submit">
          Search
        </button>
      </form>

      {partyList.length ? (
        <section className="party-grid" aria-label="Parties">
          {partyList.map((party) => {
            const both = party.isCustomer && party.isSupplier;
            const netBalance = Number(party.receivable) - Number(party.payable);
            const whatsappMessage = [
              `Party Ledger Summary — ${party.name}`,
              `Receivable: ${formatPKR(party.receivable)}`,
              `Payable: ${formatPKR(party.payable)}`,
              `Net Balance: ${formatPKR(Math.abs(netBalance))} ${netBalance >= 0 ? "Receivable" : "Payable"}`,
            ].join("\n");
            return (
              <article className="card party-card" key={party.id}>
                <div className="party-card-head">
                  <div className="party-title">
                    <Building2 size={20} />
                    <h2>{party.name}</h2>
                  </div>
                  <div className="card-actions">
                    <Link
                      href={`/parties/${party.id}`}
                      className="small-icon-button"
                      aria-label={`View ${party.name}`}
                    >
                      <Eye size={18} />
                    </Link>
                    <Link href={`/parties/${party.id}/edit`} className="small-icon-button" aria-label={`Edit ${party.name}`}>
                      <Pencil size={17} />
                    </Link>
                    <DeleteButton
                      action={deletePartyAction.bind(null, party.id)}
                      confirmMessage={`Delete ${party.name}? Its bills, transactions, stock movements, and ledger entries will also be removed.`}
                      label={`Delete ${party.name}`}
                    />
                  </div>
                </div>
                <div
                  className={`badge ${
                    both
                      ? "badge-warning"
                      : party.isCustomer
                        ? "badge-success"
                        : "badge-primary"
                  }`}
                >
                  {both
                    ? "Customer & Supplier"
                    : party.isCustomer
                      ? "Customer"
                      : "Supplier"}
                </div>
                <div className="party-details">
                  {party.contactPerson && (
                    <p>
                      <span>Contact:</span> {party.contactPerson}
                    </p>
                  )}
                  {party.phone && (
                    <p>
                      <Phone size={16} /> {party.phone}
                    </p>
                  )}
                  {party.email && (
                    <p>
                      <Mail size={16} /> {party.email}
                    </p>
                  )}
                  {party.address && (
                    <p>
                      <MapPin size={16} /> {party.address}
                    </p>
                  )}
                </div>
                <div className="balance-block">
                  {party.isCustomer && (
                    <div>
                      <span>Receivable</span>
                      <strong className="positive">
                        {formatPKR(party.receivable)}
                      </strong>
                    </div>
                  )}
                  {party.isSupplier && (
                    <div>
                      <span>Payable</span>
                      <strong className="negative">
                        {formatPKR(party.payable)}
                      </strong>
                    </div>
                  )}
                </div>
                <div className="party-card-footer">
                  <WhatsAppLedgerButton phone={party.phone} message={whatsappMessage} triggerPrint={false} />
                  <Link className="button button-secondary" href={`/reports/print?type=party-ledger&partyId=${party.id}`}>View Ledger</Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="card empty-state">
          <Building2 size={42} />
          <h2>No parties found</h2>
          <p>Add your first customer or supplier, or change the search filters.</p>
        </section>
      )}
    </main>
  );
}
