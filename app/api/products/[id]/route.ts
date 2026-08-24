import { isResponse, logFailure, requireOwner, serverError } from "../../../../lib/api";
import { fetchProductWithDetails } from "../../../../lib/products";

type VariantInput = { id?: string; name: string; sku?: string; ean?: string; priceOverride?: number | null; stock?: number };
type TierInput = { id?: string; minQuantity: number; price: number; label?: string };
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;
  const product = await fetchProductWithDetails(db, user.id, id);
  if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
  return Response.json({ product });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;

  const existing = await db.prepare("SELECT id, current_stock FROM products WHERE id = ? AND owner_id = ?").bind(id, user.id).all<{ id: string; current_stock: number }>();
  const currentRow = existing.results?.[0];
  if (!currentRow) return Response.json({ error: "Produto não encontrado." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as ProductInput | null;
  if (!body?.name?.trim()) return Response.json({ error: "Informe o nome do produto." }, { status: 400 });

  const nextStock = Number(body.currentStock ?? currentRow.current_stock) || 0;
  const stockDelta = nextStock - currentRow.current_stock;

  try {
    const statements = [
      db
        .prepare(
          "UPDATE products SET sku=?, ean=?, name=?, description=?, category=?, brand=?, unit=?, cost_price=?, retail_price=?, min_stock=?, current_stock=?, active=?, visible_in_catalog=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?"
        )
        .bind(
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
          nextStock,
          body.active === false ? 0 : 1,
          body.visibleInCatalog === false ? 0 : 1,
          id,
          user.id
        ),
      db.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(id),
      db.prepare("DELETE FROM price_tiers WHERE product_id = ?").bind(id),
    ];

    for (const variant of body.variants ?? []) {
      if (!variant.name?.trim()) continue;
      statements.push(
        db
          .prepare("INSERT INTO product_variants (id, product_id, name, sku, ean, price_override, stock) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(variant.id ?? crypto.randomUUID(), id, variant.name.trim(), variant.sku ?? null, variant.ean ?? null, variant.priceOverride ?? null, Number(variant.stock ?? 0) || 0)
      );
    }

    for (const tier of body.priceTiers ?? []) {
      if (!(tier.minQuantity > 0) || !(tier.price >= 0)) continue;
      statements.push(
        db
          .prepare("INSERT INTO price_tiers (id, product_id, min_quantity, price, label) VALUES (?, ?, ?, ?, ?)")
          .bind(tier.id ?? crypto.randomUUID(), id, tier.minQuantity, tier.price, tier.label ?? null)
      );
    }

    if (stockDelta !== 0) {
      statements.push(
        db
          .prepare("INSERT INTO stock_movements (id, owner_id, product_id, type, quantity, reason) VALUES (?, ?, ?, 'ajuste', ?, 'Ajuste manual de cadastro')")
          .bind(crypto.randomUUID(), user.id, id, stockDelta)
      );
    }

    await db.batch(statements);
    return Response.json({ saved: true });
  } catch (error) {
    logFailure("products-update", error);
    return serverError("Não foi possível atualizar o produto.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;
  try {
    await db.batch([
      db.prepare("DELETE FROM products WHERE id = ? AND owner_id = ?").bind(id, user.id),
      db.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(id),
      db.prepare("DELETE FROM price_tiers WHERE product_id = ?").bind(id),
    ]);
    return Response.json({ deleted: true });
  } catch (error) {
    logFailure("products-delete", error);
    return serverError("Não foi possível excluir o produto.");
  }
}
