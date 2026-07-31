import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTransactionDetail } from "@/db/business-queries";
import { TransactionEditForm } from "./transaction-edit-form";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getTransactionDetail(id);
  if (!item) notFound();
  return <main className="page form-page wide-form-page"><div className="back-title"><Link className="icon-button" href={`/transactions/${id}`} aria-label="Back to transaction"><ArrowLeft size={22} /></Link><div><h1 className="page-title">Edit Transaction</h1><p className="page-description">Update the posted record and all connected balances</p></div></div><TransactionEditForm item={item} /></main>;
}
