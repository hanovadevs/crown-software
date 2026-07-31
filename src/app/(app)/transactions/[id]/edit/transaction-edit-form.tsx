"use client";

import { Calculator, Save } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { updateTransactionAction, type FormState } from "@/app/actions/business";
import { formatPKR } from "@/lib/utils";

type Value = {
  id: string; number: string; type: string; description: string; reference: string | null;
  quantity: string | null; unitPrice: string | null; amount: string; date: string;
  partyName: string | null; productName: string | null; bankName: string | null;
};

export function TransactionEditForm({ item }: { item: Value }) {
  const [state, action, pending] = useActionState(updateTransactionAction.bind(null, item.id), {} as FormState);
  const [quantity, setQuantity] = useState(item.quantity ?? "0");
  const [unitPrice, setUnitPrice] = useState(item.unitPrice ?? "0");
  const [amount, setAmount] = useState(item.amount);
  const hasProduct = Boolean(item.productName);
  const recalculate = (qty: string, price: string) => setAmount(((Number(qty) || 0) * (Number(price) || 0)).toFixed(2));
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
        <p className="field-help">Identity fields stay locked so the audit trail remains trustworthy. Amount, quantity, stock, balances, and journal entries update together.</p>
      </aside>
      <div className="form-grid">
        {hasProduct && <>
          <div className="field"><label htmlFor="quantity">Quantity *</label><input className="input" id="quantity" name="quantity" min="0.001" step="0.001" type="number" value={quantity} onChange={(event) => { setQuantity(event.target.value); recalculate(event.target.value, unitPrice); }} required /></div>
          <div className="field"><label htmlFor="unitPrice">Unit Price (PKR) *</label><input className="input" id="unitPrice" name="unitPrice" min="0" step="0.01" type="number" value={unitPrice} onChange={(event) => { setUnitPrice(event.target.value); recalculate(quantity, event.target.value); }} required /></div>
        </>}
        <div className="field"><label htmlFor="totalAmount">Total Amount (PKR) *</label><div className="input-wrap"><Calculator className="input-icon" size={18} /><input className="input has-icon" id="totalAmount" name="totalAmount" min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><small className="field-help">Current total: {formatPKR(amount)}</small></div>
        <div className="field"><label htmlFor="transactionDate">Date *</label><input className="input" id="transactionDate" name="transactionDate" type="date" defaultValue={item.date} required /></div>
        <div className="field field-span-2"><label htmlFor="description">Description *</label><textarea className="textarea" id="description" name="description" defaultValue={item.description} required /></div>
        <div className="field field-span-2"><label htmlFor="reference">Reference</label><input className="input" id="reference" name="reference" defaultValue={item.reference ?? ""} /></div>
      </div>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      <div className="form-actions"><Link className="button button-secondary" href={`/transactions/${item.id}`}>Cancel</Link><button className="button button-primary" disabled={pending} type="submit"><Save size={18} />{pending ? "Updating…" : "Update Transaction"}</button></div>
    </form>
  );
}
