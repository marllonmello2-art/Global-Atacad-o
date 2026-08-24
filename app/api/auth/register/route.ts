import { hashPassword, isValidEmail } from "../../../../lib/auth";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "../../../../lib/session";
import { ensureRuntimeSchema, getRuntimeDb, persistencePendingResponse } from "../../../../db/runtime";

export async function POST(request: Request) {
  const db = await getRuntimeDb();
  if (!db) return persistencePendingResponse();

  const body = (await request.json().catch(() => null)) as { name?: string; email?: string; password?: string } | null;
  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (!name) return Response.json({ error: "Informe o seu nome." }, { status: 400 });
  if (!isValidEmail(email)) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });

  await ensureRuntimeSchema(db);

  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).all();
  if (existing.results && existing.results.length > 0) {
    return Response.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await db.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)").bind(userId, name, email, passwordHash).run();

  const { token, expiresAt } = await createSession(db, userId);
  const response = Response.json({ user: { id: userId, name, email } }, { status: 201 });
  response.headers.append(
    "Set-Cookie",
    buildCookie(token, expiresAt)
  );
  return response;
}

function buildCookie(token: string, expiresAt: string) {
  const options = sessionCookieOptions();
  const expires = new Date(expiresAt).toUTCString();
  return `${SESSION_COOKIE}=${token}; Path=${options.path}; Max-Age=${options.maxAge}; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`;
}
