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
  initialBillData,
}: {
  customers: Array<{ id: string; name: string; taxNumber?: string | null }>;
  products: ProductOption[];
  today: string;
  initialBillData?: any;
}) {
  const [state, action, pending] = useActionState(createBillAction, initialState);
  const nextKey = useRef(initialBillData?.items?.length ? initialBillData.items.length + 1 : 2);
  const [items, setItems] = useState<BillItem[]>(() => {
    if (initialBillData?.items?.length) {
      return initialBillData.items.map((item: any, idx: number) => ({
        key: idx + 1,
        productId: item.productId || "",
        description: item.description || "",
        quantity: item.quantity || "1",
        unitPrice: item.unitPrice || "0",
      }));
    }
    return [{ key: 1, productId: "", description: "", quantity: "1", unitPrice: "0" }];
  });
  const [billType, setBillType] = useState<"invoice" | "quotation" | "tax_invoice">(
    initialBillData?.bill?.type || "invoice",
  );
  const [selectedPartyId, setSelectedPartyId] = useState(
    initialBillData?.bill?.partyId || (customers[0]?.id ?? ""),
  );
  const [taxRate, setTaxRate] = useState(initialBillData?.bill?.taxRate || "0");
  const [sedRate, setSedRate] = useState(initialBillData?.bill?.sedRate || "0");
  const [supplierNtn, setSupplierNtn] = useState(initialBillData?.bill?.supplierNtn || "1234567-8");
  const [buyerNtn, setBuyerNtn] = useState(initialBillData?.bill?.buyerNtn || "");
  const [timeOfSupply, setTimeOfSupply] = useState(initialBillData?.bill?.timeOfSupply || "10:30 AM");
  const [termsOfSales, setTermsOfSales] = useState(initialBillData?.bill?.termsOfSales || "Cash");
  const [shipping, setShipping] = useState(initialBillData?.bill?.shippingAmount || "0");
  const [discount, setDiscount] = useState(initialBillData?.bill?.discountAmount || "0");

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        0,
      ),
    [items],
  );

  const isTaxInvoice = billType === "tax_invoice";
  const effectiveTaxRate = Number(taxRate) || 0;
  const effectiveSedRate = isTaxInvoice ? (Number(sedRate) || 0) : 0;

  const salesTaxAmount = subtotal * (effectiveTaxRate / 100);
  const sedAmount = subtotal * (effectiveSedRate / 100);
  const total =
    subtotal + salesTaxAmount + sedAmount + (Number(shipping) || 0) - (Number(discount) || 0);

  function handleTypeChange(newType: "invoice" | "quotation" | "tax_invoice") {
    setBillType(newType);
    if (newType === "tax_invoice" && taxRate === "0") {
      setTaxRate("18");
      setSedRate("1");
    }
  }

  function handleCustomerChange(partyId: string) {
    setSelectedPartyId(partyId);
    const party = customers.find((c) => c.id === partyId);
    if (party?.taxNumber) {
      setBuyerNtn(party.taxNumber);
    }
  }

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
      <div className="billing-main">
        <input name="itemsJson" type="hidden" value={serializedItems} readOnly />
        <section className="card detail-form">
          <div className="form-section-heading">
            <FileText size={24} />
            <h2>Bill & Invoice Information</h2>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="partyId">Customer *</label>
              <select
                className="select"
                id="partyId"
                name="partyId"
                required
                value={selectedPartyId}
                onChange={(e) => handleCustomerChange(e.target.value)}
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="type">Document Type</label>
              <select
                className="select"
                value={billType}
                id="type"
                name="type"
                onChange={(e) => handleTypeChange(e.target.value as "invoice" | "quotation" | "tax_invoice")}
              >
                <option value="invoice">Commercial Invoice (INV)</option>
                <option value="quotation">Quotation (QTN)</option>
                <option value="tax_invoice">Sales Tax / S.E.D. Invoice (STI)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="billDate">Invoice Date *</label>
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

            {isTaxInvoice && (
              <>
                <div className="field">
                  <label htmlFor="timeOfSupply">Time of Supply</label>
                  <input
                    className="input"
                    id="timeOfSupply"
                    name="timeOfSupply"
                    value={timeOfSupply}
                    onChange={(e) => setTimeOfSupply(e.target.value)}
                    placeholder="e.g. 10:30 AM"
                  />
                </div>
                <div className="field">
                  <label htmlFor="termsOfSales">Terms of Sales</label>
                  <input
                    className="input"
                    id="termsOfSales"
                    name="termsOfSales"
                    value={termsOfSales}
                    onChange={(e) => setTermsOfSales(e.target.value)}
                    placeholder="e.g. Cash / Credit 30 Days"
                  />
                </div>
                <div className="field">
                  <label htmlFor="supplierNtn">Supplier NTN / STRN</label>
                  <input
                    className="input"
                    id="supplierNtn"
                    name="supplierNtn"
                    value={supplierNtn}
                    onChange={(e) => setSupplierNtn(e.target.value)}
                    placeholder="Supplier Sales Tax Registration No."
                  />
                </div>
                <div className="field">
                  <label htmlFor="buyerNtn">Buyer NTN / STRN</label>
                  <input
                    className="input"
                    id="buyerNtn"
                    name="buyerNtn"
                    value={buyerNtn}
                    onChange={(e) => setBuyerNtn(e.target.value)}
                    placeholder="Buyer National Tax No."
                  />
                </div>
              </>
            )}
          </div>
        </section>

        <section className="card detail-form bill-items-card">
          <div className="bill-items-header">
            <div className="form-section-heading">
              <PackagePlus size={24} />
              <h2>Line Items</h2>
            </div>
            <button className="button button-primary" onClick={addItem} type="button">
              <Plus size={19} /> Add Line Item
            </button>
          </div>
          <div className="bill-items">
            {items.map((item, index) => {
              const baseVal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
              const stVal = baseVal * (effectiveTaxRate / 100);
              const sedVal = baseVal * (effectiveSedRate / 100);
              const lineTotal = baseVal + stVal + sedVal;

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
                      <label htmlFor={`product-${item.key}`}>Product / Description</label>
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
                        placeholder="Item description"
                        required
                        value={item.description}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`quantity-${item.key}`}>Qty</label>
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
                      <label htmlFor={`price-${item.key}`}>Rate (PKR)</label>
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
                      <span>{isTaxInvoice ? "Total Inc. Tax & SED" : "Total"}</span>
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
              <label htmlFor="taxRate">Sales Tax Rate (%)</label>
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
            {isTaxInvoice && (
              <div className="field">
                <label htmlFor="sedRate">S.E.D. Rate (%)</label>
                <input
                  className="input"
                  id="sedRate"
                  max="100"
                  min="0"
                  name="sedRate"
                  onChange={(event) => setSedRate(event.target.value)}
                  step="0.01"
                  type="number"
                  value={sedRate}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="shippingAmount">Shipping / Freight (PKR)</label>
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
              <label htmlFor="notes">Notes / Sales Terms</label>
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
          <h2>{isTaxInvoice ? "Tax Invoice Summary" : "Bill Summary"}</h2>
          <dl>
            <div>
              <dt>Amount Exc. Tax & SED</dt>
              <dd>{formatPKR(subtotal)}</dd>
            </div>
            <div>
              <dt>Sales Tax ({effectiveTaxRate}%)</dt>
              <dd>{formatPKR(salesTaxAmount)}</dd>
            </div>
            {isTaxInvoice && (
              <div>
                <dt>S.E.D. ({effectiveSedRate}%)</dt>
                <dd>{formatPKR(sedAmount)}</dd>
              </div>
            )}
            <div>
              <dt>Shipping</dt>
              <dd>{formatPKR(shipping)}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>− {formatPKR(discount)}</dd>
            </div>
            <div className="bill-grand-total">
              <dt>Net Tax Inclusive Value</dt>
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
            {pending ? "Generating…" : "Generate & Print Invoice"}
          </button>
          <Link className="button button-secondary bill-cancel" href="/dashboard">
            Cancel
          </Link>
        </section>
        <section className="card quick-tips">
          <h2>Quick Tips</h2>
          <p>• Fixed sequential numbering (INV, QTN, STI) auto-increments with zero duplication.</p>
          <p>• Select &quot;Sales Tax / S.E.D. Invoice&quot; to print official tax documents.</p>
          <p>• Automatic S.T. & S.E.D. rate breakdown per paper tax format.</p>
        </section>
      </aside>
    </form>
  );
}
