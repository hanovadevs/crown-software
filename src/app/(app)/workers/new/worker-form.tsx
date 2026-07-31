"use client";

import { Save } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { createWorkerAction, updateWorkerAction, type FormState } from "@/app/actions/business";

const initialState: FormState = {};

type WorkerValue = {
  id: string; workerCode: string; name: string; phone: string | null; address: string | null;
  nationalId: string | null; designation: string | null; monthlySalary: string; joiningDate: string;
};

export function WorkerForm({ today, worker }: { today: string; worker?: WorkerValue }) {
  const submitAction = worker ? updateWorkerAction.bind(null, worker.id) : createWorkerAction;
  const [state, action, pending] = useActionState(
    submitAction,
    initialState,
  );
  return (
    <form action={action} className="card detail-form">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="workerCode">Worker Code *</label>
          <input
            className="input"
            id="workerCode"
            name="workerCode"
            defaultValue={worker?.workerCode ?? ""}
            placeholder="e.g., WRK-001"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="name">Worker Name *</label>
          <input className="input" id="name" name="name" defaultValue={worker?.name ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="designation">Designation</label>
          <input
            className="input"
            id="designation"
            name="designation"
            defaultValue={worker?.designation ?? ""}
            placeholder="Assembler, storekeeper, supervisor…"
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input className="input" id="phone" name="phone" defaultValue={worker?.phone ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="nationalId">CNIC</label>
          <input className="input" id="nationalId" name="nationalId" defaultValue={worker?.nationalId ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="joiningDate">Joining Date *</label>
          <input
            className="input"
            defaultValue={worker?.joiningDate ?? today}
            id="joiningDate"
            name="joiningDate"
            type="date"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="monthlySalary">Monthly Salary (PKR)</label>
          <input
            className="input"
            defaultValue={worker?.monthlySalary ?? "0"}
            id="monthlySalary"
            min="0"
            name="monthlySalary"
            step="0.01"
            type="number"
          />
        </div>
        <div className="field field-span-2">
          <label htmlFor="address">Address</label>
          <textarea className="textarea" id="address" name="address" defaultValue={worker?.address ?? ""} />
        </div>
      </div>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="form-actions">
        <Link className="button button-secondary" href="/workers">
          Cancel
        </Link>
        <button className="button button-primary" disabled={pending} type="submit">
          <Save size={19} /> {pending ? "Saving…" : worker ? "Update Worker" : "Save Worker"}
        </button>
      </div>
    </form>
  );
}
