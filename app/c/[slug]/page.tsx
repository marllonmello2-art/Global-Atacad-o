import { notFound } from "next/navigation";
import { ensureRuntimeSchema, getRuntimeDb } from "../../../db/runtime";
import { fetchProductsWithDetails } from "../../../lib/products";
import { PublicCatalog } from "../../../components/public-catalog";

export const dynamic = "force-dynamic";

export default async function PublicCatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getRuntimeDb();
  if (!db) notFound();
  await ensureRuntimeSchema(db);

  const settingsResult = await db.prepare("SELECT * FROM store_settings WHERE slug = ?").bind(slug).all<Record<string, unknown>>();
  const settings = settingsResult.results?.[0];
  if (!settings) notFound();

  const ownerId = String(settings.owner_id);
  const allProducts = await fetchProductsWithDetails(db, ownerId);
  const visibleProducts = allProducts.filter((product) => product.active && product.visibleInCatalog);

  return (
    <PublicCatalog
      store={{
        storeName: String(settings.store_name),
        whatsappNumber: settings.whatsapp_number ? String(settings.whatsapp_number) : null,
        description: settings.description ? String(settings.description) : null,
      }}
      products={visibleProducts}
    />
  );
}
