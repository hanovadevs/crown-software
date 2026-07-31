"use client";

import { Building2, Mail, MapPin, Phone, Save, Truck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createPartyAction, updatePartyAction, type FormState } from "@/app/actions/business";

const initialState: FormState = {};

type PartyFormValue = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  openingReceivable: string;
  openingPayable: string;
};

export function PartyForm({ party }: { party?: PartyFormValue }) {
  const submitAction = party
    ? updatePartyAction.bind(null, party.id)
    : createPartyAction;
  const [state, action, pending] = useActionState(
    submitAction,
    initialState,
  );
  const [customer, setCustomer] = useState(party?.isCustomer ?? true);
  const [supplier, setSupplier] = useState(party?.isSupplier ?? false);
  const [name, setName] = useState(party?.name ?? "");

  return (
    <form action={action} className="card detail-form">
      <fieldset className="role-fieldset">
        <legend>Party Type *</legend>
        <div className="role-options">
          <label className={`role-option ${customer ? "selected customer" : ""}`}>
            <input
              checked={customer}
              name="isCustomer"
              onChange={(event) => setCustomer(event.target.checked)}
              type="checkbox"
            />
            <span className="role-icon customer">
              <Building2 size={21} />
            </span>
            <span>
              <strong>Customer</strong>
              <small>Buys products from Crown</small>
            </span>
          </label>
          <label className={`role-option ${supplier ? "selected supplier" : ""}`}>
            <input
              checked={supplier}
              name="isSupplier"
              onChange={(event) => setSupplier(event.target.checked)}
              type="checkbox"
            />
            <span className="role-icon supplier">
              <Truck size={21} />
            </span>
            <span>
              <strong>Supplier</strong>
              <small>Supplies materials or services</small>
            </span>
          </label>
        </div>
        {state.fieldErrors?.isCustomer?.[0] && (
          <p className="field-error">{state.fieldErrors.isCustomer[0]}</p>
        )}
      </fieldset>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Party Name *</label>
          <input
            className="input"
            id="name"
            name="name"
            defaultValue={party?.name ?? ""}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter party/company name"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <div className="input-wrap">
            <Mail className="input-icon" size={18} />
            <input
              className="input has-icon"
              id="email"
              name="email"
              defaultValue={party?.email ?? ""}
              placeholder="party@example.com"
              type="email"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="contactPerson">Contact Person</label>
          <input
            className="input"
            id="contactPerson"
            name="contactPerson"
            defaultValue={party?.contactPerson ?? ""}
            placeholder="Contact person name"
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <div className="input-wrap">
            <Phone className="input-icon" size={18} />
            <input
              className="input has-icon"
              id="phone"
              name="phone"
              defaultValue={party?.phone ?? ""}
              placeholder="0300-1234567"
            />
          </div>
        </div>
        <div className="field field-span-2">
          <label htmlFor="address">Address</label>
          <div className="input-wrap">
            <MapPin className="textarea-icon" size={18} />
            <textarea
              className="textarea has-textarea-icon"
              id="address"
              name="address"
              defaultValue={party?.address ?? ""}
              placeholder="Enter complete address…"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="taxNumber">NTN / Tax Number</label>
          <input
            className="input"
            id="taxNumber"
            name="taxNumber"
            defaultValue={party?.taxNumber ?? ""}
            placeholder="Optional"
          />
        </div>
        <div />
        {customer && (
          <div className="field">
            <label htmlFor="openingReceivable">Opening Receivable (PKR)</label>
            <input
              className="input"
              id="openingReceivable"
              min="0"
              name="openingReceivable"
              step="0.01"
              type="number"
              defaultValue={party?.openingReceivable ?? "0"}
            />
          </div>
        )}
        {supplier && (
          <div className="field">
            <label htmlFor="openingPayable">Opening Payable (PKR)</label>
            <input
              className="input"
              id="openingPayable"
              min="0"
              name="openingPayable"
              step="0.01"
              type="number"
              defaultValue={party?.openingPayable ?? "0"}
            />
          </div>
        )}
      </div>

      <aside className="form-summary">
        <h3>Party Summary</h3>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{name || "Not entered"}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>
              {customer && supplier
                ? "Customer & Supplier"
                : customer
                  ? "Customer"
                  : supplier
                    ? "Supplier"
                    : "Not selected"}
            </dd>
          </div>
        </dl>
      </aside>

      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}

      <div className="form-actions">
        <Link className="button button-secondary" href="/parties">
          Cancel
        </Link>
        <button className="button button-primary" disabled={pending} type="submit">
          <Save size={19} />
          {pending ? "Saving…" : party ? "Update Party" : "Save Party"}
        </button>
      </div>
    </form>
  );
}
