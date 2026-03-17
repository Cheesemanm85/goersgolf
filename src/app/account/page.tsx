import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/userStore";
import { AccountClient } from "@/app/account/AccountClient";

export const metadata: Metadata = {
  title: "Account · Goers Golf",
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  const user = await findUserById(session.sub);
  if (!user) redirect("/login?next=/account");

  return (
    <AccountClient
      initial={{
        id: user.id,
        username: user.username,
        email: user.email ?? "",
        balance: typeof user.balance === "number" ? user.balance : 0,
        createdAt: user.createdAt,
      }}
    />
  );
}

