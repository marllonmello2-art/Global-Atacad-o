import { getRuntimeBucket } from "../../../../../db/runtime";
import { isResponse, logFailure, requireOwner, serverError } from "../../../../../lib/api";

function actualImageType(bytes: Uint8Array) {
  const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (isPng) return "image/png";
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) return "image/jpeg";
  const isWebp = bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (isWebp) return "image/webp";
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  if (isResponse(ctx)) return ctx;
  const { user, db } = ctx;
  const { id } = await params;

  const owned = await db.prepare("SELECT id FROM products WHERE id = ? AND owner_id = ?").bind(id, user.id).all();
  if (!owned.results || owned.results.length === 0) return Response.json({ error: "Produto não encontrado." }, { status: 404 });

  const bucket = await getRuntimeBucket();
  if (!bucket) return Response.json({ error: "Armazenamento de arquivos (R2) ainda não configurado." }, { status: 503 });

  const formData = await request.formData().catch(() => null);
  const image = formData?.get("image");
  if (!(image instanceof File)) return Response.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
  if (image.size > 8 * 1024 * 1024) return Response.json({ error: "A imagem excede o limite de 8 MB." }, { status: 413 });

  const bytes = new Uint8Array(await image.arrayBuffer());
  const mime = actualImageType(bytes);
  if (!mime) return Response.json({ error: "Use uma imagem JPG, PNG ou WEBP válida." }, { status: 415 });

  try {
    const imageKey = `products/${user.id}/${id}`;
    await bucket.put(imageKey, bytes, { httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" } });
    await db.prepare("UPDATE products SET image_key=?, image_mime=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(imageKey, mime, id, user.id).run();
    return Response.json({ imageUrl: `/api/files/${imageKey.split("/").map(encodeURIComponent).join("/")}` });
  } catch (error) {
    logFailure("product-image-upload", error);
    return serverError("Não foi possível salvar a imagem.");
  }
}
