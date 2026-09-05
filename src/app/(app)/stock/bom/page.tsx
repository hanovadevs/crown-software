import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getProductionFormData } from "@/db/bom-queries";
import { requireUser } from "@/lib/auth";
import { deleteBomAction } from "@/app/actions/bom";
import { DeleteButton } from "@/components/delete-button";
import { BomBuilder } from "./bom-builder";

export const metadata: Metadata = { title: "Bill of Materials (BOM Recipes)" };

export default async function BomPage() {
  const user = await requireUser();
  const { finishedProducts, subProducts, activeBoms } = await getProductionFormData();

  return (
    <main className="page">
      <PageHeader
        eyebrow="Factory Assembly Recipes"
        title="Bill of Materials (BOM) & Sub-Products"
        description="Configure component sub-products, assembly ratios, and expected scrap for automated production stock deductions"
        action={
          <Link className="button button-primary" href="/stock/production">
            Launch Production Run
          </Link>
        }
      />

      <section style={{ marginBottom: "32px" }}>
        <BomBuilder finishedProducts={finishedProducts} subProducts={subProducts} />
      </section>

      {/* Existing Recipes List */}
      <section className="card detail-form">
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>
          Active Assembly Recipes ({activeBoms.length})
        </h2>

        {activeBoms.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recipe Code</th>
                  <th>Finished Battery SKU</th>
                  <th>Batch Output</th>
                  <th>Sub-Product Ingredients</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeBoms.map((bom) => (
                  <tr key={bom.id}>
                    <td>
                      <span className="badge badge-primary">{bom.code}</span>
                    </td>
                    <td>
                      <strong>{bom.finishedProductName}</strong>
                      <small className="cell-subtitle">{bom.finishedProductSku}</small>
                    </td>
                    <td>
                      <strong>{bom.outputQuantity} Units</strong>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {bom.items.map((item) => (
                          <span key={item.materialProductId} style={{ fontSize: "0.85rem" }}>
                            • <strong>{item.materialName}</strong>: {item.quantity} {item.materialUnit}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <DeleteButton
                        action={deleteBomAction.bind(null, bom.id)}
                        confirmMessage={`Delete recipe ${bom.code}? This will remove or deactivate this assembly definition.`}
                        label={`Delete ${bom.code}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
            No BOM recipes configured yet. Fill out the form above to add your first battery assembly recipe.
          </p>
        )}
      </section>
    </main>
  );
}
