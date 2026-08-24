import { isResponse, logFailure, requireOwner, serverError } from "../../../lib/api";
import { isCommittedStatus } from "../../../lib/orders";

type OrderItemInput = { productId?: string | null; variantId?: string | null; description: string; quantity: number; unitPrice: number };
type OrderInput = {
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  status?: string;
  paymentMethod: "pix" | "cartao" | "boleto" | "dinheiro" | "fiado";
  discount?: number;
  notes?: string;
  items: OrderItemInput[];
};

export async function GET() {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  try {
    const result = await db
      .prepare(
        "SELECT orders.*, (SELECT COUNT(*) FROM order_items WHERE order_items.order_id = orders.id) as item_count FROM orders WHERE owner_id = ? ORDER BY created_at DESC LIMIT 300"
      )
      .bind(user.id)
      .all<Record<string, unknown>>();
    const orders = (result.results ?? []).map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name_snapshot,
      customerPhone: row.customer_phone_snapshot,
      status: row.status,
      paymentMethod: row.payment_method,
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
      itemCount: row.item_count,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return Response.json({ orders });
  } catch (error) {
    logFailure("orders-list", error);
    return serverError("Não foi possível carregar os pedidos.");
  }
}

export async function POST(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;

  const body = (await request.json().catch(() => null)) as OrderInput | null;
  if (!body?.items || body.items.length === 0) return Response.json({ error: "Adicione ao menos um item ao pedido." }, { status: 400 });
  if (!body.paymentMethod) return Response.json({ error: "Selecione a forma de pagamento." }, { status: 400 });

  let customerName = body.customerName?.trim() || null;
  let customerPhone = body.customerPhone?.trim() || null;
  let paymentTermDays = 30;

  if (body.customerId) {
    const customerResult = await db
      .prepare("SELECT name, phone, payment_term_days FROM customers WHERE id = ? AND owner_id = ?")
      .bind(body.customerId, user.id)
      .all<{ name: string; phone: string | null; payment_term_days: number }>();
    const customer = customerResult.results?.[0];
    if (!customer) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
    customerName = customer.name;
    customerPhone = customer.phone;
    paymentTermDays = customer.payment_term_days || 30;
  }

  const subtotal = body.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  const discount = Number(body.discount ?? 0) || 0;
  const total = Math.max(0, subtotal - discount);
  const status = body.status && ["orcamento", "aberto", "pago"].includes(body.status) ? body.status : "aberto";
  const orderId = crypto.randomUUID();

  try {
    const stockChecks: { productId: string; quantity: number; currentStock: number }[] = [];
    if (isCommittedStatus(status)) {
      for (const item of body.items) {
        if (!item.productId) continue;
        const productResult = await db.prepare("SELECT current_stock FROM products WHERE id = ? AND owner_id = ?").bind(item.productId, user.id).all<{ current_stock: number }>();
        const current = productResult.results?.[0]?.current_stock ?? 0;
        if (current - Number(item.quantity) < 0) {
          return Response.json({ error: "Estoque insuficiente para concluir este pedido." }, { status: 400 });
        }
        stockChecks.push({ productId: item.productId, quantity: Number(item.quantity), currentStock: current });
      }
    }

    const statements = [
      db
        .prepare(
          "INSERT INTO orders (id, owner_id, customer_id, customer_name_snapshot, customer_phone_snapshot, status, payment_method, subtotal, discount, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(orderId, user.id, body.customerId ?? null, customerName, customerPhone, status, body.paymentMethod, subtotal, discount, total, body.notes ?? null),
    ];

    for (const item of body.items) {
      statements.push(
        db
          .prepare("INSERT INTO order_items (id, order_id, product_id, variant_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), orderId, item.productId ?? null, item.variantId ?? null, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice)
      );
    }

    for (const check of stockChecks) {
      statements.push(
        db
          .prepare("INSERT INTO stock_movements (id, owner_id, product_id, type, quantity, reason, reference_order_id) VALUES (?, ?, ?, 'saida', ?, 'Venda', ?)")
          .bind(crypto.randomUUID(), user.id, check.productId, -check.quantity, orderId)
      );
      statements.push(
        db.prepare("UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(check.currentStock - check.quantity, check.productId)
      );
    }

    if (body.paymentMethod === "fiado" && status !== "orcamento") {
      const dueDate = new Date(Date.now() + paymentTermDays * 24 * 60 * 60 * 1000).toISOString();
      statements.push(
        db
          .prepare("INSERT INTO financial_entries (id, owner_id, type, order_id, description, category, amount, due_date, status) VALUES (?, ?, 'receber', ?, ?, 'venda-fiado', ?, ?, 'pendente')")
          .bind(crypto.randomUUID(), user.id, orderId, `Recebimento do pedido de ${customerName ?? "cliente"}`, total, dueDate)
      );
    }

    await db.batch(statements);
    return Response.json({ id: orderId }, { status: 201 });
  } catch (error) {
    logFailure("orders-create", error);
    return serverError("Não foi possível registrar o pedido.");
  }
}
