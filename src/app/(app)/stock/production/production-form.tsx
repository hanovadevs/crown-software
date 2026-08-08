"use client";

import { CheckCircle2, Factory, Play, ShieldAlert } from "lucide-react";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/business";
import { postProductionRunAction } from "@/app/actions/production";

type BomOption = {
  id: string;
  code: string;
  finishedProductId: string;
  finishedProductName: string | null;
  outputQuantity: string;
  items: Array<{
    materialProductId: string;
    materialName: string | null;
    materialUnit: string | null;
    quantity: string;
    expectedWastePercent: string;
  }>;
};

type WarehouseOption = { id: string; name: string; code: string };

const initialState: FormState = {};

export function ProductionForm({
  activeBoms,
  warehouses,
}: {
  activeBoms: BomOption[];
  warehouses: WarehouseOption[];
}) {
  const [state, action, pending] = useActionState(postProductionRunAction, initialState);
  const [selectedBomId, setSelectedBomId] = useState("");
  const [quantityToProduce, setQuantityToProduce] = useState("10");

  const selectedBom = activeBoms.find((b) => b.id === selectedBomId);
  const produceQtyNum = Number(quantityToProduce) || 0;
  const multiplier = selectedBom ? produceQtyNum / Number(selectedBom.outputQuantity || 1) : 0;

  return (
    <form className="billing-layout" action={action}>
      <div className="billing-main">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="alert alert-success" role="alert">
            Production Run Batch posted successfully! Sub-product inventories deducted & Finished Goods added.
          </div>
        )}

        <section className="card detail-form">
          <div className="form-section-heading">
            <Factory size={24} />
            <h2>Factory Production Batch Run</h2>
          </div>

          <div className="form-grid">
            <div className="field field-span-2">
              <label htmlFor="bomId">Assembly Recipe (BOM) *</label>
              <select
                className="select"
                id="bomId"
                name="bomId"
                value={selectedBomId}
                onChange={(e) => setSelectedBomId(e.target.value)}
                required
              >
                <option value="">— Select BOM Recipe —</option>
                {activeBoms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.finishedProductName})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="warehouseId">Target Warehouse *</label>
              <select className="select" id="warehouseId" name="warehouseId" required>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="quantityToProduce">Planned Production Quantity (Units) *</label>
              <input
                className="input"
                id="quantityToProduce"
                name="quantityToProduce"
                type="number"
                min="1"
                value={quantityToProduce}
                onChange={(e) => setQuantityToProduce(e.target.value)}
                required
              />
            </div>

            <div className="field field-span-2">
              <label htmlFor="notes">Production Run Notes</label>
              <textarea
                className="textarea"
                id="notes"
                name="notes"
                rows={2}
                placeholder="Supervisor notes, shift details..."
              />
            </div>
          </div>
        </section>

        {/* Live Sub-Products Consumption Preview */}
        {selectedBom && (
          <section className="card detail-form">
            <div className="form-section-heading">
              <CheckCircle2 size={22} />
              <h2>Sub-Products Automated Stock Deduction Preview</h2>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "16px" }}>
              Launching this run will automatically post output for <strong>{produceQtyNum}x {selectedBom.finishedProductName}</strong> and deduct the following component stocks:
            </p>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Component Sub-Product</th>
                  <th>Ratio per Recipe</th>
                  <th>Total Stock Deduction</th>
                </tr>
              </thead>
              <tbody>
                {selectedBom.items.map((item) => {
                  const req = Number(item.quantity) * multiplier;
                  const waste = 1 + Number(item.expectedWastePercent || 0) / 100;
                  const totalDeducted = req * waste;
                  return (
                    <tr key={item.materialProductId}>
                      <td>
                        <strong>{item.materialName}</strong>
                      </td>
                      <td>
                        {item.quantity} {item.materialUnit}
                      </td>
                      <td className="amount-cell">
                        <strong style={{ color: "#ef3942" }}>
                          -{totalDeducted.toLocaleString()} {item.materialUnit}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <aside className="billing-sidebar">
        <div className="card bill-summary-card">
          <h2>Production Summary</h2>
          <dl>
            <div>
              <dt>Finished Product:</dt>
              <dd>
                <strong>{selectedBom ? selectedBom.finishedProductName : "— Select —"}</strong>
              </dd>
            </div>
            <div>
              <dt>Target Batch:</dt>
              <dd>
                <strong>{produceQtyNum} Units</strong>
              </dd>
            </div>
            <div>
              <dt>Component Types:</dt>
              <dd>{selectedBom ? `${selectedBom.items.length} Sub-Products` : "0"}</dd>
            </div>
          </dl>

          <button className="button button-primary bill-submit" type="submit" disabled={pending || !selectedBomId}>
            <Play size={18} /> {pending ? "Executing Batch..." : "Launch Production Run"}
          </button>
        </div>

        <div className="card quick-tips">
          <h2>Cost Accounting Note</h2>
          <p>
            • Material costs automatically transfer from <strong>Raw Materials Inventory</strong> to <strong>Work in Progress (WIP)</strong>.
          </p>
          <p>
            • Completed batch output credits <strong>WIP</strong> and debits <strong>Finished Goods Inventory</strong>.
          </p>
        </div>
      </aside>
    </form>
  );
}
