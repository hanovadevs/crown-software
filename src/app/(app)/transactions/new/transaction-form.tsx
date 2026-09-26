"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Calculator,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  createTransactionAction,
  type FormState,
} from "@/app/actions/business";
import { formatPKR } from "@/lib/utils";
import { productTotal } from "@/lib/accounting";

type TransactionType =
  | "sale"
  | "purchase"
  | "bank_deposit"
  | "bank_withdrawal"
  | "customer_receipt"
  | "supplier_payment";

type Props = {
  parties: Array<{
    id: string;
    name: string;
    isCustomer: boolean;
    isSupplier: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    salePrice: string;
    purchasePrice: string;
    isSellable: boolean;
    isPurchasable: boolean;
  }>;
  accounts: Array<{ id: string; name: string; isCashAccount: boolean }>;
  today: string;
};

const initialState: FormState = {};
const typeOptions = [
  { value: "sale", label: "Sale", icon: ArrowUpRight },
  { value: "purchase", label: "Purchase", icon: ArrowDownLeft },
  { value: "customer_receipt", label: "Customer Receipt", icon: BanknoteArrowDown },
  { value: "supplier_payment", label: "Supplier Payment", icon: BanknoteArrowUp },
  { value: "bank_deposit", label: "Owner Deposit", icon: BanknoteArrowDown },
  { value: "bank_withdrawal", label: "Owner Withdrawal", icon: BanknoteArrowUp },
] satisfies Array<{ value: TransactionType; label: string; icon: typeof ArrowUpRight }>;

export function TransactionForm({ parties, products, accounts, today }: Props) {
  const [state, action, pending] = useActionState(
    createTransactionAction,
    initialState,
  );
  const [type, setType] = useState<TransactionType>("sale");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [amount, setAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("credit");

  const selectedProduct = products.find((product) => product.id === productId);
  const isPartyTransaction = [
    "sale",
    "purchase",
    "customer_receipt",
    "supplier_payment",
  ].includes(type);
  const isBankTransaction = ["bank_deposit", "bank_withdrawal"].includes(type);
  const needsBankAccount = isBankTransaction || paymentMethod === "bank" || paymentMethod === "cheque";
  const allowsProduct = ["sale", "purchase"].includes(type);
  const partyOptions = useMemo(
    () =>
      parties.filter((party) =>
        ["sale", "customer_receipt"].includes(type)
          ? party.isCustomer
          : ["purchase", "supplier_payment"].includes(type)
            ? party.isSupplier
            : true,
      ),
    [parties, type],
  );
  const productOptions = useMemo(
    () => products.filter((product) => type === "sale" ? product.isSellable : product.isPurchasable),
    [products, type],
  );

  function changeType(nextType: TransactionType) {
    setType(nextType);
    setPaymentMethod(["customer_receipt", "supplier_payment", "bank_deposit", "bank_withdrawal"].includes(nextType) ? "cash" : "credit");
    if (!["sale", "purchase"].includes(nextType)) {
      setProductId("");
      setQuantity("1");
      setUnitPrice("0");
    } else if (
      selectedProduct &&
      ((nextType === "sale" && selectedProduct.isSellable) ||
        (nextType === "purchase" && selectedProduct.isPurchasable))
    ) {
      const nextPrice =
        nextType === "sale"
          ? selectedProduct.salePrice
          : selectedProduct.purchasePrice;
      setUnitPrice(nextPrice);
      setAmount(productTotal(Number(quantity), Number(nextPrice)).toFixed(2));
    } else {
      setProductId("");
      setUnitPrice("0");
      setAmount("0");
    }
  }

  function changeProduct(nextId: string) {
    setProductId(nextId);
    const product = products.find((candidate) => candidate.id === nextId);
    if (!product) {
      setUnitPrice("0");
      return;
    }
    const price = type === "sale" ? product.salePrice : product.purchasePrice;
    setUnitPrice(price);
    setAmount(productTotal(Number(quantity), Number(price)).toFixed(2));
  }

  function recalculate(nextQuantity: string, nextUnitPrice: string) {
    setAmount(
      productTotal(Math.max(0, Number(nextQuantity) || 0), Math.max(0, Number(nextUnitPrice) || 0)).toFixed(2),
    );
  }

  return (
    <form action={action} className="card transaction-form">
      {isBankTransaction && <p className="muted-text">Owner deposits and withdrawals change owner equity. They do not transfer money between two company accounts.</p>}
      <fieldset className="transaction-types">
        <legend>Transaction Type</legend>
        <div className="transaction-type-grid">
          {typeOptions.map(({ value, label, icon: Icon }) => (
            <label
              className={`transaction-type ${type === value ? "selected" : ""}`}
              key={value}
            >
              <input
                checked={type === value}
                name="type"
                onChange={() => changeType(value)}
                type="radio"
                value={value}
              />
              <span className="transaction-type-icon">
                <Icon size={20} />
              </span>
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="transaction-form-grid">
        <div className="transaction-fields">
          {isPartyTransaction && (
            <div className="field">
              <label htmlFor="partyId">
                {["sale", "customer_receipt"].includes(type)
                  ? "Customer"
                  : "Supplier"}{" "}
                *
              </label>
              <select className="select" id="partyId" name="partyId" required>
                <option value="">Select party</option>
                {partyOptions.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {party.isCustomer && party.isSupplier ? " · Both" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {needsBankAccount && (
            <div className="field">
              <label htmlFor="bankAccountId">Bank / Cash Account *</label>
              <select
                className="select"
                id="bankAccountId"
                name="bankAccountId"
                required
              >
                <option value="">Select account</option>
                {accounts.filter((account) => isBankTransaction || !account.isCashAccount).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {needsBankAccount && !accounts.some((account) => !account.isCashAccount) && !isBankTransaction && (
            <p className="muted-text">No bank account is configured. Ask an administrator to add one in <Link href="/settings">Settings</Link>.</p>
          )}

          {allowsProduct && (
            <>
              <div className="field">
                <label htmlFor="productId">Product</label>
                <select
                  className="select"
                  id="productId"
                  name="productId"
                  onChange={(event) => changeProduct(event.target.value)}
                  value={productId}
                >
                  <option value="">No product (custom transaction)</option>
                  {productOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.sku}
                    </option>
                  ))}
                </select>
              </div>
              {productId && (
                <div className="inline-fields">
                  <div className="field">
                    <label htmlFor="quantity">Quantity *</label>
                    <input
                      className="input"
                      id="quantity"
                      min="0.001"
                      name="quantity"
                      onChange={(event) => {
                        setQuantity(event.target.value);
                        recalculate(event.target.value, unitPrice);
                      }}
                      step="0.001"
                      type="number"
                      value={quantity}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="unitPrice">Unit Price (PKR) *</label>
                    <input
                      className="input"
                      id="unitPrice"
                      min="0"
                      name="unitPrice"
                      onChange={(event) => {
                        setUnitPrice(event.target.value);
                        recalculate(quantity, event.target.value);
                      }}
                      step="0.01"
                      type="number"
                      value={unitPrice}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="field">
            <label htmlFor="description">Description *</label>
            <textarea
              className="textarea"
              id="description"
              name="description"
              placeholder="Enter transaction description…"
              required
            />
          </div>
          <div className="inline-fields">
            <div className="field">
              <label htmlFor="transactionDate">Date *</label>
              <input
                className="input"
                defaultValue={today}
                id="transactionDate"
                name="transactionDate"
                type="date"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="paymentMethod">Payment Method</label>
              <select
                className="select"
                id="paymentMethod"
                name="paymentMethod"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="cheque">Cheque</option>
                {!isBankTransaction && !["customer_receipt", "supplier_payment"].includes(type) && <option value="credit">Credit / Ledger</option>}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="reference">Reference</label>
            <input
              className="input"
              id="reference"
              name="reference"
              placeholder="PO, cheque, or delivery reference"
            />
          </div>
        </div>

        <aside className="transaction-summary">
          <div className="field">
            <label htmlFor="totalAmount">Total Amount (PKR) *</label>
            <div className="input-wrap">
              <Calculator className="input-icon" size={18} />
              <input
                className="input has-icon"
                id="totalAmount"
                min="0.01"
                name="totalAmount"
                onChange={(event) => setAmount(event.target.value)}
                step="0.01"
                type="number"
                value={amount}
                readOnly={Boolean(productId)}
                required
              />
            </div>
          </div>
          <div className="summary-box">
            <h3>Transaction Summary</h3>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{typeOptions.find((item) => item.value === type)?.label}</dd>
              </div>
              {selectedProduct && (
                <div>
                  <dt>Product</dt>
                  <dd>{selectedProduct.name}</dd>
                </div>
              )}
              <div className="summary-total">
                <dt>Total</dt>
                <dd>{formatPKR(amount)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      <div className="form-actions">
        <Link className="button button-secondary" href="/transactions">
          Cancel
        </Link>
        <button className="button button-primary" disabled={pending} type="submit">
          <Save size={19} />
          {pending ? "Posting…" : "Save Transaction"}
        </button>
      </div>
    </form>
  );
}
