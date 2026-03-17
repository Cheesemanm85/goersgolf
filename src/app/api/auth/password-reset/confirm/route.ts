import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { consumePasswordReset } from "@/lib/passwordResetStore";
import { updateUserById } from "@/lib/userStore";

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
  if (!body || typeof body !== "object") return badRequest("INVALID_BODY");

  const token = String((body as any).token ?? "").trim();
  const password = String((body as any).password ?? "");

  if (!token) return badRequest("TOKEN_REQUIRED");
  if (password.length < 8 || password.length > 72) return badRequest("PASSWORD_LENGTH");

  const consumed = await consumePasswordReset({ token });
  if (!consumed.ok) return NextResponse.json({ ok: false, error: consumed.error }, { status: 400 });

  const passwordHash = await hashPassword(password);
  const updated = await updateUserById(consumed.reset.userId, { passwordHash });
  if (!updated.ok) return NextResponse.json({ ok: false, error: updated.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}

