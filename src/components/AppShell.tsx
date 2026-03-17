import Link from "next/link";
import { getSession } from "@/lib/session";
import { LogoutButton } from "@/components/LogoutButton";

export async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="min-h-dvh bg-white text-zinc-950 dark:bg-black dark:text-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/70 backdrop-blur dark:border-zinc-800/70 dark:bg-black/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight"
            >
              Goers Golf
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
              <Link className="hover:text-zinc-950 dark:hover:text-white" href="/team">
                Team
              </Link>
              <Link className="hover:text-zinc-950 dark:hover:text-white" href="/account">
                Account
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                <span className="hidden text-sm text-zinc-600 dark:text-zinc-300 sm:inline">
                  {session.username}
                </span>
                <LogoutButton />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  href="/login"
                >
                  Sign in
                </Link>
                <Link
                  className="rounded-md bg-zinc-950 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  href="/signup"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}

