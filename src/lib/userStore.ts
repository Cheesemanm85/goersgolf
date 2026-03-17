import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  email?: string;
  balance?: number;
  createdAt: string;
};

function usersFilePath() {
  return path.join(process.cwd(), "data", "users.json");
}

async function readAllUsers(): Promise<UserRecord[]> {
  const file = usersFilePath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserRecord[]) : [];
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && e.code === "ENOENT") {
      return [];
    }
    throw e;
  }
}

async function writeAllUsers(users: UserRecord[]) {
  const file = usersFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(users, null, 2) + "\n", "utf8");
}

export async function findUserByUsername(username: string) {
  const users = await readAllUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export async function findUserByEmail(email: string) {
  const users = await readAllUsers();
  const norm = email.trim().toLowerCase();
  return users.find((u) => (u.email ?? "").trim().toLowerCase() === norm);
}

export async function findUserById(id: string) {
  const users = await readAllUsers();
  return users.find((u) => u.id === id);
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  email: string;
}) {
  const users = await readAllUsers();
  const existing = users.find(
    (u) => u.username.toLowerCase() === input.username.toLowerCase(),
  );
  if (existing) {
    return { ok: false as const, error: "USERNAME_TAKEN" as const };
  }

  const email = input.email.trim().toLowerCase();
  const emailTaken = users.find((u) => (u.email ?? "").trim().toLowerCase() === email);
  if (emailTaken) return { ok: false as const, error: "EMAIL_TAKEN" as const };

  const user: UserRecord = {
    id: crypto.randomUUID(),
    username: input.username,
    passwordHash: input.passwordHash,
    email,
    balance: 0,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeAllUsers(users);
  return { ok: true as const, user };
}

export async function updateUserById(
  id: string,
  patch: Partial<Pick<UserRecord, "username" | "passwordHash" | "email" | "balance">>,
) {
  const users = await readAllUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return { ok: false as const, error: "USER_NOT_FOUND" as const };

  const nextUsername = patch.username ?? users[idx]!.username;
  const conflict = users.find(
    (u) => u.id !== id && u.username.toLowerCase() === nextUsername.toLowerCase(),
  );
  if (conflict) return { ok: false as const, error: "USERNAME_TAKEN" as const };

  const nextEmailRaw = patch.email ?? users[idx]!.email ?? "";
  const nextEmail = nextEmailRaw.trim().toLowerCase();
  if (nextEmail) {
    const emailConflict = users.find(
      (u) => u.id !== id && (u.email ?? "").trim().toLowerCase() === nextEmail,
    );
    if (emailConflict) return { ok: false as const, error: "EMAIL_TAKEN" as const };
  }

  const updated: UserRecord = {
    ...users[idx]!,
    ...patch,
    email: nextEmailRaw,
  };
  users[idx] = updated;
  await writeAllUsers(users);
  return { ok: true as const, user: updated };
}

