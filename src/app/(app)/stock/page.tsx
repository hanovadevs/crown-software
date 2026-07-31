import { Boxes, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listStockMovements, stockSummary } from "@/db/business-queries";
import { formatDate, formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Stock Check" };

export default async function StockPage() {
  const [rows, movements] = await Promise.all([stockSummary(), listStockMovements()]);
  const totalValue = rows.reduce(
    (sum, row) => sum + Number(row.stock) * Number(row.purchasePrice),
    0,
  );
  return (
    <main className="page">
      <PageHeader
        title="Stock Check"
        description={`Current inventory value: ${formatPKR(totalValue)}`}
        action={<Link className="button button-primary" href="/stock/adjust"><Plus size={18} /> Stock Adjustment</Link>}
      />
      <section className="card table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Reorder Level</th>
                <th>Unit Cost</th>
                <th>Stock Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const low = Number(row.stock) <= Number(row.reorderLevel);
                return (
                  <tr key={row.productId}>
                    <td>
                      <div className="table-primary">
                        <span className="table-icon cyan">
                          <Boxes size={19} />
                        </span>
                        <span>
                          <strong>{row.name}</strong>
                          <small>{row.sku}</small>
                        </span>
                      </div>
                    </td>
                    <td>{row.category || "—"}</td>
                    <td>
                      {Number(row.stock).toLocaleString()} {row.unit}
                    </td>
                    <td>{Number(row.reorderLevel).toLocaleString()}</td>
                    <td>{formatPKR(row.purchasePrice)}</td>
                    <td className="amount-cell">
                      {formatPKR(Number(row.stock) * Number(row.purchasePrice))}
                    </td>
                    <td>
                      <span className={`badge ${low ? "badge-danger" : "badge-success"}`}>
                        {low ? "Low stock" : "In stock"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="section-title-row"><h2 className="section-title">Inventory Movement History</h2><span className="muted-text">Latest {movements.length} movements</span></div>
      <section className="card table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Reference</th><th>Product</th><th>Warehouse</th><th>Movement</th><th>Quantity</th><th>Unit Cost</th><th>Date</th><th>Notes</th></tr></thead>
            <tbody>{movements.length ? movements.map((movement) => <tr key={movement.id}>
              <td>{movement.reference || "—"}</td><td><strong>{movement.productName}</strong><small className="cell-subtitle">{movement.sku}</small></td><td>{movement.warehouseName}</td><td><span className={`badge ${Number(movement.quantityDelta) >= 0 ? "badge-success" : "badge-danger"}`}>{movement.movementType.replaceAll("_", " ")}</span></td><td className={Number(movement.quantityDelta) >= 0 ? "positive" : "negative"}>{Number(movement.quantityDelta) > 0 ? "+" : ""}{Number(movement.quantityDelta).toLocaleString()}</td><td>{formatPKR(movement.unitCost ?? 0)}</td><td>{formatDate(movement.occurredAt)}</td><td>{movement.notes || "—"}</td>
            </tr>) : <tr><td className="table-empty" colSpan={8}>No inventory movements have been posted.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
