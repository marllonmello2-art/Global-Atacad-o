import { verifyPassword } from "../../../../lib/auth";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "../../../../lib/session";
import { ensureRuntimeSchema, getRuntimeDb, persistencePendingResponse } from "../../../../db/runtime";

export async function POST(request: Request) {
  const db = await getRuntimeDb();
  if (!db) return persistencePendingResponse();

  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  if (!email || !password) return Response.json({ error: "Informe e-mail e senha." }, { status: 400 });

  await ensureRuntimeSchema(db);

  const result = await db
    .prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?")
    .bind(email)
    .all<{ id: string; name: string; email: string; password_hash: string }>();
  const row = result.results?.[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(db, row.id);
  const response = Response.json({ user: { id: row.id, name: row.name, email: row.email } });
  const options = sessionCookieOptions();
  const expires = new Date(expiresAt).toUTCString();
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=${options.path}; Max-Age=${options.maxAge}; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`
  );
  return response;
}
