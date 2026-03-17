import { NextResponse } from "next/server";
import {
  signSession,
  verifyPassword,
  getSessionCookieName,
} from "@/lib/auth";
import { findUserByUsername } from "@/lib/userStore";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("INVALID_JSON");
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("username" in body) ||
    !("password" in body)
  ) {
    return badRequest("INVALID_BODY");
  }

  const username = String((body as any).username ?? "").trim();
  const password = String((body as any).password ?? "");
  if (!username || !password) return badRequest("MISSING_FIELDS");

  const user = await findUserByUsername(username);
  if (!user) {
    return NextResponse.json({ ok: false, error: "INVALID_LOGIN" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "INVALID_LOGIN" }, { status: 401 });
  }

  const token = await signSession({ sub: user.id, username: user.username });
  const res = NextResponse.json({ ok: true, user: { username: user.username } });
  res.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

