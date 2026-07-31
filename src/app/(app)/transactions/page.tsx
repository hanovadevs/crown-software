import {
  ArrowDownLeft,
  ArrowUpRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Eye,
  Pencil,
  Plus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listParties, listTransactions } from "@/db/business-queries";
import { formatDate, formatPKR } from "@/lib/utils";
import { deleteTransactionAction } from "@/app/actions/business";
import { DeleteButton } from "@/components/delete-button";

export const metadata: Metadata = { title: "Transactions" };

const typePresentation = {
  sale: { label: "Sale", icon: ArrowUpRight, color: "green" },
  purchase: { label: "Purchase", icon: ArrowDownLeft, color: "blue" },
  bank_deposit: { label: "Bank Deposit", icon: BanknoteArrowDown, color: "cyan" },
  bank_withdrawal: {
    label: "Bank Withdrawal",
    icon: BanknoteArrowUp,
    color: "red",
  },
  customer_receipt: {
    label: "Customer Receipt",
    icon: BanknoteArrowDown,
    color: "green",
  },
  supplier_payment: {
    label: "Supplier Payment",
    icon: BanknoteArrowUp,
    color: "orange",
  },
  adjustment: { label: "Adjustment", icon: ArrowUpRight, color: "purple" },
} as const;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; party?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = params.type ?? "all";
  const party = params.party ?? "all";
  const [items, partyOptions] = await Promise.all([
    listTransactions(q, type, party),
    listParties(),
  ]);

  return (
    <main className="page">
      <PageHeader
        title="Transactions"
        description="Manage sales, purchases, receipts, payments, and bank activity"
        action={
          <Link className="button button-primary" href="/transactions/new">
            <Plus size={20} /> New Transaction
          </Link>
        }
      />

      <form className="card filter-bar transactions-filter" method="get">
        <div className="search-field">
          <span className="search-field-icon">⌕</span>
          <input
            className="input"
            defaultValue={q}
            name="q"
            placeholder="Search by description, party, product, bank, or number…"
            aria-label="Search transactions"
          />
        </div>
        <select className="select filter-select" defaultValue={type} name="type">
          <option value="all">All Types</option>
          <option value="sale">Sales</option>
          <option value="purchase">Purchases</option>
          <option value="customer_receipt">Customer Receipts</option>
          <option value="supplier_payment">Supplier Payments</option>
          <option value="bank_deposit">Bank Deposits</option>
          <option value="bank_withdrawal">Bank Withdrawals</option>
        </select>
        <select className="select filter-select" defaultValue={party} name="party">
          <option value="all">All Parties</option>
          {partyOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <button className="button button-secondary filter-button" type="submit">
          Filter
        </button>
      </form>

      <section className="card table-card">
        <div className="table-scroll">
          <table className="data-table transactions-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Party / Bank</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item) => {
                  const presentation = typePresentation[item.type];
                  const Icon = presentation.icon;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="table-primary">
                          <span className={`table-icon ${presentation.color}`}>
                            <Icon size={19} />
                          </span>
                          <span>
                            <strong>{item.description}</strong>
                            <small>
                              {presentation.label} · {item.number}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>{item.partyName || item.bankName || "—"}</td>
                      <td>
                        {item.productName ? (
                          <>
                            <strong>{item.productName}</strong>
                            <small className="cell-subtitle">
                              Qty: {Number(item.quantity).toLocaleString()} @{" "}
                              {formatPKR(item.unitPrice)}
                            </small>
                          </>
                        ) : (
                          <span className="muted-text">Custom transaction</span>
                        )}
                      </td>
                      <td className="amount-cell">{formatPKR(item.amount)}</td>
                      <td>{formatDate(item.date)}</td>
                      <td>
                        <div className="card-actions">
                          <Link
                            className="small-icon-button"
                            href={`/transactions/${item.id}`}
                            aria-label={`View ${item.number}`}
                          >
                            <Eye size={18} />
                          </Link>
                          <Link
                            className="small-icon-button"
                            href={`/transactions/${item.id}/edit`}
                            aria-label={`Edit ${item.number}`}
                          >
                            <Pencil size={17} />
                          </Link>
                          <DeleteButton
                            action={deleteTransactionAction.bind(null, item.id)}
                            confirmMessage={`Delete ${item.number}? Stock, balances, and journal entries will be updated globally.`}
                            label={`Delete ${item.number}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    No transactions match these filters.
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
