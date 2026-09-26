"use client";

import { useActionState } from "react";
import { assignLegacyBankAccountAction } from "@/app/actions/bank-accounts";
import type { FormState } from "@/app/actions/business";

export function LegacyBankAssignment({ transactionId, accounts }: {
  transactionId: string;
  accounts: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    assignLegacyBankAccountAction.bind(null, transactionId), {} as FormState,
  );
  return <form action={action}>
    <div className="field"><label htmlFor={`legacy-bank-${transactionId}`}>Actual bank account</label>
      <select className="select" id={`legacy-bank-${transactionId}`} name="bankAccountId" required>
        <option value="">Select account</option>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
    </div>
    {state.error && <div className="form-error" role="alert">{state.error}</div>}
    {state.success && <p role="status">Account assigned.</p>}
    <button className="button button-secondary" type="submit" disabled={pending || !accounts.length}>{pending ? "Saving…" : "Assign Account"}</button>
  </form>;
}
