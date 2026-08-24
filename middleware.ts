import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "./lib/session";

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const loginUrl = new URL("/entrar", request.url);
    loginUrl.searchParams.set("return_to", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*"],
};
