"use client";

import { useEffect, useMemo, useState } from "react";

function formatLocal(dt: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export function TournamentCountdown(props: { startAtIso: string }) {
  const start = useMemo(() => new Date(props.startAtIso), [props.startAtIso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Update every minute; the UI only needs hours precision.
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ms = start.getTime() - now;
  const hours = Math.ceil(ms / (1000 * 60 * 60));

  const label =
    Number.isFinite(start.getTime()) ? formatLocal(start) : "—";

  if (!Number.isFinite(start.getTime())) {
    return (
      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        Starts: —
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
      <span>
        Starts: <span className="text-zinc-900 dark:text-zinc-100">{label}</span>
      </span>
      <span className="text-zinc-400 dark:text-zinc-600">·</span>
      <span>
        {ms > 0 ? (
          <>
            In{" "}
            <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
              {hours}
            </span>{" "}
            hour{hours === 1 ? "" : "s"}
          </>
        ) : (
          <span className="text-zinc-900 dark:text-zinc-100">In progress / started</span>
        )}
      </span>
    </div>
  );
}

