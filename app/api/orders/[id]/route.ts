import { isResponse, logFailure, requireOwner, serverError } from "../../../../lib/api";
import { isCommittedStatus, ORDER_STATUSES } from "../../../../lib/orders";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;

  const orderResult = await db.prepare("SELECT * FROM orders WHERE id = ? AND owner_id = ?").bind(id, user.id).all<Record<string, unknown>>();
  const order = orderResult.results?.[0];
  if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });

  const itemsResult = await db.prepare("SELECT * FROM order_items WHERE order_id = ?").bind(id).all<Record<string, unknown>>();
  return Response.json({
    order: {
      id: order.id,
      customerId: order.customer_id,
      customerName: order.customer_name_snapshot,
      customerPhone: order.customer_phone_snapshot,
      status: order.status,
      paymentMethod: order.payment_method,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: (itemsResult.results ?? []).map((item) => ({
        id: item.id,
        productId: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total,
      })),
    },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { status?: string; notes?: string } | null;
  if (!body?.status || !ORDER_STATUSES.includes(body.status as (typeof ORDER_STATUSES)[number])) {
    return Response.json({ error: "Status de pedido inválido." }, { status: 400 });
  }

  const orderResult = await db.prepare("SELECT * FROM orders WHERE id = ? AND owner_id = ?").bind(id, user.id).all<Record<string, unknown>>();
  const order = orderResult.results?.[0];
  if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });

  const previousStatus = String(order.status);
  const nextStatus = body.status;
  const wasCommitted = isCommittedStatus(previousStatus);
  const willBeCommitted = isCommittedStatus(nextStatus);

  try {
    const statements = [
      db
        .prepare("UPDATE orders SET status=?, notes=COALESCE(?, notes), updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?")
        .bind(nextStatus, body.notes ?? null, id, user.id),
    ];

    if (nextStatus === "cancelado" && wasCommitted) {
      const itemsResult = await db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(id).all<{ product_id: string | null; quantity: number }>();
      for (const item of itemsResult.results ?? []) {
        if (!item.product_id) continue;
        statements.push(
          db
            .prepare("INSERT INTO stock_movements (id, owner_id, product_id, type, quantity, reason, reference_order_id) VALUES (?, ?, ?, 'devolucao', ?, 'Cancelamento de pedido', ?)")
            .bind(crypto.randomUUID(), user.id, item.product_id, item.quantity, id)
        );
        statements.push(db.prepare("UPDATE products SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(item.quantity, item.product_id));
      }
      statements.push(db.prepare("UPDATE financial_entries SET status='cancelado', updated_at=CURRENT_TIMESTAMP WHERE order_id = ? AND status = 'pendente'").bind(id));
    } else if (!wasCommitted && willBeCommitted) {
      const itemsResult = await db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(id).all<{ product_id: string | null; quantity: number }>();
      for (const item of itemsResult.results ?? []) {
        if (!item.product_id) continue;
        statements.push(
          db
            .prepare("INSERT INTO stock_movements (id, owner_id, product_id, type, quantity, reason, reference_order_id) VALUES (?, ?, ?, 'saida', ?, 'Venda', ?)")
            .bind(crypto.randomUUID(), user.id, item.product_id, -item.quantity, id)
        );
        statements.push(db.prepare("UPDATE products SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(item.quantity, item.product_id));
      }
    }

    if (nextStatus === "pago") {
      statements.push(db.prepare("UPDATE financial_entries SET status='pago', paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE order_id = ? AND status = 'pendente'").bind(id));
    }

    await db.batch(statements);
    return Response.json({ saved: true });
  } catch (error) {
    logFailure("orders-update", error);
    return serverError("Não foi possível atualizar o pedido.");
  }
}
