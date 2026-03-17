import crypto from "node:crypto";
import { getSupabase } from "@/lib/supabase";

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  email?: string;
  balance?: number;
  createdAt: string;
};

type DbUser = {
  id: string;
  username: string;
  password_hash: string;
  email: string | null;
  balance: number | null;
  created_at: string;
};

function rowToUser(r: DbUser): UserRecord {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    email: r.email ?? undefined,
    balance: r.balance ?? undefined,
    createdAt: r.created_at,
  };
}

export async function findUserByUsername(username: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("username", username.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToUser(data as DbUser) : null;
}

export async function findUserByEmail(email: string) {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select("*");
  if (error) throw error;
  const users = (data ?? []) as DbUser[];
  const found = users.find((u) => (u.email ?? "").trim().toLowerCase() === norm);
  return found ? rowToUser(found) : null;
}

export async function findUserById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToUser(data as DbUser) : null;
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  email: string;
}) {
  const supabase = getSupabase();
  const email = input.email.trim().toLowerCase();

  const { data: existingByUsername } = await supabase
    .from("users")
    .select("id")
    .ilike("username", input.username.trim())
    .limit(1)
    .maybeSingle();
  if (existingByUsername) return { ok: false as const, error: "USERNAME_TAKEN" as const };

  if (email) {
    const { data: all } = await supabase.from("users").select("email");
    const emailTaken = (all ?? []).some(
      (r: { email: string | null }) => (r.email ?? "").trim().toLowerCase() === email,
    );
    if (emailTaken) return { ok: false as const, error: "EMAIL_TAKEN" as const };
  }

  const row: Omit<DbUser, "id" | "created_at"> & { id?: string; created_at?: string } = {
    id: crypto.randomUUID(),
    username: input.username.trim(),
    password_hash: input.passwordHash,
    email,
    balance: 0,
    created_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase.from("users").insert(row).select("*").single();
  if (error) throw error;
  return { ok: true as const, user: rowToUser(inserted as DbUser) };
}

export async function updateUserById(
  id: string,
  patch: Partial<Pick<UserRecord, "username" | "passwordHash" | "email" | "balance">>,
) {
  const supabase = getSupabase();
  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return { ok: false as const, error: "USER_NOT_FOUND" as const };

  const current = existing as DbUser;
  const nextUsername = (patch.username ?? current.username).trim();
  const nextEmailRaw = patch.email !== undefined ? patch.email : current.email ?? "";
  const nextEmail = nextEmailRaw.trim().toLowerCase();

  if (nextUsername.toLowerCase() !== current.username.toLowerCase()) {
    const { data: conflict } = await supabase
      .from("users")
      .select("id")
      .ilike("username", nextUsername)
      .limit(1)
      .maybeSingle();
    if (conflict) return { ok: false as const, error: "USERNAME_TAKEN" as const };
  }

  if (nextEmail && nextEmail !== (current.email ?? "").trim().toLowerCase()) {
    const { data: all } = await supabase.from("users").select("id, email");
    const emailConflict = (all ?? []).some(
      (r: { id: string; email: string | null }) =>
        r.id !== id && (r.email ?? "").trim().toLowerCase() === nextEmail,
    );
    if (emailConflict) return { ok: false as const, error: "EMAIL_TAKEN" as const };
  }

  const updatePayload: Partial<DbUser> = {};
  if (patch.username !== undefined) updatePayload.username = patch.username.trim();
  if (patch.passwordHash !== undefined) updatePayload.password_hash = patch.passwordHash;
  if (patch.email !== undefined) updatePayload.email = nextEmailRaw || null;
  if (patch.balance !== undefined) updatePayload.balance = patch.balance;

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return { ok: true as const, user: rowToUser(updated as DbUser) };
}
