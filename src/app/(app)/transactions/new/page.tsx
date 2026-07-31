import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTransactionFormOptions } from "@/db/business-queries";
import { TransactionForm } from "./transaction-form";

export const metadata: Metadata = { title: "New Transaction" };

function todayInKarachi() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function NewTransactionPage() {
  const options = await getTransactionFormOptions();

  return (
    <main className="page form-page wide-form-page">
      <div className="back-title">
        <Link
          className="icon-button"
          href="/transactions"
          aria-label="Back to transactions"
        >
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="page-title">New Transaction</h1>
          <p className="page-description">
            Add a sale, purchase, receipt, payment, or bank transaction
          </p>
        </div>
      </div>
      <TransactionForm {...options} today={todayInKarachi()} />
    </main>
  );
}
