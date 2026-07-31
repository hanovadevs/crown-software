import {
  Boxes,
  ClipboardList,
  DatabaseBackup,
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
import { PageHeader, QuickCard, StatCard } from "@/components/ui";
import { getDashboardSummary } from "@/db/queries";
import { formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
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
