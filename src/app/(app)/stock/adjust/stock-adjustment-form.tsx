"use client";

import { Save } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { createStockAdjustmentAction, type OperationFormState } from "@/app/actions/operations";

type Props = {
  products: Array<{ id: string; sku: string; name: string; unit: string; purchasePrice: string; stock: string }>;
  warehouses: Array<{ id: string; code: string; name: string }>;
  today: string;
};

export function StockAdjustmentForm({ products, warehouses, today }: Props) {
  const [state, action, pending] = useActionState(createStockAdjustmentAction, {} as OperationFormState);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [mode, setMode] = useState("increase");
  const selected = useMemo(() => products.find((product) => product.id === productId), [products, productId]);
  return (
    <form action={action} className="card detail-form">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="productId">Product *</label>
          <select className="select" id="productId" name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} required>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}
          </select>
          {selected && <small className="field-help">Current stock: {Number(selected.stock).toLocaleString()} {selected.unit}</small>}
        </div>
        <div className="field">
          <label htmlFor="warehouseId">Warehouse *</label>
          <select className="select" id="warehouseId" name="warehouseId" defaultValue={warehouses[0]?.id} required>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.code}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mode">Adjustment *</label>
          <select className="select" id="mode" name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="increase">Add stock</option>
            <option value="decrease">Remove stock</option>
            <option value="set">Set exact stock</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="quantity">{mode === "set" ? "New stock quantity" : "Quantity"} *</label>
          <input className="input" id="quantity" min="0.001" name="quantity" step="0.001" type="number" required />
        </div>
        <div className="field">
          <label htmlFor="unitCost">Unit Cost (PKR)</label>
          <input className="input" id="unitCost" min="0" name="unitCost" step="0.01" type="number" key={selected?.id} defaultValue={selected?.purchasePrice ?? "0"} />
          <small className="field-help">Used for inventory accounting value.</small>
        </div>
        <div className="field">
          <label htmlFor="occurredDate">Adjustment Date *</label>
          <input className="input" id="occurredDate" name="occurredDate" type="date" defaultValue={today} required />
        </div>
        <div className="field field-span-2">
          <label htmlFor="notes">Reason / Notes *</label>
          <textarea className="textarea" id="notes" name="notes" placeholder="Physical count correction, damaged units, opening stock…" required />
        </div>
      </div>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      <div className="form-actions">
        <Link className="button button-secondary" href="/stock">Cancel</Link>
        <button className="button button-primary" disabled={pending || !products.length || !warehouses.length} type="submit"><Save size={18} />{pending ? "Posting…" : "Post Adjustment"}</button>
      </div>
    </form>
  );
}
