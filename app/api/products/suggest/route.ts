import { isResponse, requireOwner } from "../../../../lib/api";
import { suggestTitleAndDescription } from "../../../../lib/products";

export async function POST(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;

  const body = (await request.json().catch(() => null)) as { name?: string; category?: string; brand?: string; unit?: string } | null;
  if (!body?.name?.trim()) return Response.json({ error: "Informe o nome do produto para gerar a sugestão." }, { status: 400 });

  const suggestion = suggestTitleAndDescription({ ...body, name: body.name.trim() });
  return Response.json(suggestion);
}
