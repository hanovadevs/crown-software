"use client";

import {
  Boxes,
  ClipboardCheck,
  PackagePlus,
  Plus,
  ReceiptText,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function QuickActionMenu() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const actions = [
    {
      href: "/bills/new",
      icon: ReceiptText,
      title: "Generate Bill / Invoice",
      desc: "Commercial invoice, quotation, or tax bill",
      color: "#4f46e5",
    },
    {
      href: "/gate-pass/new",
      icon: ClipboardCheck,
      title: "New Gate Pass Challan",
      desc: "Inward or Outward vehicle gate pass",
      color: "#10b981",
    },
    {
      href: "/transactions/new",
      icon: Boxes,
      title: "New Transaction",
      desc: "Record sale, purchase, receipt, or payment",
      color: "#06b6d4",
    },
    {
      href: "/parties/new",
      icon: UserPlus,
      title: "Add Party (Customer/Supplier)",
      desc: "Register a new business account",
      color: "#f59e0b",
    },
    {
      href: "/stock/adjust",
      icon: PackagePlus,
      title: "Adjust Stock Levels",
      desc: "Record count, production, scrap, damage",
      color: "#e65aa2",
    },
  ];

  return (
    <>
      <button
        className="quick-hub-btn"
        onClick={() => setIsOpen(true)}
        type="button"
        aria-label="Quick creation hub"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span className="quick-hub-btn-text">Quick Create</span>
        <kbd className="quick-hub-kbd">⌘K</kbd>
      </button>

      {isOpen && (
        <div className="quick-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="quick-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Quick Actions Menu"
          >
            <div className="quick-modal-header">
              <div>
                <h2>Quick Action Launcher</h2>
                <p>Create documents, records, or adjust inventory instantly</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setIsOpen(false)}
                type="button"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="quick-modal-grid">
              {actions.map(({ href, icon: Icon, title, desc, color }) => (
                <Link
                  key={href}
                  className="quick-action-card"
                  href={href}
                  onClick={() => setIsOpen(false)}
                >
                  <span
                    className="quick-action-icon"
                    style={{ backgroundColor: `${color}1a`, color }}
                  >
                    <Icon size={22} />
                  </span>
                  <div className="quick-action-text">
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
