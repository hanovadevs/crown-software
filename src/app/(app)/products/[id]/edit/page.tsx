import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getProduct } from "@/db/business-queries";
import { ProductForm } from "../../new/product-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  return (
    <main className="page form-page">
      <PageHeader title="Edit Product" description="Update product roles, pricing, and inventory classification" />
      <ProductForm product={product} />
    </main>
  );
}
