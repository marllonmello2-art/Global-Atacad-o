import { isResponse, logFailure, requireOwner, serverError } from "../../../lib/api";

type MovementInput = { productId: string; variantId?: string | null; type: "entrada" | "saida" | "ajuste"; quantity: number; reason?: string };

export async function GET(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  try {
    const query = productId
      ? db
          .prepare(
            "SELECT stock_movements.*, products.name as product_name FROM stock_movements JOIN products ON products.id = stock_movements.product_id WHERE stock_movements.owner_id = ? AND stock_movements.product_id = ? ORDER BY stock_movements.created_at DESC LIMIT 200"
          )
          .bind(user.id, productId)
      : db
          .prepare(
            "SELECT stock_movements.*, products.name as product_name FROM stock_movements JOIN products ON products.id = stock_movements.product_id WHERE stock_movements.owner_id = ? ORDER BY stock_movements.created_at DESC LIMIT 200"
          )
          .bind(user.id);

    const result = await query.all<Record<string, unknown>>();
    const movements = (result.results ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      type: row.type,
      quantity: row.quantity,
      reason: row.reason,
      createdAt: row.created_at,
    }));
    return Response.json({ movements });
  } catch (error) {
    logFailure("stock-list", error);
    return serverError("Não foi possível carregar as movimentações de estoque.");
  }
}

export async function POST(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;

  const body = (await request.json().catch(() => null)) as MovementInput | null;
  if (!body?.productId || !body.type || !Number.isFinite(body.quantity) || body.quantity === 0) {
    return Response.json({ error: "Informe produto, tipo e quantidade da movimentação." }, { status: 400 });
  }

  const productResult = await db.prepare("SELECT id, current_stock FROM products WHERE id = ? AND owner_id = ?").bind(body.productId, user.id).all<{ id: string; current_stock: number }>();
  const product = productResult.results?.[0];
  if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });

  const signedQuantity = body.type === "saida" ? -Math.abs(body.quantity) : body.type === "entrada" ? Math.abs(body.quantity) : body.quantity;
  const nextStock = product.current_stock + signedQuantity;
  if (nextStock < 0) return Response.json({ error: "Essa movimentação deixaria o estoque negativo." }, { status: 400 });

  try {
    await db.batch([
      db
        .prepare("INSERT INTO stock_movements (id, owner_id, product_id, variant_id, type, quantity, reason) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), user.id, body.productId, body.variantId ?? null, body.type, signedQuantity, body.reason ?? null),
      db.prepare("UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?").bind(nextStock, body.productId, user.id),
    ]);
    return Response.json({ currentStock: nextStock }, { status: 201 });
  } catch (error) {
    logFailure("stock-create", error);
    return serverError("Não foi possível registrar a movimentação.");
  }
}
