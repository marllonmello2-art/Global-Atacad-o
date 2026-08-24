import { isResponse, logFailure, requireOwner, serverError } from "../../../../lib/api";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { status?: "pendente" | "pago" | "cancelado" } | null;
  if (!body?.status) return Response.json({ error: "Informe o novo status." }, { status: 400 });

  try {
    const paidAt = body.status === "pago" ? "CURRENT_TIMESTAMP" : "NULL";
    const result = await db
      .prepare(`UPDATE financial_entries SET status=?, paid_at=${paidAt}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?`)
      .bind(body.status, id, user.id)
      .run();
    if (result.meta.changes === 0) return Response.json({ error: "Lançamento não encontrado." }, { status: 404 });
    return Response.json({ saved: true });
  } catch (error) {
    logFailure("finance-update", error);
    return serverError("Não foi possível atualizar o lançamento.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;
  try {
    await db.prepare("DELETE FROM financial_entries WHERE id = ? AND owner_id = ? AND order_id IS NULL").bind(id, user.id).run();
    return Response.json({ deleted: true });
  } catch (error) {
    logFailure("finance-delete", error);
    return serverError("Não foi possível excluir o lançamento.");
  }
}
