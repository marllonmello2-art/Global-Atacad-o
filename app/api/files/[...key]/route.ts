import { getRuntimeBucket } from "../../../../db/runtime";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const bucket = await getRuntimeBucket();
  if (!bucket) return new Response("Arquivo indisponível.", { status: 503 });

  const objectKey = key.map(decodeURIComponent).join("/");
  const object = await bucket.get(objectKey);
  if (!object) return new Response("Arquivo não encontrado.", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
