"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      className="button button-primary no-print"
      onClick={() => window.print()}
      type="button"
    >
      <Printer size={19} /> {label}
    </button>
  );
}
