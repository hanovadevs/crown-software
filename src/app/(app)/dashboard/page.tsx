import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  DatabaseBackup,
  Layers,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, QuickCard, StatCard } from "@/components/ui";
import { getDashboardSummary, getStockManagerSummary } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatDate, formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  if (user.role === "inventory") {
    const stockSummary = await getStockManagerSummary();
    return (
      <main className="page">
        <PageHeader
          eyebrow="Inventory & Warehouse Portal"
          title="Stock Management Center"
          description={`Logged in as ${user.displayName} (Stock Manager) · Real-time inventory tracking & restock alerts`}
          action={
            <div className="card-actions">
              <Link className="button button-primary" href="/stock/adjust">
                <PackagePlus size={19} /> Adjust Stock
              </Link>
              <Link className="button button-secondary" href="/products/new">
                <Plus size={19} /> Add Product
              </Link>
            </div>
          }
        />

        <section className="stats-grid" aria-label="Stock Summary">
          <StatCard
            icon={Package}
            label="Total Products Tracked"
            value={String(stockSummary.totalProducts)}
            hint={`${stockSummary.finishedGoods} finished · ${stockSummary.rawMaterials} raw materials`}
            color="#4169f6"
          />
          <StatCard
            icon={AlertTriangle}
            label="Low Stock Restock Alerts"
            value={String(stockSummary.lowStockCount)}
            hint={stockSummary.lowStockCount > 0 ? "Requires immediate restock" : "All stock levels healthy"}
            color={stockSummary.lowStockCount > 0 ? "#ef3942" : "#18c77a"}
          />
          <StatCard
            icon={Boxes}
            label="Total Physical Stock Units"
            value={stockSummary.totalStockUnits.toLocaleString()}
            hint="Active factory inventory count"
            color="#13b8d3"
          />
          <StatCard
            icon={Layers}
            label="Inventory Cost Value"
            value={formatPKR(stockSummary.totalStockValue)}
            hint="Total cost valuation at purchase price"
            color="#ff950f"
          />
        </section>

        <div className="section-title-row">
          <h2 className="section-title">Stock Operations</h2>
        </div>
        <section className="quick-grid" aria-label="Stock Operations">
          <QuickCard
            href="/stock/adjust"
            icon={PackagePlus}
            title="Adjust Stock & Counts"
            description="Record physical counts, production output, scrap, and damage"
            color="#13b8d3"
          />
          <QuickCard
            href="/products/new"
            icon={Plus}
            title="Register Product SKU"
            description="Add a new Crown, SOLO, or raw material product"
            color="#4169f6"
          />
          <QuickCard
            href="/stock"
            icon={Boxes}
            title="Stock Movement History"
            description="Audit complete history of stock increases & decreases"
            color="#e65aa2"
          />
          <QuickCard
            href="/reports?type=stock"
            icon={ClipboardList}
            title="Inventory & Stock Reports"
            description="Generate stock reports, valuation, and restock lists"
            color="#ff950f"
          />
        </section>

        <section className="detail-layout" style={{ marginTop: "24px" }}>
          <article className="card panel">
            <div className="table-title">
              <h2><AlertTriangle size={20} color="#ff950f" /> Low-Stock Restock Queue</h2>
              <span className="badge badge-warning">{stockSummary.lowStockProducts.length} items needing restock</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product & SKU</th>
                    <th>Brand / Category</th>
                    <th>Current Stock</th>
                    <th>Reorder Level</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.lowStockProducts.length ? (
                    stockSummary.lowStockProducts.map((item) => {
                      const stockVal = Number(item.current_stock);
                      const reorderVal = Number(item.reorder_level);
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="table-primary">
                              <span className="table-icon cyan">
                                <Package size={18} />
                              </span>
                              <span>
                                <strong>{item.name}</strong>
                                <small>{item.sku}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <strong>{item.brand}</strong>
                            <small className="cell-subtitle">{item.category || "General"}</small>
                          </td>
                          <td>
                            <strong className={stockVal <= 0 ? "negative" : "warning-text"}>
                              {stockVal.toLocaleString()} {item.unit}
                            </strong>
                          </td>
                          <td>{reorderVal.toLocaleString()} {item.unit}</td>
                          <td>
                            <span className={`badge ${stockVal <= 0 ? "badge-danger" : "badge-warning"}`}>
                              {stockVal <= 0 ? "Out of stock" : "Low stock"}
                            </span>
                          </td>
                          <td>
                            <Link className="button button-secondary small-button" href="/stock/adjust">
                              Adjust
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        🎉 All inventory stock levels are healthy! No items need restocking.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card panel">
            <div className="table-title">
              <h2><PackageCheck size={20} color="#13b8d3" /> Recent Stock Movements</h2>
              <Link href="/stock" className="muted-text">View all →</Link>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Movement</th>
                    <th>Quantity</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.recentMovements.length ? (
                    stockSummary.recentMovements.map((movement) => {
                      const qty = Number(movement.quantityDelta);
                      return (
                        <tr key={movement.id}>
                          <td>
                            <strong>{movement.productName}</strong>
                            <small className="cell-subtitle">{movement.warehouseName}</small>
                          </td>
                          <td>
                            <span className="badge badge-primary">
                              {movement.movementType.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="amount-cell">
                            <strong className={qty > 0 ? "positive" : "negative"}>
                              {qty > 0 ? `+${qty.toLocaleString()}` : qty.toLocaleString()}
                            </strong>
                          </td>
                          <td>{formatDate(movement.occurredAt)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="table-empty">No stock movements recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>
    );
  }

  const summary = await getDashboardSummary();

  return (
    <main className="page">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Welcome to the Crown Accumulator management system"
      />

      <section className="stats-grid" aria-label="Business summary">
        <StatCard
          icon={WalletCards}
          label="Company balance"
          value={formatPKR(summary.companyBalance)}
          hint={summary.companyBalance >= 0 ? "Positive balance" : "Negative balance"}
          color="#4169f6"
        />
        <StatCard
          icon={TrendingUp}
          label="Total receivables"
          value={formatPKR(summary.receivables)}
          hint={`${summary.customers} customer${summary.customers === 1 ? "" : "s"}`}
          color="#18c77a"
        />
        <StatCard
          icon={TrendingDown}
          label="Total payables"
          value={formatPKR(summary.payables)}
          hint={`${summary.suppliers} supplier${summary.suppliers === 1 ? "" : "s"}`}
          color="#ef3942"
        />
        <StatCard
          icon={Boxes}
          label="Products"
          value={String(summary.products)}
          hint={summary.lowStock ? `${summary.lowStock} need restocking` : "Stock levels healthy"}
          color="#13b8d3"
        />
      </section>

      <div className="section-title-row">
        <h2 className="section-title">Quick actions</h2>
      </div>
      <section className="quick-grid" aria-label="Quick actions">
        <QuickCard
          href="/transactions/new"
          icon={Plus}
          title="New Transaction"
          description="Add a sale, purchase, or bank transaction"
          color="#4169f6"
        />
        <QuickCard
          href="/parties/new"
          icon={UserPlus}
          title="Add Party"
          description="Add a customer, supplier, or both"
          color="#18c77a"
        />
        <QuickCard
          href="/products/new"
          icon={PackagePlus}
          title="Add Product"
          description="Add a Crown or SOLO product to inventory"
          color="#e65aa2"
        />
        <QuickCard
          href="/workers"
          icon={UsersRound}
          title="Manage Workers"
          description={`${summary.activeWorkers} active · ${summary.payrollDue} payroll due this month`}
          color="#8754ec"
        />
        <QuickCard
          href="/stock/adjust"
          icon={PackagePlus}
          title="Adjust Stock"
          description="Record counts, damage, production, and corrections"
          color="#13b8d3"
        />
        <QuickCard
          href="/bills/new"
          icon={ReceiptText}
          title="Generate Bill"
          description="Create an invoice or customer quotation"
          color="#4169f6"
        />
        <QuickCard
          href="/reports"
          icon={ClipboardList}
          title="View Reports"
          description="Generate, print, and export business reports"
          color="#ff950f"
        />
        <QuickCard
          href="/settings/backup"
          icon={DatabaseBackup}
          title="Backup & Restore"
          description="Protect and restore your factory records"
          color="#ef3942"
        />
      </section>
    </main>
  );
}
