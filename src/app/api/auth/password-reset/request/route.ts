import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/email";
import { createPasswordReset, generateResetToken } from "@/lib/passwordResetStore";
import { findUserByEmail } from "@/lib/userStore";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function isValidEmail(v: string) {
  if (!v) return false;
  if (v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("INVALID_JSON");
  }
  if (!body || typeof body !== "object") return badRequest("INVALID_BODY");

  const email = String((body as any).email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return badRequest("EMAIL_FORMAT");

  // We intentionally return ok even if the email isn't registered
  // (helps avoid account enumeration).
  const u = await findUserByEmail(email);
  if (!u) return NextResponse.json({ ok: true, emailSent: null });

  const token = generateResetToken();
  await createPasswordReset({ userId: u.id, token, ttlMinutes: 30 });

  const origin =
    process.env.APP_BASE_URL ?? req.headers.get("origin") ?? "http://localhost:3000";
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendPasswordResetEmail({ to: u.email ?? email, resetUrl });

  return NextResponse.json({
    ok: true,
    emailSent: sent.ok ? true : false,
    emailError: sent.ok ? null : sent.error,
  });
}

