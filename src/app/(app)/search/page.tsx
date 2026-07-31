import { ArrowLeftRight, Building2, Package, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { globalSearch } from "@/db/operations-queries";

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
    results.transactions.length;

  return (
    <main className="page form-page">
      <PageHeader
        title="Global Search"
        description="Find parties, products, and transactions"
      />
      <form className="card filter-bar" method="get">
        <div className="search-field">
          <Search className="input-icon" size={20} />
          <input
            className="input has-icon"
            defaultValue={q}
            name="q"
            placeholder="Type at least two characters…"
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
          <p>Try a company name, SKU, transaction number, or description.</p>
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
        </section>
      )}
    </main>
  );
}
