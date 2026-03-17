import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, signSession } from "@/lib/auth";
import { requireSession } from "@/lib/requireSession";
import { findUserById, updateUserById } from "@/lib/userStore";
import { sendAccountUpdatedEmail } from "@/lib/email";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function isValidEmail(v: string) {
  if (!v) return true;
  if (v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const user = await findUserById(session.sub);
  if (!user) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    profile: {
      id: user.id,
      username: user.username,
      email: user.email ?? "",
      balance: typeof user.balance === "number" ? user.balance : 0,
      createdAt: user.createdAt,
    },
  });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("INVALID_JSON");
  }
  if (!body || typeof body !== "object") return badRequest("INVALID_BODY");

  const username = String((body as any).username ?? "").trim();
  const email = String((body as any).email ?? "").trim();
  const password = (body as any).password;

  if (username.length < 3 || username.length > 24) return badRequest("USERNAME_LENGTH");
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return badRequest("USERNAME_FORMAT");
  if (!isValidEmail(email)) return badRequest("EMAIL_FORMAT");
  if (typeof password !== "undefined") return badRequest("PASSWORD_RESET_REQUIRED");

  const patch: any = { username, email };
  const passwordChanged = false;

  const updated = await updateUserById(session.sub, patch);
  if (!updated.ok) {
    const status = updated.error === "USER_NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ ok: false, error: updated.error }, { status });
  }

  // refresh session cookie (username may have changed)
  const token = await signSession({ sub: updated.user.id, username: updated.user.username });
  (await cookies()).set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  let emailSent: boolean | null = null;
  if (updated.user.email && updated.user.email.includes("@")) {
    const res = await sendAccountUpdatedEmail({
      to: updated.user.email,
      username: updated.user.username,
      email: updated.user.email,
      passwordChanged,
    });
    emailSent = res.ok ? true : false;
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: updated.user.id,
      username: updated.user.username,
      email: updated.user.email ?? "",
      balance: typeof updated.user.balance === "number" ? updated.user.balance : 0,
      createdAt: updated.user.createdAt,
    },
    emailSent,
  });
}

