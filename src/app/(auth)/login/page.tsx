"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = search.get("next") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Welcome back. Keep it simple.
        </p>
      </div>

      <form
        className="space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ username, password }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              setError(data?.error ?? "LOGIN_FAILED");
              return;
            }
            router.refresh();
            router.push(nextPath);
          });
        }}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">Username</label>
          <input
            className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <input
            className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <button
          className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        No account?{" "}
        <Link className="text-zinc-950 underline dark:text-zinc-50" href="/signup">
          Create one
        </Link>
        .
      </p>
    </div>
  );
}

