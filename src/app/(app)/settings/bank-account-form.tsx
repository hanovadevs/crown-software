"use client";

import { Landmark } from "lucide-react";
import { useActionState } from "react";
import { createBankAccountAction } from "@/app/actions/bank-accounts";
import type { FormState } from "@/app/actions/business";

export function BankAccountForm() {
  const [state, action, pending] = useActionState(createBankAccountAction, {} as FormState);
  return (
    <form action={action} className="card panel settings-card">
      <div className="settings-heading">
        <span className="table-icon blue"><Landmark size={19} /></span>
        <div><h2>Add Bank Account</h2><p>Use the exact bank account for future receipts, payments, and account reports.</p></div>
      </div>
      <div className="field"><label htmlFor="bankAccountName">Account label</label><input className="input" id="bankAccountName" name="name" placeholder="e.g. HBL Current Account" required maxLength={160} /></div>
      <div className="field"><label htmlFor="bankName">Bank name</label><input className="input" id="bankName" name="bankName" required maxLength={160} /></div>
      <div className="field"><label htmlFor="accountNumber">Account number</label><input className="input" id="accountNumber" name="accountNumber" maxLength={120} /></div>
      <div className="field"><label htmlFor="iban">IBAN</label><input className="input" id="iban" name="iban" maxLength={64} /></div>
      <div className="field"><label htmlFor="openingBalance">Opening balance (PKR)</label><input className="input" id="openingBalance" name="openingBalance" type="number" step="0.01" defaultValue="0" required /></div>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      {state.success && <p role="status">Bank account added. It is now available in Transactions.</p>}
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Add Bank Account"}</button>
    </form>
  );
}
