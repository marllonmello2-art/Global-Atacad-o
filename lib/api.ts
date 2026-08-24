import { ensureRuntimeSchema, getRuntimeDb, persistencePendingResponse } from "../db/runtime";
import { CurrentUser, getCurrentUser } from "./session";

export async function requireOwner(): Promise<{ user: CurrentUser; db: D1Database } | Response> {
  const db = await getRuntimeDb();
  if (!db) return persistencePendingResponse();
  await ensureRuntimeSchema(db);
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login para continuar." }, { status: 401 });
  return { user, db };
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export function logFailure(stage: string, error: unknown) {
  const details = error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) };
  console.error(`[api] persistence failure at ${stage}`, details);
}

export function serverError(message: string) {
  return Response.json({ error: message }, { status: 500 });
}
