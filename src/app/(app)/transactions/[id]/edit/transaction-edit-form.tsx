"use client";

import { Calculator, Save } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { updateTransactionAction, type FormState } from "@/app/actions/business";
import { formatPKR } from "@/lib/utils";

type Value = {
  id: string; number: string; type: string; description: string; reference: string | null;
  quantity: string | null; unitPrice: string | null; amount: string; date: string;
  partyName: string | null; productName: string | null; bankName: string | null;
};

export function TransactionEditForm({ item }: { item: Value }) {
  const [state, action, pending] = useActionState(updateTransactionAction.bind(null, item.id), {} as FormState);
  const hasProduct = Boolean(item.productName);
  return (
    <form action={action} className="card transaction-form">
      <aside className="summary-box transaction-edit-identity">
        <h3>Transaction identity</h3>
        <dl>
          <div><dt>Number</dt><dd>{item.number}</dd></div>
          <div><dt>Type</dt><dd>{item.type.replaceAll("_", " ")}</dd></div>
          <div><dt>Party / Account</dt><dd>{item.partyName || item.bankName || "—"}</dd></div>
          <div><dt>Product</dt><dd>{item.productName || "Custom transaction"}</dd></div>
        </dl>
        <p className="field-help">Financial fields are locked to preserve the original journal and stock history. Reverse this transaction and record a new one to correct amounts or dates.</p>
      </aside>
      <div className="form-grid">
        {hasProduct && <>
          <div className="field"><label htmlFor="quantity">Quantity *</label><input className="input" id="quantity" name="quantity" type="text" value={item.quantity ?? "0"} readOnly /></div>
          <div className="field"><label htmlFor="unitPrice">Unit Price (PKR) *</label><input className="input" id="unitPrice" name="unitPrice" type="text" value={item.unitPrice ?? "0"} readOnly /></div>
        </>}
        <div className="field"><label htmlFor="totalAmount">Total Amount (PKR) *</label><div className="input-wrap"><Calculator className="input-icon" size={18} /><input className="input has-icon" id="totalAmount" name="totalAmount" type="text" value={item.amount} readOnly required /></div><small className="field-help">Current total: {formatPKR(item.amount)}</small></div>
        <div className="field"><label htmlFor="transactionDate">Date *</label><input className="input" id="transactionDate" name="transactionDate" type="date" defaultValue={item.date} readOnly required /></div>
        <div className="field field-span-2"><label htmlFor="description">Description *</label><textarea className="textarea" id="description" name="description" defaultValue={item.description} required /></div>
        <div className="field field-span-2"><label htmlFor="reference">Reference</label><input className="input" id="reference" name="reference" defaultValue={item.reference ?? ""} /></div>
      </div>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      <div className="form-actions"><Link className="button button-secondary" href={`/transactions/${item.id}`}>Cancel</Link><button className="button button-primary" disabled={pending} type="submit"><Save size={18} />{pending ? "Updating…" : "Save Details"}</button></div>
    </form>
  );
}
