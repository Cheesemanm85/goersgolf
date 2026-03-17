import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="py-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Goers Golf
          </h1>
          <p className="max-w-2xl text-zinc-600 dark:text-zinc-300">
            Create a team, track your league table live, and view the latest PGA
            tournament rankings, give each other grief.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {session ? (
            <>
              <Link
                href="/team"
                className="inline-flex items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Go to your team
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-950"
              >
                View dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-950"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
