"use client";

import { Save } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveWorkerPaymentAction, type OperationFormState } from "@/app/actions/operations";
import { formatPKR } from "@/lib/utils";

type WorkerOption = { id: string; code: string; name: string; monthlySalary: string };

export function WorkerPaymentForm({ workers, today, initialWorkerId }: { workers: WorkerOption[]; today: string; initialWorkerId?: string }) {
  const firstId = workers.some((worker) => worker.id === initialWorkerId) ? initialWorkerId! : workers[0]?.id ?? "";
  const [state, action, pending] = useActionState(saveWorkerPaymentAction, {} as OperationFormState);
  const [workerId, setWorkerId] = useState(firstId);
  const selected = useMemo(() => workers.find((worker) => worker.id === workerId), [workers, workerId]);
  const [gross, setGross] = useState(selected?.monthlySalary ?? "0");
  const [advance, setAdvance] = useState("0");
  const [deduction, setDeduction] = useState("0");
  const [paid, setPaid] = useState(selected?.monthlySalary ?? "0");
  const net = Math.max(0, Number(gross || 0) - Number(advance || 0) - Number(deduction || 0));
  function changeWorker(id: string) {
    setWorkerId(id);
    const worker = workers.find((item) => item.id === id);
    const salary = worker?.monthlySalary ?? "0";
    setGross(salary);
    setPaid(salary);
    setAdvance("0");
    setDeduction("0");
  }
  return <form action={action} className="card detail-form">
    <div className="form-grid">
      <div className="field field-span-2"><label htmlFor="workerId">Worker *</label><select className="select" id="workerId" name="workerId" value={workerId} onChange={(event) => changeWorker(event.target.value)} required>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name} · {worker.code}</option>)}</select></div>
      <div className="field"><label htmlFor="salaryMonth">Salary Month *</label><input className="input" id="salaryMonth" name="salaryMonth" type="month" defaultValue={today.slice(0, 7)} required /></div>
      <div className="field"><label htmlFor="grossAmount">Gross Salary (PKR) *</label><input className="input" id="grossAmount" name="grossAmount" min="0" step="0.01" type="number" value={gross} onChange={(event) => setGross(event.target.value)} required /></div>
      <div className="field"><label htmlFor="advanceAmount">Advance Applied</label><input className="input" id="advanceAmount" name="advanceAmount" min="0" step="0.01" type="number" value={advance} onChange={(event) => setAdvance(event.target.value)} /></div>
      <div className="field"><label htmlFor="deductionAmount">Deductions</label><input className="input" id="deductionAmount" name="deductionAmount" min="0" step="0.01" type="number" value={deduction} onChange={(event) => setDeduction(event.target.value)} /></div>
      <div className="field"><label htmlFor="paidAmount">Amount Paid *</label><input className="input" id="paidAmount" name="paidAmount" min="0" max={net} step="0.01" type="number" value={paid} onChange={(event) => setPaid(event.target.value)} required /></div>
      <div className="field"><label htmlFor="paidDate">Payment Date</label><input className="input" id="paidDate" name="paidDate" type="date" defaultValue={today} /></div>
      <div className="field field-span-2"><label htmlFor="notes">Notes</label><textarea className="textarea" id="notes" name="notes" placeholder="Overtime, leave deductions, advance details…" /></div>
    </div>
    <aside className="form-summary"><h3>Payment Summary</h3><dl><div><dt>Gross</dt><dd>{formatPKR(gross)}</dd></div><div><dt>Advance + deductions</dt><dd>{formatPKR(Number(advance || 0) + Number(deduction || 0))}</dd></div><div><dt>Net payable</dt><dd>{formatPKR(net)}</dd></div><div><dt>Payment status</dt><dd>{Number(paid || 0) === 0 ? "Pending" : Number(paid) < net ? "Partial" : "Paid"}</dd></div></dl></aside>
    {state.error && <div className="form-error" role="alert">{state.error}</div>}
    <div className="form-actions"><Link className="button button-secondary" href="/workers">Cancel</Link><button className="button button-primary" disabled={pending || !workers.length} type="submit"><Save size={18} />{pending ? "Posting…" : "Save Payment"}</button></div>
  </form>;
}
