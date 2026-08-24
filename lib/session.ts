import { cookies } from "next/headers";
import { ensureRuntimeSchema, getRuntimeDb } from "../db/runtime";
import { createSessionToken } from "./auth";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

export type CurrentUser = { id: string; name: string; email: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getRuntimeDb();
  if (!db) return null;
  await ensureRuntimeSchema(db);
  const result = await db
    .prepare(
      "SELECT users.id as id, users.name as name, users.email as email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > CURRENT_TIMESTAMP"
    )
    .bind(token)
    .all<{ id: string; name: string; email: string }>();
  const row = result.results?.[0];
  return row ?? null;
}

export async function createSession(db: D1Database, userId: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, userId, expiresAt).run();
  return { token, expiresAt };
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const db = await getRuntimeDb();
  if (db) await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
