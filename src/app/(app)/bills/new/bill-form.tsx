"use client";

import { FileText, PackagePlus, Plus, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { createBillAction } from "@/app/actions/billing";
import type { FormState } from "@/app/actions/business";
import { formatPKR } from "@/lib/utils";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  salePrice: string;
};
type BillItem = {
  key: number;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const initialState: FormState = {};

export function BillForm({
  customers,
  products,
  today,
}: {
  customers: Array<{ id: string; name: string }>;
  products: ProductOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createBillAction, initialState);
  const nextKey = useRef(2);
  const [items, setItems] = useState<BillItem[]>([
    { key: 1, productId: "", description: "", quantity: "1", unitPrice: "0" },
  ]);
  const [taxRate, setTaxRate] = useState("0");
  const [shipping, setShipping] = useState("0");
  const [discount, setDiscount] = useState("0");

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        0,
      ),
    [items],
  );
  const taxAmount = subtotal * ((Number(taxRate) || 0) / 100);
  const total =
    subtotal + taxAmount + (Number(shipping) || 0) - (Number(discount) || 0);

  function updateItem(key: number, patch: Partial<BillItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function selectProduct(key: number, productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    updateItem(key, {
      productId,
      description: product?.name ?? "",
      unitPrice: product?.salePrice ?? "0",
    });
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        key: nextKey.current++,
        productId: "",
        description: "",
        quantity: "1",
        unitPrice: "0",
      },
    ]);
  }

  const serializedItems = JSON.stringify(
    items.map((item) => ({
      productId: item.productId || null,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  );

  return (
    <form action={action} className="billing-layout">
      <input name="itemsJson" type="hidden" value={serializedItems} readOnly />
      <div className="billing-main">
        <section className="card detail-form">
          <div className="form-section-heading">
            <FileText size={24} />
            <h2>Bill Information</h2>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="partyId">Customer *</label>
              <select className="select" id="partyId" name="partyId" required>
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="type">Bill Type</label>
              <select className="select" defaultValue="invoice" id="type" name="type">
                <option value="invoice">Invoice</option>
                <option value="quotation">Quotation</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="billDate">Bill Date *</label>
              <input
                className="input"
                defaultValue={today}
                id="billDate"
                name="billDate"
                type="date"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="dueDate">Due Date (Optional)</label>
              <input className="input" id="dueDate" name="dueDate" type="date" />
            </div>
          </div>
        </section>

        <section className="card detail-form bill-items-card">
          <div className="bill-items-header">
            <div className="form-section-heading">
              <PackagePlus size={24} />
              <h2>Items</h2>
            </div>
            <button className="button button-primary" onClick={addItem} type="button">
              <Plus size={19} /> Add Item
            </button>
          </div>
          <div className="bill-items">
            {items.map((item, index) => {
              const lineTotal =
                (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
              return (
                <article className="bill-item" key={item.key}>
                  <div className="bill-item-title">
                    <strong>Item #{index + 1}</strong>
                    {items.length > 1 && (
                      <button
                        className="small-icon-button danger-icon"
                        onClick={() =>
                          setItems((current) =>
                            current.filter((candidate) => candidate.key !== item.key),
                          )
                        }
                        type="button"
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                  <div className="bill-item-grid">
                    <div className="field bill-product-field">
                      <label htmlFor={`product-${item.key}`}>Product / Service</label>
                      <select
                        className="select"
                        id={`product-${item.key}`}
                        onChange={(event) =>
                          selectProduct(item.key, event.target.value)
                        }
                        value={item.productId}
                      >
                        <option value="">Custom product or service</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} · {product.sku}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        onChange={(event) =>
                          updateItem(item.key, { description: event.target.value })
                        }
                        placeholder="Product/service description"
                        required
                        value={item.description}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`quantity-${item.key}`}>Quantity</label>
                      <input
                        className="input"
                        id={`quantity-${item.key}`}
                        min="0.001"
                        onChange={(event) =>
                          updateItem(item.key, { quantity: event.target.value })
                        }
                        step="0.001"
                        type="number"
                        value={item.quantity}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`price-${item.key}`}>Unit Price (PKR)</label>
                      <input
                        className="input"
                        id={`price-${item.key}`}
                        min="0"
                        onChange={(event) =>
                          updateItem(item.key, { unitPrice: event.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={item.unitPrice}
                      />
                    </div>
                    <div className="bill-line-total">
                      <span>Total</span>
                      <strong>{formatPKR(lineTotal)}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="card detail-form">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="taxRate">Tax Rate (%)</label>
              <input
                className="input"
                id="taxRate"
                max="100"
                min="0"
                name="taxRate"
                onChange={(event) => setTaxRate(event.target.value)}
                step="0.01"
                type="number"
                value={taxRate}
              />
            </div>
            <div className="field">
              <label htmlFor="shippingAmount">Shipping (PKR)</label>
              <input
                className="input"
                id="shippingAmount"
                min="0"
                name="shippingAmount"
                onChange={(event) => setShipping(event.target.value)}
                step="0.01"
                type="number"
                value={shipping}
              />
            </div>
            <div className="field">
              <label htmlFor="discountAmount">Discount (PKR)</label>
              <input
                className="input"
                id="discountAmount"
                min="0"
                name="discountAmount"
                onChange={(event) => setDiscount(event.target.value)}
                step="0.01"
                type="number"
                value={discount}
              />
            </div>
            <div className="field field-span-2">
              <label htmlFor="notes">Notes / Terms</label>
              <textarea
                className="textarea"
                id="notes"
                name="notes"
                placeholder="Payment terms, warranty, or delivery notes…"
              />
            </div>
          </div>
        </section>
      </div>

      <aside className="billing-sidebar">
        <section className="card bill-summary-card">
          <h2>Bill Summary</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPKR(subtotal)}</dd>
            </div>
            <div>
              <dt>Tax ({Number(taxRate) || 0}%)</dt>
              <dd>{formatPKR(taxAmount)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{formatPKR(shipping)}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>− {formatPKR(discount)}</dd>
            </div>
            <div className="bill-grand-total">
              <dt>Total Amount</dt>
              <dd>{formatPKR(Math.max(total, 0))}</dd>
            </div>
          </dl>
          {state.error && (
            <div className="form-error" role="alert">
              {state.error}
            </div>
          )}
          <button
            className="button button-primary bill-submit"
            disabled={pending}
            type="submit"
          >
            <Printer size={20} />
            {pending ? "Generating…" : "Generate & Print Bill"}
          </button>
          <Link className="button button-secondary bill-cancel" href="/dashboard">
            Cancel
          </Link>
        </section>
        <section className="card quick-tips">
          <h2>Quick Tips</h2>
          <p>• Select products to auto-fill current sale prices.</p>
          <p>• Use Invoice for final bills and Quotation for estimates.</p>
          <p>• Tax is configurable per bill and is not hard-coded.</p>
        </section>
      </aside>
    </form>
  );
}
