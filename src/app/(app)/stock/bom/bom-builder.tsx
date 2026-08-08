"use client";

import { Layers, Plus, Trash2, Zap } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/app/actions/business";
import { saveBomAction } from "@/app/actions/bom";

type ProductOption = { id: string; name: string; sku: string; unit: string };
type BomItemRow = { key: number; materialProductId: string; quantity: string; expectedWastePercent: string };

const initialState: FormState = {};

export function BomBuilder({
  finishedProducts,
  subProducts,
}: {
  finishedProducts: ProductOption[];
  subProducts: ProductOption[];
}) {
  const [state, action, pending] = useActionState(saveBomAction, initialState);
  const nextKey = useRef(2);

  const [finishedProductId, setFinishedProductId] = useState("");
  const [code, setCode] = useState("");
  const [outputQuantity, setOutputQuantity] = useState("1");
  const [items, setItems] = useState<BomItemRow[]>([
    { key: 1, materialProductId: "", quantity: "1", expectedWastePercent: "0" },
  ]);

  function handleFinishedGoodChange(prodId: string) {
    setFinishedProductId(prodId);
    const prod = finishedProducts.find((p) => p.id === prodId);
    if (prod && !code) {
      setCode(`BOM-${prod.sku}`);
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: nextKey.current++, materialProductId: "", quantity: "1", expectedWastePercent: "0" },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  }

  function updateItem(key: number, field: keyof BomItemRow, value: string) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)),
    );
  }

  const itemsJson = JSON.stringify(
    items.map((i) => ({
      materialProductId: i.materialProductId,
      quantity: i.quantity,
      expectedWastePercent: i.expectedWastePercent,
    })),
  );

  return (
    <form className="card form-card detail-form" action={action}>
      <div className="form-section-heading">
        <Layers size={24} strokeWidth={1.8} />
        <h2>Bill of Materials (BOM Assembly Recipe)</h2>
      </div>

      {state.error && (
        <div className="alert alert-danger" role="alert">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="alert alert-success" role="alert">
          BOM Assembly Recipe saved successfully!
        </div>
      )}

      <input type="hidden" name="itemsJson" value={itemsJson} />

      <div className="form-grid">
        <div className="field">
          <label htmlFor="finishedProductId">Finished Battery Product (Main Output) *</label>
          <select
            className="select"
            id="finishedProductId"
            name="finishedProductId"
            value={finishedProductId}
            onChange={(e) => handleFinishedGoodChange(e.target.value)}
            required
          >
            <option value="">— Select Finished Product —</option>
            {finishedProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="code">BOM Recipe Code *</label>
          <input
            className="input"
            id="code"
            name="code"
            type="text"
            placeholder="e.g. BOM-CROWN-100AH"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="outputQuantity">Batch Output Quantity (Units) *</label>
          <input
            className="input"
            id="outputQuantity"
            name="outputQuantity"
            type="number"
            min="1"
            value={outputQuantity}
            onChange={(e) => setOutputQuantity(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Components Sub-Products Section */}
      <div style={{ marginTop: "24px" }}>
        <div className="bill-items-header" style={{ marginBottom: "16px" }}>
          <h3>Sub-Products / Component Ingredients Required</h3>
          <button className="button button-secondary small-button" onClick={addItem} type="button">
            <Plus size={16} /> Add Component
          </button>
        </div>

        <div className="bill-items">
          {items.map((item, idx) => {
            const selectedMat = subProducts.find((p) => p.id === item.materialProductId);
            return (
              <div className="bill-item" key={item.key}>
                <div className="bill-item-title">
                  <strong>Component #{idx + 1}</strong>
                  {items.length > 1 && (
                    <button
                      className="small-icon-button danger-icon"
                      onClick={() => removeItem(item.key)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="field field-span-2">
                    <label>Sub-Product / Material *</label>
                    <select
                      className="select"
                      value={item.materialProductId}
                      onChange={(e) => updateItem(item.key, "materialProductId", e.target.value)}
                      required
                    >
                      <option value="">— Select Component Sub-Product —</option>
                      {subProducts.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name} ({sp.sku}) [{sp.unit}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Qty per Batch ({selectedMat ? selectedMat.unit : "Unit"}) *</label>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      min="0.001"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Expected Scrap/Waste %</label>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0%"
                      value={item.expectedWastePercent}
                      onChange={(e) => updateItem(item.key, "expectedWastePercent", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: "24px" }}>
        <button className="button button-primary" type="submit" disabled={pending}>
          <Zap size={18} /> {pending ? "Saving Recipe..." : "Save BOM Recipe"}
        </button>
      </div>
    </form>
  );
}
