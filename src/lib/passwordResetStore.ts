import crypto from "node:crypto";
import { getSupabase } from "@/lib/supabase";

type ResetRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
};

type DbReset = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
};

function rowToReset(r: DbReset): ResetRecord {
  return {
    id: r.id,
    userId: r.user_id,
    tokenHash: r.token_hash,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    usedAt: r.used_at ?? undefined,
  };
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createPasswordReset(input: { userId: string; token: string; ttlMinutes: number }) {
  const supabase = getSupabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlMinutes * 60_000).toISOString();

  const row = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    token_hash: sha256(input.token),
    expires_at: expiresAt,
    created_at: now.toISOString(),
    used_at: null,
  };
  const { data, error } = await supabase.from("password_resets").insert(row).select("*").single();
  if (error) throw error;
  return rowToReset(data as DbReset);
}

export async function consumePasswordReset(input: { token: string }) {
  const supabase = getSupabase();
  const tokenHash = sha256(input.token);

  const { data: rows, error } = await supabase
    .from("password_resets")
    .select("*")
    .eq("token_hash", tokenHash)
    .limit(1);
  if (error) throw error;
  const rec = (rows ?? [])[0] as DbReset | undefined;
  if (!rec) return { ok: false as const, error: "TOKEN_INVALID" as const };
  if (rec.used_at) return { ok: false as const, error: "TOKEN_USED" as const };
  if (new Date(rec.expires_at).getTime() < Date.now()) return { ok: false as const, error: "TOKEN_EXPIRED" as const };

  const usedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("password_resets")
    .update({ used_at: usedAt })
    .eq("id", rec.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return { ok: true as const, reset: rowToReset({ ...updated, used_at: usedAt } as DbReset) };
}
