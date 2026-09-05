import { ArrowLeftRight, Building2, ClipboardCheck, FileText, Package, Search, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { globalSearch } from "@/db/operations-queries";
import { formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await globalSearch(q);
  const hasResults =
    results.parties.length ||
    results.products.length ||
    results.transactions.length ||
    results.bills.length ||
    results.gatePasses.length ||
    results.workers.length;

  return (
    <main className="page form-page">
      <PageHeader
        title="Global Search"
        description="Find parties, products, transactions, invoices, gate passes, and workers"
      />
      <form className="card filter-bar" method="get">
        <div className="search-field">
          <Search className="input-icon" size={20} />
          <input
            className="input has-icon"
            defaultValue={q}
            name="q"
            placeholder="Search by name, code, invoice #, GP #, SKU…"
            autoFocus
          />
        </div>
        <button className="button button-primary" type="submit">
          Search
        </button>
      </form>

      {q.length >= 2 && !hasResults ? (
        <section className="card empty-state">
          <Search size={40} />
          <h2>No results</h2>
          <p>Try a party name, SKU, invoice number, gate pass number, or worker name.</p>
        </section>
      ) : (
        <section className="search-results">
          {results.parties.length > 0 && (
            <article className="card panel">
              <h2 className="section-title">Parties</h2>
              <div className="result-list">
                {results.parties.map((party) => (
                  <Link href={`/parties/${party.id}`} key={party.id}>
                    <Building2 size={19} />
                    <span>
                      <strong>{party.name}</strong>
                      <small>{party.phone || "Customer / supplier"}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          )}
          {results.products.length > 0 && (
            <article className="card panel">
              <h2 className="section-title">Products</h2>
              <div className="result-list">
                {results.products.map((product) => (
                  <Link
                    href={`/products?q=${encodeURIComponent(product.sku)}`}
                    key={product.id}
                  >
                    <Package size={19} />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.sku}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          )}
          {results.transactions.length > 0 && (
            <article className="card panel">
              <h2 className="section-title">Transactions</h2>
              <div className="result-list">
                {results.transactions.map((transaction) => (
                  <Link
                    href={`/transactions?q=${encodeURIComponent(transaction.number)}`}
                    key={transaction.id}
                  >
                    <ArrowLeftRight size={19} />
                    <span>
                      <strong>{transaction.description}</strong>
                      <small>{transaction.number}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          )}
          {results.bills.length > 0 && (
            <article className="card panel">
              <h2 className="section-title">Invoices & Bills</h2>
              <div className="result-list">
                {results.bills.map((bill) => (
                  <Link href={`/bills/${bill.id}`} key={bill.id}>
                    <FileText size={19} />
                    <span>
                      <strong>{bill.billNumber}</strong>
                      <small>{bill.type.replaceAll("_", " ")} · {formatPKR(bill.totalAmount)}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          )}
          {results.gatePasses.length > 0 && (
            <article className="card panel">
              <h2 className="section-title">Gate Passes</h2>
              <div className="result-list">
                {results.gatePasses.map((gp) => (
                  <Link href={`/gate-pass/${gp.id}`} key={gp.id}>
                    <ClipboardCheck size={19} />
                    <span>
                      <strong>{gp.gatePassNumber}</strong>
                      <small>{gp.direction.toUpperCase()}{gp.vehicleNumber ? ` · ${gp.vehicleNumber}` : ""}{gp.driverName ? ` · ${gp.driverName}` : ""}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          )}
          {results.workers.length > 0 && (
            <article className="card panel">
              <h2 className="section-title">Workers</h2>
              <div className="result-list">
                {results.workers.map((worker) => (
                  <Link href={`/workers/${worker.id}`} key={worker.id}>
                    <UserCheck size={19} />
                    <span>
                      <strong>{worker.name}</strong>
                      <small>{worker.workerCode}{worker.designation ? ` · ${worker.designation}` : ""}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          )}
        </section>
      )}
    </main>
  );
}
