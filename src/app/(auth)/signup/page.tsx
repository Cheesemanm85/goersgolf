"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Choose a simple username. You can create your team next.
        </p>
      </div>

      <form
        className="space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await fetch("/api/auth/signup", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ username, email, password }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              setError(data?.error ?? "SIGNUP_FAILED");
              return;
            }
            router.refresh();
            router.push("/team");
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
            minLength={3}
            maxLength={24}
            pattern="^[a-zA-Z0-9_]+$"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            3–24 characters. Letters, numbers, underscore.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            maxLength={254}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <input
            className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            8+ characters.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <button
          className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Already have an account?{" "}
        <Link className="text-zinc-950 underline dark:text-zinc-50" href="/login">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}

