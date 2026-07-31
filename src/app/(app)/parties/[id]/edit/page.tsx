import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getParty } from "@/db/business-queries";
import { PartyForm } from "../../new/party-form";

export default async function EditPartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getParty(id);
  if (!result) notFound();
  return (
    <main className="page form-page">
      <div className="back-title">
        <Link className="icon-button" href={`/parties/${id}`} aria-label="Back to party"><ArrowLeft size={22} /></Link>
        <div><h1 className="page-title">Edit Party</h1><p className="page-description">Update customer and supplier information</p></div>
      </div>
      <PartyForm party={result.party} />
    </main>
  );
}
