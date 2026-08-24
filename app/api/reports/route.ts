import { isResponse, logFailure, requireOwner, serverError } from "../../../lib/api";

export async function GET() {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [salesResult, stockResult, lowStockResult, receivableResult, payableResult, topProductsResult] = await Promise.all([
      db
        .prepare(
          "SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE owner_id = ? AND status != 'orcamento' AND status != 'cancelado' AND created_at >= ?"
        )
        .bind(user.id, thirtyDaysAgo)
        .all<{ order_count: number; revenue: number }>(),
      db.prepare("SELECT COALESCE(SUM(current_stock * cost_price), 0) as stock_value, COUNT(*) as product_count FROM products WHERE owner_id = ?").bind(user.id).all<{ stock_value: number; product_count: number }>(),
      db.prepare("SELECT COUNT(*) as low_stock_count FROM products WHERE owner_id = ? AND current_stock <= min_stock").bind(user.id).all<{ low_stock_count: number }>(),
      db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM financial_entries WHERE owner_id = ? AND type = 'receber' AND status = 'pendente'").bind(user.id).all<{ total: number }>(),
      db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM financial_entries WHERE owner_id = ? AND type = 'pagar' AND status = 'pendente'").bind(user.id).all<{ total: number }>(),
      db
        .prepare(
          "SELECT products.name as name, SUM(order_items.quantity) as quantity, SUM(order_items.total) as revenue FROM order_items JOIN orders ON orders.id = order_items.order_id JOIN products ON products.id = order_items.product_id WHERE orders.owner_id = ? AND orders.status != 'orcamento' AND orders.status != 'cancelado' GROUP BY order_items.product_id ORDER BY revenue DESC LIMIT 5"
        )
        .bind(user.id)
        .all<{ name: string; quantity: number; revenue: number }>(),
    ]);

    const costResult = await db
      .prepare(
        "SELECT COALESCE(SUM(order_items.quantity * products.cost_price), 0) as cost FROM order_items JOIN orders ON orders.id = order_items.order_id LEFT JOIN products ON products.id = order_items.product_id WHERE orders.owner_id = ? AND orders.status != 'orcamento' AND orders.status != 'cancelado' AND orders.created_at >= ?"
      )
      .bind(user.id, thirtyDaysAgo)
      .all<{ cost: number }>();

    const revenue = salesResult.results?.[0]?.revenue ?? 0;
    const cost = costResult.results?.[0]?.cost ?? 0;

    return Response.json({
      last30Days: {
        orderCount: salesResult.results?.[0]?.order_count ?? 0,
        revenue,
        estimatedProfit: revenue - cost,
      },
      stock: {
        totalValue: stockResult.results?.[0]?.stock_value ?? 0,
        productCount: stockResult.results?.[0]?.product_count ?? 0,
        lowStockCount: lowStockResult.results?.[0]?.low_stock_count ?? 0,
      },
      finance: {
        pendingReceivable: receivableResult.results?.[0]?.total ?? 0,
        pendingPayable: payableResult.results?.[0]?.total ?? 0,
      },
      topProducts: topProductsResult.results ?? [],
    });
  } catch (error) {
    logFailure("reports", error);
    return serverError("Não foi possível carregar os relatórios.");
  }
}
