import { isResponse, logFailure, requireOwner, serverError } from "../../../lib/api";
import { fetchProductsWithDetails } from "../../../lib/products";

type VariantInput = { name: string; sku?: string; ean?: string; priceOverride?: number | null; stock?: number };
type TierInput = { minQuantity: number; price: number; label?: string };
type ProductInput = {
  name: string;
  sku?: string;
  ean?: string;
  description?: string;
  category?: string;
  brand?: string;
  unit?: string;
  costPrice?: number;
  retailPrice?: number;
  minStock?: number;
  currentStock?: number;
  active?: boolean;
  visibleInCatalog?: boolean;
  variants?: VariantInput[];
  priceTiers?: TierInput[];
};

export async function GET() {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  try {
    const products = await fetchProductsWithDetails(db, user.id);
    return Response.json({ products });
  } catch (error) {
    logFailure("products-list", error);
    return serverError("Não foi possível carregar os produtos.");
  }
}

export async function POST(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;

  const body = (await request.json().catch(() => null)) as ProductInput | null;
  if (!body?.name?.trim()) return Response.json({ error: "Informe o nome do produto." }, { status: 400 });

  const id = crypto.randomUUID();
  const currentStock = Number(body.currentStock ?? 0) || 0;

  try {
    const statements = [
      db
        .prepare(
          "INSERT INTO products (id, owner_id, sku, ean, name, description, category, brand, unit, cost_price, retail_price, min_stock, current_stock, active, visible_in_catalog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          id,
          user.id,
          body.sku ?? null,
          body.ean ?? null,
          body.name.trim(),
          body.description ?? null,
          body.category ?? null,
          body.brand ?? null,
          body.unit?.trim() || "un",
          Number(body.costPrice ?? 0) || 0,
          Number(body.retailPrice ?? 0) || 0,
          Number(body.minStock ?? 0) || 0,
          currentStock,
          body.active === false ? 0 : 1,
          body.visibleInCatalog === false ? 0 : 1
        ),
    ];

    for (const variant of body.variants ?? []) {
      if (!variant.name?.trim()) continue;
      statements.push(
        db
          .prepare("INSERT INTO product_variants (id, product_id, name, sku, ean, price_override, stock) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), id, variant.name.trim(), variant.sku ?? null, variant.ean ?? null, variant.priceOverride ?? null, Number(variant.stock ?? 0) || 0)
      );
    }

    for (const tier of body.priceTiers ?? []) {
      if (!(tier.minQuantity > 0) || !(tier.price >= 0)) continue;
      statements.push(
        db
          .prepare("INSERT INTO price_tiers (id, product_id, min_quantity, price, label) VALUES (?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), id, tier.minQuantity, tier.price, tier.label ?? null)
      );
    }

    if (currentStock > 0) {
      statements.push(
        db
          .prepare("INSERT INTO stock_movements (id, owner_id, product_id, type, quantity, reason) VALUES (?, ?, ?, 'entrada', ?, 'Estoque inicial')")
          .bind(crypto.randomUUID(), user.id, id, currentStock)
      );
    }

    await db.batch(statements);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    logFailure("products-create", error);
    return serverError("Não foi possível salvar o produto.");
  }
}
