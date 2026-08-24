import { isResponse, logFailure, requireOwner, serverError } from "../../../../lib/api";

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as CustomerInput | null;
  if (!body?.name?.trim()) return Response.json({ error: "Informe o nome do cliente." }, { status: 400 });

  try {
    const result = await db
      .prepare(
        "UPDATE customers SET name=?, document=?, phone=?, email=?, type=?, credit_limit=?, payment_term_days=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?"
      )
      .bind(
        body.name.trim(),
        body.document ?? null,
        body.phone ?? null,
        body.email ?? null,
        body.type === "atacado" ? "atacado" : "varejo",
        Number(body.creditLimit ?? 0) || 0,
        Number(body.paymentTermDays ?? 0) || 0,
        body.status ?? "aprovado",
        body.notes ?? null,
        id,
        user.id
      )
      .run();
    if (result.meta.changes === 0) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
    return Response.json({ saved: true });
  } catch (error) {
    logFailure("customers-update", error);
    return serverError("Não foi possível atualizar o cliente.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;
  try {
    await db.prepare("DELETE FROM customers WHERE id = ? AND owner_id = ?").bind(id, user.id).run();
    return Response.json({ deleted: true });
  } catch (error) {
    logFailure("customers-delete", error);
    return serverError("Não foi possível excluir o cliente.");
  }
}
