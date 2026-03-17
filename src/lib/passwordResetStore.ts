import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type ResetRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
};

function filePath() {
  return path.join(process.cwd(), "data", "passwordResets.json");
}

async function readAll(): Promise<ResetRecord[]> {
  const file = filePath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ResetRecord[]) : [];
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && e.code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(rows: ResetRecord[]) {
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(rows, null, 2) + "\n", "utf8");
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createPasswordReset(input: { userId: string; token: string; ttlMinutes: number }) {
  const rows = await readAll();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlMinutes * 60_000).toISOString();

  const rec: ResetRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    tokenHash: sha256(input.token),
    createdAt: now.toISOString(),
    expiresAt,
  };
  rows.push(rec);
  await writeAll(rows);
  return rec;
}

export async function consumePasswordReset(input: { token: string }) {
  const rows = await readAll();
  const tokenHash = sha256(input.token);
  const idx = rows.findIndex((r) => r.tokenHash === tokenHash);
  if (idx === -1) return { ok: false as const, error: "TOKEN_INVALID" as const };

  const rec = rows[idx]!;
  if (rec.usedAt) return { ok: false as const, error: "TOKEN_USED" as const };
  if (new Date(rec.expiresAt).getTime() < Date.now()) return { ok: false as const, error: "TOKEN_EXPIRED" as const };

  rows[idx] = { ...rec, usedAt: new Date().toISOString() };
  await writeAll(rows);
  return { ok: true as const, reset: rows[idx]! };
}

