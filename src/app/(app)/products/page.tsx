import { Boxes, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { DeleteButton } from "@/components/delete-button";
import { deleteProductAction } from "@/app/actions/business";
import { listProducts } from "@/db/business-queries";
import { formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const productList = await listProducts(q.trim());

  return (
    <main className="page">
      <PageHeader
        title="Products"
        description="Manage your product inventory and PKR pricing"
        action={
          <Link className="button button-primary" href="/products/new">
            <Plus size={20} /> Add Product
          </Link>
        }
      />
      <form className="card filter-bar" method="get">
        <div className="search-field">
          <span className="search-field-icon">⌕</span>
          <input
            className="input"
            defaultValue={q}
            name="q"
            placeholder="Search by name, SKU, description, or category…"
            aria-label="Search products"
          />
        </div>
        <button className="button button-secondary filter-button" type="submit">
          Search
        </button>
      </form>

      <section className="card table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Brand / Category</th>
                <th>Stock</th>
                <th>Purchase price</th>
                <th>Sale price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {productList.length ? (
                productList.map((product) => {
                  const lowStock =
                    Number(product.stock) <= Number(product.reorderLevel);
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="table-primary">
                          <span className="table-icon cyan">
                            <Boxes size={19} />
                          </span>
                          <span>
                            <strong>{product.name}</strong>
                            <small>{product.sku}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>{product.brand}</strong>
                        <small className="cell-subtitle">
                          {product.category || "Uncategorized"}
                        </small>
                        <div className="role-badges">
                          {product.isFinishedGood ? <span className="badge badge-primary">Finished Battery</span> : null}
                          {product.isRawMaterial ? <span className="badge badge-warning">Sub-Product / Material</span> : null}
                        </div>
                      </td>
                      <td>
                        <strong>
                          {Number(product.stock).toLocaleString()} {product.unit}
                        </strong>
                      </td>
                      <td>{formatPKR(product.purchasePrice)}</td>
                      <td className="amount-cell">{formatPKR(product.salePrice)}</td>
                      <td>
                        <span
                          className={`badge ${lowStock ? "badge-danger" : "badge-success"}`}
                        >
                          {lowStock ? "Low stock" : "In stock"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link className="small-icon-button" href={`/products/${product.id}/edit`} aria-label={`Edit ${product.name}`} title={`Edit ${product.name}`}>
                            <Pencil size={17} />
                          </Link>
                          <DeleteButton
                            action={deleteProductAction.bind(null, product.id)}
                            confirmMessage={`Delete ${product.name}? This also removes its stock movements, product transactions, accounting effects, and manufacturing definitions. Historical bill lines will keep their descriptions and amounts.`}
                            label={`Delete ${product.name}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    No products match this search.
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
