import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getProductionFormData } from "@/db/bom-queries";
import { requireUser } from "@/lib/auth";
import { ProductionForm } from "./production-form";

export const metadata: Metadata = { title: "Production Batch Run Launcher" };

export default async function ProductionPage() {
  const user = await requireUser();
  const { warehouseList, activeBoms } = await getProductionFormData();

  return (
    <main className="page">
      <PageHeader
        eyebrow="Factory Assembly Line"
        title="Production Batch Run Launcher"
        description="Execute a production batch: automatically credits Finished Goods inventory and deducts Sub-Products according to BOM recipes"
        action={
          <Link className="button button-secondary" href="/stock/bom">
            Manage BOM Recipes
          </Link>
        }
      />

      <ProductionForm activeBoms={activeBoms} warehouses={warehouseList} />
    </main>
  );
}
