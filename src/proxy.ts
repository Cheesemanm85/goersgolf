import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookieName, verifySession } from "@/lib/auth";

const PROTECTED = ["/dashboard", "/team", "/account"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  const token = req.cookies.get(getSessionCookieName())?.value;
  const session = token ? await verifySession(token) : null;

  if (isProtected && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/team/:path*", "/account/:path*", "/login", "/signup"],
};

