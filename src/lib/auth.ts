import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "gf_session";

function getSecretKey() {
  const secret =
    process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me-immediately";
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  username: string;
};

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, getSecretKey());
  const sub = payload.sub;
  const username = payload.username;

  if (typeof sub !== "string" || typeof username !== "string") return null;
  return { sub, username } satisfies SessionPayload;
}

