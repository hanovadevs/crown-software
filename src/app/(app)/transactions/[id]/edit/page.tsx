import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTransactionDetail, getTransactionFormOptions } from "@/db/business-queries";
import { TransactionForm } from "@/app/(app)/transactions/new/transaction-form";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getTransactionDetail(id);
  if (!item) notFound();
  if (item.status !== "posted" || item.type === "adjustment") redirect(`/transactions/${id}`);
  const editableItem = {
    id: item.id, version: item.version, number: item.number,
    type: item.type as Exclude<typeof item.type, "adjustment">,
    partyId: item.partyId, productId: item.productId, bankAccountId: item.bankAccountId,
    quantity: item.quantity, unitPrice: item.unitPrice, amount: item.amount,
    date: item.date, paymentMethod: item.paymentMethod,
    description: item.description, reference: item.reference,
  };
  const options = await getTransactionFormOptions(item);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return <main className="page form-page wide-form-page">
    <div className="back-title"><Link className="icon-button" href={`/transactions/${id}`} aria-label="Back to transaction"><ArrowLeft size={22} /></Link>
      <div><h1 className="page-title">Correct {item.number}</h1><p className="page-description">Edit amount, date, party, product, payment, and reference</p></div>
    </div>
    {item.linkedBillNumber
      ? <div className="card panel"><p>Invoice {item.linkedBillNumber} owns this sale. Cancel and reissue the invoice to correct its amount or stock.</p><Link href="/bills" className="button button-secondary">Open invoices</Link></div>
      : <TransactionForm {...options} today={today} initialItem={editableItem} />}
  </main>;
}
