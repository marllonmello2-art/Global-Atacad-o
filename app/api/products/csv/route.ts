import { isResponse, logFailure, requireOwner, serverError } from "../../../../lib/api";
import { fetchProductsWithDetails } from "../../../../lib/products";
import { parseCsv, toCsvRow } from "../../../../lib/csv";

const HEADER = ["nome", "sku", "ean", "categoria", "marca", "unidade", "preco_custo", "preco_venda", "estoque_minimo", "estoque_atual"];

export async function GET() {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  try {
    const products = await fetchProductsWithDetails(db, user.id);
    const lines = [toCsvRow(HEADER)];
    for (const product of products) {
      lines.push(
        toCsvRow([product.name, product.sku, product.ean, product.category, product.brand, product.unit, product.costPrice, product.retailPrice, product.minStock, product.currentStock])
      );
    }
    return new Response(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=produtos.csv",
      },
    });
  } catch (error) {
    logFailure("products-csv-export", error);
    return serverError("Não foi possível exportar os produtos.");
  }
}

export async function POST(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;

  const text = await request.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return Response.json({ error: "Arquivo CSV vazio." }, { status: 400 });

  const [header, ...dataRows] = rows;
  const normalizedHeader = header.map((h) => h.trim().toLowerCase());
  const columnIndex = (name: string) => normalizedHeader.indexOf(name);
  const idx = {
    nome: columnIndex("nome"),
    sku: columnIndex("sku"),
    ean: columnIndex("ean"),
    categoria: columnIndex("categoria"),
    marca: columnIndex("marca"),
    unidade: columnIndex("unidade"),
    custo: columnIndex("preco_custo"),
    venda: columnIndex("preco_venda"),
    minimo: columnIndex("estoque_minimo"),
    atual: columnIndex("estoque_atual"),
  };
  if (idx.nome === -1) return Response.json({ error: "A coluna 'nome' é obrigatória no CSV." }, { status: 400 });

  const statements = [];
  let imported = 0;
  for (const row of dataRows) {
    const name = row[idx.nome]?.trim();
    if (!name) continue;
    const id = crypto.randomUUID();
    const currentStock = Number(row[idx.atual] ?? 0) || 0;
    statements.push(
      db
        .prepare(
          "INSERT INTO products (id, owner_id, sku, ean, name, category, brand, unit, cost_price, retail_price, min_stock, current_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          id,
          user.id,
          idx.sku !== -1 ? row[idx.sku] || null : null,
          idx.ean !== -1 ? row[idx.ean] || null : null,
          name,
          idx.categoria !== -1 ? row[idx.categoria] || null : null,
          idx.marca !== -1 ? row[idx.marca] || null : null,
          idx.unidade !== -1 ? row[idx.unidade] || "un" : "un",
          idx.custo !== -1 ? Number(row[idx.custo]) || 0 : 0,
          idx.venda !== -1 ? Number(row[idx.venda]) || 0 : 0,
          idx.minimo !== -1 ? Number(row[idx.minimo]) || 0 : 0,
          currentStock
        )
    );
    if (currentStock > 0) {
      statements.push(
        db
          .prepare("INSERT INTO stock_movements (id, owner_id, product_id, type, quantity, reason) VALUES (?, ?, ?, 'entrada', ?, 'Importação por planilha')")
          .bind(crypto.randomUUID(), user.id, id, currentStock)
      );
    }
    imported++;
  }

  if (statements.length === 0) return Response.json({ error: "Nenhum produto válido encontrado no arquivo." }, { status: 400 });

  try {
    await db.batch(statements);
    return Response.json({ imported });
  } catch (error) {
    logFailure("products-csv-import", error);
    return serverError("Não foi possível importar os produtos.");
  }
}
