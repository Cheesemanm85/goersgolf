import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";

export async function requireSession() {
  const token = (await cookies()).get(getSessionCookieName())?.value;
  if (!token) return null;
  return verifySession(token);
}

