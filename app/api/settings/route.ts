import { isResponse, logFailure, requireOwner, serverError } from "../../../lib/api";
import { slugify } from "../../../lib/auth";

export async function GET() {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const result = await db.prepare("SELECT * FROM store_settings WHERE owner_id = ?").bind(user.id).all<Record<string, unknown>>();
  const row = result.results?.[0];
  return Response.json({
    settings: row
      ? { slug: row.slug, storeName: row.store_name, whatsappNumber: row.whatsapp_number, description: row.description }
      : { slug: slugify(user.name) || user.id.slice(0, 8), storeName: user.name, whatsappNumber: "", description: "" },
  });
}

export async function PUT(request: Request) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;

  const body = (await request.json().catch(() => null)) as { slug?: string; storeName?: string; whatsappNumber?: string; description?: string } | null;
  if (!body?.storeName?.trim()) return Response.json({ error: "Informe o nome da loja." }, { status: 400 });
  const slug = slugify(body.slug?.trim() || body.storeName);
  if (!slug) return Response.json({ error: "O identificador do catálogo (slug) é inválido." }, { status: 400 });

  const existingSlug = await db.prepare("SELECT owner_id FROM store_settings WHERE slug = ? AND owner_id != ?").bind(slug, user.id).all();
  if (existingSlug.results && existingSlug.results.length > 0) {
    return Response.json({ error: "Esse identificador de catálogo já está em uso. Escolha outro." }, { status: 409 });
  }

  try {
    await db
      .prepare(
        "INSERT INTO store_settings (owner_id, slug, store_name, whatsapp_number, description) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET slug=excluded.slug, store_name=excluded.store_name, whatsapp_number=excluded.whatsapp_number, description=excluded.description, updated_at=CURRENT_TIMESTAMP"
      )
      .bind(user.id, slug, body.storeName.trim(), body.whatsappNumber?.trim() || null, body.description?.trim() || null)
      .run();
    return Response.json({ slug });
  } catch (error) {
    logFailure("settings-update", error);
    return serverError("Não foi possível salvar as configurações da loja.");
  }
}
