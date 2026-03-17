"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export function ResetPasswordClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = useMemo(() => token && password.length >= 8, [password.length, token]);

  function onSubmit() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setMessage(json?.error ?? "RESET_FAILED");
        return;
      }
      setMessage("Password updated. Redirecting to sign in…");
      setTimeout(() => router.push("/login"), 800);
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Set a new password for your account.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">New password</label>
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="text-xs text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <input
            className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            disabled={isPending}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">8+ characters.</p>
        </div>

        {message ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || isPending}
          className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {isPending ? "Updating…" : "Update password"}
        </button>
      </div>
    </div>
  );
}

