import { isResponse, logFailure, requireOwner, serverError } from "../../../lib/api";

type EntryInput = { type: "receber" | "pagar"; description: string; category?: string; amount: number; dueDate: string };

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    type: row.type as "receber" | "pagar",
    orderId: row.order_id as string | null,
    description: row.description as string,
    category: row.category as string | null,
    amount: row.amount as number,
    dueDate: row.due_date as string,
    paidAt: row.paid_at as string | null,
    status: row.status as string,
    createdAt: row.created_at as string,
  };
}

export async function GET() {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  try {
    const result = await db.prepare("SELECT * FROM financial_entries WHERE owner_id = ? ORDER BY due_date ASC").bind(user.id).all<Record<string, unknown>>();
    const entries = (result.results ?? []).map(mapRow);
    const today = new Date().toISOString().slice(0, 10);
    const withComputedStatus = entries.map((entry) => ({
      ...entry,
      status: entry.status === "pendente" && entry.dueDate.slice(0, 10) < today ? "atrasado" : entry.status,
    }));
    return Response.json({ entries: withComputedStatus });
  } catch (error) {
    logFailure("finance-list", error);
    return serverError("Não foi possível carregar o financeiro.");
  }
}

export async function POST(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;

  const body = (await request.json().catch(() => null)) as EntryInput | null;
  if (!body?.description?.trim() || !body.dueDate || !Number.isFinite(body.amount)) {
    return Response.json({ error: "Preencha descrição, valor e vencimento." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  try {
    await db
      .prepare("INSERT INTO financial_entries (id, owner_id, type, description, category, amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')")
      .bind(id, user.id, body.type === "pagar" ? "pagar" : "receber", body.description.trim(), body.category ?? null, Number(body.amount), body.dueDate)
      .run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    logFailure("finance-create", error);
    return serverError("Não foi possível salvar o lançamento.");
  }
}
