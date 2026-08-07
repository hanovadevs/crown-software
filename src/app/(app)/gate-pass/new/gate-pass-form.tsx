"use client";

import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { createGatePassAction } from "@/app/actions/gate-pass";
import type { FormState } from "@/app/actions/business";

type ProductOption = { id: string; name: string; sku: string; unit: string };
type PartyOption = { id: string; name: string };
type GatePassItem = {
  key: number;
  productId: string;
  description: string;
  quantity: string;
  unit: string;
  remarks: string;
};

const initialState: FormState = {};

export function GatePassForm({
  parties,
  products,
  today,
}: {
  parties: PartyOption[];
  products: ProductOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createGatePassAction, initialState);
  const nextKey = useRef(2);
  const [direction, setDirection] = useState<"inward" | "outward">("outward");
  const [isReturnable, setIsReturnable] = useState(false);
  const [items, setItems] = useState<GatePassItem[]>([
    { key: 1, productId: "", description: "", quantity: "1", unit: "pcs", remarks: "" },
  ]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        productId: "",
        description: "",
        quantity: "1",
        unit: "pcs",
        remarks: "",
      },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  }

  function updateItem(key: number, field: keyof GatePassItem, value: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const updated = { ...item, [field]: value };
        if (field === "productId" && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            updated.description = product.name;
            updated.unit = product.unit;
          }
        }
        return updated;
      }),
    );
  }

  const itemsJson = JSON.stringify(
    items.map((i) => ({
      productId: i.productId || null,
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      remarks: i.remarks,
    })),
  );

  return (
    <form className="card form-card gate-pass-form" action={action}>
      {state.error && (
        <div className="alert alert-danger" role="alert">
          {state.error}
        </div>
      )}

      <input type="hidden" name="itemsJson" value={itemsJson} />

      {/* Direction Toggle */}
      <fieldset className="form-section">
        <legend className="form-legend">Direction</legend>
        <div className="direction-toggle">
          <button
            type="button"
            className={`direction-btn ${direction === "inward" ? "active inward" : ""}`}
            onClick={() => setDirection("inward")}
          >
            <ArrowDownLeft size={20} /> Inward
          </button>
          <button
            type="button"
            className={`direction-btn ${direction === "outward" ? "active outward" : ""}`}
            onClick={() => setDirection("outward")}
          >
            <ArrowUpRight size={20} /> Outward
          </button>
        </div>
        <input type="hidden" name="direction" value={direction} />
      </fieldset>

      {/* Basic Info */}
      <fieldset className="form-section">
        <legend className="form-legend">Gate Pass Details</legend>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Party (Optional)</span>
            <select className="input" name="partyId">
              <option value="">— No Party —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Date</span>
            <input className="input" type="date" name="gatePassDate" defaultValue={today} required />
          </label>
          <label className="field">
            <span className="field-label">Vehicle Number</span>
            <input className="input" type="text" name="vehicleNumber" placeholder="e.g. LEA-1234" />
          </label>
          <label className="field">
            <span className="field-label">Driver Name</span>
            <input className="input" type="text" name="driverName" placeholder="Driver's full name" />
          </label>
          <label className="field">
            <span className="field-label">Driver Phone</span>
            <input className="input" type="text" name="driverPhone" placeholder="03XX-XXXXXXX" />
          </label>
          <label className="field">
            <span className="field-label">Gate Keeper</span>
            <input className="input" type="text" name="gateKeeperName" placeholder="Gate keeper name" />
          </label>
        </div>
      </fieldset>

      {/* Returnable */}
      <fieldset className="form-section">
        <legend className="form-legend">Return Status</legend>
        <div className="form-grid">
          <label className="field checkbox-field">
            <input
              type="checkbox"
              name="isReturnable"
              checked={isReturnable}
              onChange={(e) => setIsReturnable(e.target.checked)}
            />
            <span>Returnable items</span>
          </label>
          {isReturnable && (
            <label className="field">
              <span className="field-label">Expected Return Date</span>
              <input className="input" type="date" name="expectedReturnDate" />
            </label>
          )}
        </div>
      </fieldset>

      {/* Items */}
      <fieldset className="form-section">
        <legend className="form-legend">
          Items / Materials
          <button type="button" className="button button-secondary small-button" onClick={addItem}>
            <Plus size={16} /> Add Item
          </button>
        </legend>
        <div className="gp-items-list">
          {items.map((item, idx) => (
            <div className="gp-item-row" key={item.key}>
              <span className="gp-item-number">{idx + 1}</span>
              <select
                className="input"
                value={item.productId}
                onChange={(e) => updateItem(item.key, "productId", e.target.value)}
              >
                <option value="">— Free Text —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="text"
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(item.key, "description", e.target.value)}
                required
              />
              <input
                className="input gp-qty-input"
                type="number"
                placeholder="Qty"
                step="any"
                min="0.001"
                value={item.quantity}
                onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
                required
              />
              <input
                className="input gp-unit-input"
                type="text"
                placeholder="Unit"
                value={item.unit}
                onChange={(e) => updateItem(item.key, "unit", e.target.value)}
                required
              />
              <input
                className="input"
                type="text"
                placeholder="Remarks"
                value={item.remarks}
                onChange={(e) => updateItem(item.key, "remarks", e.target.value)}
              />
              <button
                type="button"
                className="icon-button danger-icon"
                onClick={() => removeItem(item.key)}
                title="Remove item"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Signatures & Notes */}
      <fieldset className="form-section">
        <legend className="form-legend">Authorization</legend>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Authorized By</span>
            <input className="input" type="text" name="authorizedBy" placeholder="Authorized person name" />
          </label>
          <label className="field">
            <span className="field-label">Received By</span>
            <input className="input" type="text" name="receivedBy" placeholder="Receiver name" />
          </label>
        </div>
        <label className="field" style={{ marginTop: "12px" }}>
          <span className="field-label">Remarks / Notes</span>
          <textarea className="input textarea" name="remarks" rows={3} placeholder="Additional notes…" />
        </label>
      </fieldset>

      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create Gate Pass"}
        </button>
      </div>
    </form>
  );
}
