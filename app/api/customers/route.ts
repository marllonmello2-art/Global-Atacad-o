import { isResponse, logFailure, requireOwner, serverError } from "../../../lib/api";

type CustomerInput = {
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  type?: "varejo" | "atacado";
  creditLimit?: number;
  paymentTermDays?: number;
  status?: "pendente" | "aprovado" | "bloqueado";
  notes?: string;
};

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    phone: row.phone,
    email: row.email,
    type: row.type,
    creditLimit: row.credit_limit,
    paymentTermDays: row.payment_term_days,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  try {
    const result = await db.prepare("SELECT * FROM customers WHERE owner_id = ? ORDER BY name ASC").bind(user.id).all<Record<string, unknown>>();
    return Response.json({ customers: (result.results ?? []).map(mapRow) });
  } catch (error) {
    logFailure("customers-list", error);
    return serverError("Não foi possível carregar os clientes.");
  }
}

export async function POST(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;

  const body = (await request.json().catch(() => null)) as CustomerInput | null;
  if (!body?.name?.trim()) return Response.json({ error: "Informe o nome do cliente." }, { status: 400 });

  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        "INSERT INTO customers (id, owner_id, name, document, phone, email, type, credit_limit, payment_term_days, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        id,
        user.id,
        body.name.trim(),
        body.document ?? null,
        body.phone ?? null,
        body.email ?? null,
        body.type === "atacado" ? "atacado" : "varejo",
        Number(body.creditLimit ?? 0) || 0,
        Number(body.paymentTermDays ?? 0) || 0,
        body.status ?? "aprovado",
        body.notes ?? null
      )
      .run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    logFailure("customers-create", error);
    return serverError("Não foi possível salvar o cliente.");
  }
}
