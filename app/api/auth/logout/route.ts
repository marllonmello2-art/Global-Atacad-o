import { destroySession, SESSION_COOKIE } from "../../../../lib/session";

export async function POST() {
  await destroySession();
  const response = Response.json({ signedOut: true });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return response;
}
