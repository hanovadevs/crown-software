import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PartyForm } from "./party-form";

export const metadata: Metadata = { title: "Add Party" };

export default function NewPartyPage() {
  return (
    <main className="page form-page">
      <div className="back-title">
        <Link className="icon-button" href="/parties" aria-label="Back to parties">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="page-title">Add New Party</h1>
          <p className="page-description">
            Add a customer, supplier, or dual-role business
          </p>
        </div>
      </div>
      <PartyForm />
    </main>
  );
}
