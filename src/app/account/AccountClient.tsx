"use client";

import { useMemo, useState, useTransition } from "react";

type AccountProfile = {
  id: string;
  username: string;
  email: string;
  balance: number;
  createdAt: string;
};

export function AccountClient(props: { initial: AccountProfile }) {
  const [username, setUsername] = useState(props.initial.username);
  const [email, setEmail] = useState(props.initial.email ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const changed = useMemo(() => {
    return (
      username.trim() !== props.initial.username ||
      email.trim() !== (props.initial.email ?? "")
    );
  }, [email, props.initial.email, props.initial.username, username]);

  function onSave() {
    const nextUsername = username.trim();
    const nextEmail = email.trim();
    const wants = window.confirm("Save these account changes?");
    if (!wants) return;

    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: nextUsername,
          email: nextEmail,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setMessage(`Could not save: ${json?.error ?? "UNKNOWN_ERROR"}`);
        return;
      }

      setMessage(
        json.emailSent === true
          ? "Saved. Email sent."
          : json.emailSent === false
            ? "Saved. Email could not be sent (SMTP not configured or failed)."
            : "Saved.",
      );
    });
  }

  function onResetPassword() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setResetMessage("Add an email address first, then try again.");
      return;
    }
    const wants = window.confirm("Email a password reset link to this address?");
    if (!wants) return;

    setResetMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setResetMessage(json?.error ?? "RESET_REQUEST_FAILED");
        return;
      }
      setResetMessage(
        json.emailSent === true
          ? "Reset link emailed."
          : json.emailSent === false
            ? "Could not send reset email (SMTP not configured or failed)."
            : "If that email is registered, a reset link was sent.",
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Update your details below.
        </p>
      </div>

      <div className="grid gap-4 sm:max-w-lg">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:ring-2 dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:ring-white/10"
            placeholder="username"
            autoComplete="username"
            disabled={isPending}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:ring-2 dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:ring-white/10"
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isPending}
          />
        </label>

        <div className="grid gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Balance</span>
          <div className="h-10 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 flex items-center dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            {Number.isFinite(props.initial.balance) ? props.initial.balance : 0}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!changed || isPending}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
        {message ? <div className="text-sm text-zinc-600 dark:text-zinc-300">{message}</div> : null}
      </div>

      <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800 sm:max-w-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Reset password</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              We’ll email you a reset link.
            </div>
          </div>
          <button
            type="button"
            onClick={onResetPassword}
            disabled={isPending}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-950"
          >
            Email reset link
          </button>
        </div>
        {resetMessage ? (
          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{resetMessage}</div>
        ) : null}
      </div>
    </div>
  );
}

