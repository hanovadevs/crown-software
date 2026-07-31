import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "./product-form";

export const metadata: Metadata = { title: "Add Product" };

export default function NewProductPage() {
  return (
    <main className="page">
      <PageHeader
        title="Products"
        description="Manage your product inventory and pricing"
      />
      <ProductForm />
    </main>
  );
}
