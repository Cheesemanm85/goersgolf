import { NextResponse } from "next/server";
import { hashPassword, signSession, getSessionCookieName } from "@/lib/auth";
import { createUser } from "@/lib/userStore";

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
    !("password" in body) ||
    !("email" in body)
  ) {
    return badRequest("INVALID_BODY");
  }

  const username = String((body as any).username ?? "").trim();
  const email = String((body as any).email ?? "").trim();
  const password = String((body as any).password ?? "");

  if (username.length < 3 || username.length > 24) {
    return badRequest("USERNAME_LENGTH");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return badRequest("USERNAME_FORMAT");
  }
  if (!email) {
    return badRequest("EMAIL_REQUIRED");
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest("EMAIL_FORMAT");
  }
  if (password.length < 8 || password.length > 72) {
    return badRequest("PASSWORD_LENGTH");
  }

  const passwordHash = await hashPassword(password);
  const created = await createUser({ username, passwordHash, email });
  if (!created.ok) {
    return NextResponse.json(
      { ok: false, error: created.error },
      { status: 409 },
    );
  }

  const token = await signSession({ sub: created.user.id, username });
  const res = NextResponse.json({ ok: true, user: { username } });
  res.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

