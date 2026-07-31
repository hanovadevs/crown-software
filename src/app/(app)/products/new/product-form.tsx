"use client";

import { PackagePlus, Save } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { createProductAction, updateProductAction, type FormState } from "@/app/actions/business";

const initialState: FormState = {};

type ProductValue = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  brand: string;
  unit: string;
  description: string | null;
  salePrice: string;
  purchasePrice: string;
  reorderLevel: string;
  isSellable: boolean;
  isPurchasable: boolean;
  isFinishedGood: boolean;
  isRawMaterial: boolean;
};

export function ProductForm({ product }: { product?: ProductValue }) {
  const [state, action, pending] = useActionState(
    product ? updateProductAction.bind(null, product.id) : createProductAction,
    initialState,
  );

  return (
    <form action={action} className="card detail-form">
      <div className="form-section-heading">
        <PackagePlus size={24} />
        <h2>{product ? "Edit Product" : "Add New Product"}</h2>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Product Name *</label>
          <input className="input" defaultValue={product?.name} id="name" name="name" placeholder="Enter product name" required />
        </div>
        <div className="field">
          <label htmlFor="sku">SKU / Product Code *</label>
          <input className="input" defaultValue={product?.sku} id="sku" name="sku" placeholder="e.g., CR-12V-100" required />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <input className="input" defaultValue={product?.category ?? ""} id="category" name="category" placeholder="e.g., Batteries, Plates, Parts" />
        </div>
        <div className="field">
          <label htmlFor="brand">Brand</label>
          <select className="select" defaultValue={product?.brand ?? "Crown"} id="brand" name="brand">
            <option>Crown</option><option>SOLO</option><option>Raw Material</option><option>Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="salePrice">Sale Price (PKR)</label>
          <input className="input" defaultValue={product?.salePrice ?? "0"} id="salePrice" min="0" name="salePrice" step="0.01" type="number" />
        </div>
        <div className="field">
          <label htmlFor="purchasePrice">Purchase / Cost Price (PKR)</label>
          <input className="input" defaultValue={product?.purchasePrice ?? "0"} id="purchasePrice" min="0" name="purchasePrice" step="0.01" type="number" />
        </div>
        <div className="field">
          <label htmlFor="unit">Unit</label>
          <select className="select" defaultValue={product?.unit ?? "Pieces"} id="unit" name="unit">
            <option>Pieces</option><option>Kg</option><option>Litres</option><option>Sets</option><option>Boxes</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="reorderLevel">Low-stock Level</label>
          <input className="input" defaultValue={product?.reorderLevel ?? "0"} id="reorderLevel" min="0" name="reorderLevel" step="0.001" type="number" />
        </div>
        <div className="field field-span-2">
          <label htmlFor="description">Description</label>
          <textarea className="textarea" defaultValue={product?.description ?? ""} id="description" name="description" placeholder="Enter product description…" />
        </div>
      </div>

      <div className="form-section-heading compact-heading"><h3>Business Role *</h3></div>
      <div className="checkbox-row">
        <label><input defaultChecked={product?.isSellable ?? true} name="isSellable" type="checkbox" /> Sellable to customers</label>
        <label><input defaultChecked={product?.isPurchasable ?? true} name="isPurchasable" type="checkbox" /> Purchasable from suppliers</label>
      </div>
      <div className="form-section-heading compact-heading"><h3>Inventory Classification</h3></div>
      <div className="checkbox-row">
        <label><input defaultChecked={product?.isFinishedGood ?? true} name="isFinishedGood" type="checkbox" /> Finished product</label>
        <label><input defaultChecked={product?.isRawMaterial ?? false} name="isRawMaterial" type="checkbox" /> Raw material</label>
      </div>

      {state.error ? <div className="form-error" role="alert">{state.error}</div> : null}
      <div className="form-actions">
        <Link className="button button-secondary" href="/products">Cancel</Link>
        <button className="button button-primary" disabled={pending} type="submit">
          <Save size={19} /> {pending ? "Saving…" : product ? "Save Product" : "Add Product"}
        </button>
      </div>
    </form>
  );
}
