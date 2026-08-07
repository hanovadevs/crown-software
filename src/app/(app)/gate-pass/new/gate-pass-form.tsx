"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ClipboardCheck,
  FileCheck,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  UserCheck,
  User,
  Phone,
} from "lucide-react";
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
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
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

  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const selectedParty = parties.find((p) => p.id === selectedPartyId);

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
    <form className="billing-layout" action={action}>
      <div className="billing-main">
        <input type="hidden" name="itemsJson" value={itemsJson} />
        <input type="hidden" name="direction" value={direction} />

        {state.error && (
          <div className="alert alert-danger" role="alert">
            {state.error}
          </div>
        )}

        {/* Direction & Main Info Card */}
        <section className="card detail-form">
          <div className="form-section-heading">
            <ClipboardCheck size={24} />
            <h2>Gate Pass Challan Details</h2>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <span className="field-label" style={{ display: "block", marginBottom: "8px" }}>
              Movement Direction *
            </span>
            <div className="direction-toggle">
              <button
                type="button"
                className={`direction-btn ${direction === "inward" ? "active inward" : ""}`}
                onClick={() => setDirection("inward")}
              >
                <ArrowDownLeft size={20} /> Inward Gate Pass (Receiving)
              </button>
              <button
                type="button"
                className={`direction-btn ${direction === "outward" ? "active outward" : ""}`}
                onClick={() => setDirection("outward")}
              >
                <ArrowUpRight size={20} /> Outward Gate Pass (Dispatch)
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="partyId">Party / Customer / Supplier (Optional)</label>
              <select
                className="select"
                id="partyId"
                name="partyId"
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
              >
                <option value="">— No Associated Party —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="gatePassDate">Challan Date *</label>
              <input
                className="input"
                id="gatePassDate"
                name="gatePassDate"
                type="date"
                defaultValue={today}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="vehicleNumber">Vehicle Number</label>
              <input
                className="input"
                id="vehicleNumber"
                name="vehicleNumber"
                type="text"
                placeholder="e.g. LEA-1234 / Truck No."
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="driverName">Driver Name</label>
              <input
                className="input"
                id="driverName"
                name="driverName"
                type="text"
                placeholder="Driver's full name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="driverPhone">Driver Phone</label>
              <input
                className="input"
                id="driverPhone"
                name="driverPhone"
                type="text"
                placeholder="03XX-XXXXXXX"
              />
            </div>

            <div className="field">
              <label htmlFor="gateKeeperName">Gate Keeper Name</label>
              <input
                className="input"
                id="gateKeeperName"
                name="gateKeeperName"
                type="text"
                placeholder="Duty gatekeeper name"
              />
            </div>
          </div>
        </section>

        {/* Returnable Items Status */}
        <section className="card detail-form">
          <div className="form-section-heading">
            <Calendar size={22} />
            <h2>Returnable Material Tracking</h2>
          </div>
          <div className="form-grid">
            <div className="field field-span-2">
              <label className="checkbox-row" style={{ marginTop: 0 }}>
                <input
                  type="checkbox"
                  name="isReturnable"
                  checked={isReturnable}
                  onChange={(e) => setIsReturnable(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>
                  This Gate Pass contains returnable items/containers (e.g. Empty Drums, Moulds, Equipment)
                </span>
              </label>
            </div>
            {isReturnable && (
              <div className="field">
                <label htmlFor="expectedReturnDate">Expected Return Date</label>
                <input className="input" id="expectedReturnDate" name="expectedReturnDate" type="date" />
              </div>
            )}
          </div>
        </section>

        {/* Items Card */}
        <section className="card detail-form bill-items-card">
          <div className="bill-items-header">
            <div className="form-section-heading">
              <Package size={24} />
              <h2>Materials & Line Items</h2>
            </div>
            <button className="button button-primary" onClick={addItem} type="button">
              <Plus size={19} /> Add Item Row
            </button>
          </div>

          <div className="bill-items">
            {items.map((item, index) => (
              <article className="bill-item" key={item.key}>
                <div className="bill-item-title">
                  <strong>Item #{index + 1}</strong>
                  {items.length > 1 && (
                    <button
                      className="small-icon-button danger-icon"
                      onClick={() => removeItem(item.key)}
                      type="button"
                      title="Remove item"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Product (Optional Selection)</label>
                    <select
                      className="select"
                      value={item.productId}
                      onChange={(e) => updateItem(item.key, "productId", e.target.value)}
                    >
                      <option value="">— Custom Material / Free Text —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Description / Item Name *</label>
                    <input
                      className="input"
                      placeholder="Item description, specifications..."
                      value={item.description}
                      onChange={(e) => updateItem(item.key, "description", e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Quantity *</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="Qty"
                      step="any"
                      min="0.001"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Unit (e.g. Pcs, Kgs, Bags) *</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="pcs, kgs, boxes..."
                      value={item.unit}
                      onChange={(e) => updateItem(item.key, "unit", e.target.value)}
                      required
                    />
                  </div>

                  <div className="field field-span-2">
                    <label>Item Remarks / Serial # (Optional)</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="Batch #, condition, serial number..."
                      value={item.remarks}
                      onChange={(e) => updateItem(item.key, "remarks", e.target.value)}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Signatures & Notes */}
        <section className="card detail-form">
          <div className="form-section-heading">
            <ShieldCheck size={22} />
            <h2>Authorization & Handover Signatures</h2>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="authorizedBy">Authorized By</label>
              <input
                className="input"
                id="authorizedBy"
                name="authorizedBy"
                type="text"
                placeholder="Manager / Supervisor Name"
              />
            </div>

            <div className="field">
              <label htmlFor="receivedBy">Received By</label>
              <input
                className="input"
                id="receivedBy"
                name="receivedBy"
                type="text"
                placeholder="Receiver / Driver Signature Name"
              />
            </div>

            <div className="field field-span-2">
              <label htmlFor="remarks">Additional Gate Pass Notes</label>
              <textarea
                className="textarea"
                id="remarks"
                name="remarks"
                rows={3}
                placeholder="Special delivery instructions, seal numbers, safety notes..."
              />
            </div>
          </div>
        </section>
      </div>

      {/* Sticky Right Side Summary Deck */}
      <aside className="billing-sidebar">
        <div className="card bill-summary-card">
          <h2>Gate Pass Summary</h2>
          <dl>
            <div>
              <dt>Type:</dt>
              <dd>
                <span
                  className={`badge ${direction === "inward" ? "badge-success" : "badge-warning"}`}
                  style={{ textTransform: "uppercase", fontWeight: 700 }}
                >
                  {direction === "inward" ? "↓ Inward Pass" : "↑ Outward Pass"}
                </span>
              </dd>
            </div>
            <div>
              <dt>Party:</dt>
              <dd style={{ fontWeight: 600 }}>{selectedParty ? selectedParty.name : "— Direct —"}</dd>
            </div>
            <div>
              <dt>Total Line Items:</dt>
              <dd>
                <strong>{items.length} Items</strong>
              </dd>
            </div>
            <div>
              <dt>Total Quantity Sum:</dt>
              <dd>
                <strong>{totalQuantity} Units</strong>
              </dd>
            </div>
            <div>
              <dt>Vehicle #:</dt>
              <dd>{vehicleNumber || "—"}</dd>
            </div>
            <div>
              <dt>Driver:</dt>
              <dd>{driverName || "—"}</dd>
            </div>
            {isReturnable && (
              <div>
                <dt>Returnable:</dt>
                <dd>
                  <span className="badge badge-primary">Return Tracking On</span>
                </dd>
              </div>
            )}
          </dl>

          <button className="button button-primary bill-submit" type="submit" disabled={pending}>
            {pending ? "Generating Gate Pass..." : "Create & Print Gate Pass"}
          </button>
        </div>

        <div className="card quick-tips">
          <h2>Quick Tips</h2>
          <p>
            • <strong>Inward Passes</strong> track materials arriving at the factory (e.g. Lead, Plates, Separators).
          </p>
          <p>
            • <strong>Outward Passes</strong> authorize goods dispatched out of the factory gate.
          </p>
          <p>
            • Every Gate Pass receives an official auto-incremented challan number (e.g. <code>GP-2026-00001</code>).
          </p>
        </div>
      </aside>
    </form>
  );
}
