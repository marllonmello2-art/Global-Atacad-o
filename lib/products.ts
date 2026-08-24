export type ProductRow = {
  id: string;
  owner_id: string;
  sku: string | null;
  ean: string | null;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  unit: string;
  cost_price: number;
  retail_price: number;
  min_stock: number;
  current_stock: number;
  image_key: string | null;
  active: number;
  visible_in_catalog: number;
  created_at: string;
  updated_at: string;
};

type VariantRow = { id: string; product_id: string; name: string; sku: string | null; ean: string | null; price_override: number | null; stock: number };
type TierRow = { id: string; product_id: string; min_quantity: number; price: number; label: string | null };

export function imageUrlFromKey(key: string | null) {
  return key ? `/api/files/${key.split("/").map(encodeURIComponent).join("/")}` : null;
}

export function mapProduct(row: ProductRow, variants: VariantRow[], tiers: TierRow[]) {
  return {
    id: row.id,
    sku: row.sku,
    ean: row.ean,
    name: row.name,
    description: row.description,
    category: row.category,
    brand: row.brand,
    unit: row.unit,
    costPrice: row.cost_price,
    retailPrice: row.retail_price,
    minStock: row.min_stock,
    currentStock: row.current_stock,
    imageUrl: imageUrlFromKey(row.image_key),
    active: Boolean(row.active),
    visibleInCatalog: Boolean(row.visible_in_catalog),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants: variants
      .filter((v) => v.product_id === row.id)
      .map((v) => ({ id: v.id, name: v.name, sku: v.sku, ean: v.ean, priceOverride: v.price_override, stock: v.stock })),
    priceTiers: tiers
      .filter((t) => t.product_id === row.id)
      .sort((a, b) => a.min_quantity - b.min_quantity)
      .map((t) => ({ id: t.id, minQuantity: t.min_quantity, price: t.price, label: t.label })),
  };
}

export async function fetchProductsWithDetails(db: D1Database, ownerId: string) {
  const productsResult = await db
    .prepare("SELECT * FROM products WHERE owner_id = ? ORDER BY updated_at DESC")
    .bind(ownerId)
    .all<ProductRow>();
  const rows = productsResult.results ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const [variantsResult, tiersResult] = await Promise.all([
    db.prepare(`SELECT * FROM product_variants WHERE product_id IN (${placeholders})`).bind(...ids).all<VariantRow>(),
    db.prepare(`SELECT * FROM price_tiers WHERE product_id IN (${placeholders})`).bind(...ids).all<TierRow>(),
  ]);
  const variants = variantsResult.results ?? [];
  const tiers = tiersResult.results ?? [];
  return rows.map((row) => mapProduct(row, variants, tiers));
}

export async function fetchProductWithDetails(db: D1Database, ownerId: string, id: string) {
  const productResult = await db.prepare("SELECT * FROM products WHERE id = ? AND owner_id = ?").bind(id, ownerId).all<ProductRow>();
  const row = productResult.results?.[0];
  if (!row) return null;
  const [variantsResult, tiersResult] = await Promise.all([
    db.prepare("SELECT * FROM product_variants WHERE product_id = ?").bind(id).all<VariantRow>(),
    db.prepare("SELECT * FROM price_tiers WHERE product_id = ?").bind(id).all<TierRow>(),
  ]);
  return mapProduct(row, variantsResult.results ?? [], tiersResult.results ?? []);
}

export function priceForQuantity(retailPrice: number, tiers: { minQuantity: number; price: number }[], quantity: number) {
  const applicable = tiers.filter((t) => quantity >= t.minQuantity).sort((a, b) => b.minQuantity - a.minQuantity)[0];
  return applicable ? applicable.price : retailPrice;
}

export function suggestTitleAndDescription(input: { name: string; category?: string | null; brand?: string | null; unit?: string | null }) {
  const name = input.name.trim();
  const parts = [name];
  if (input.brand) parts.push(input.brand.trim());
  if (input.category) parts.push(`para ${input.category.trim()}`);
  const title = parts.join(" ").replace(/\s+/g, " ").trim();

  const unitLabel = input.unit && input.unit !== "un" ? ` Vendido por ${input.unit}.` : "";
  const description =
    `${name}${input.brand ? ` da marca ${input.brand}` : ""}${input.category ? `, ideal para quem busca ${input.category.toLowerCase()}` : ""}.` +
    ` Produto com ótimo custo-benefício para revenda e consumo próprio.${unitLabel} Confira as condições especiais para compra em quantidade.`;

  return { title, description };
}
