"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { majors, type MajorKey } from "@/lib/majors";

function isMajorKey(v: string | null): v is MajorKey {
  return v === "masters" || v === "pga" || v === "usopen" || v === "open";
}

export function MajorTabs() {
  const sp = useSearchParams();
  const active = isMajorKey(sp.get("major")) ? (sp.get("major") as MajorKey) : "masters";
  const year = sp.get("year");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {majors.map((m) => {
        const isActive = m.key === active;
        const qs = new URLSearchParams();
        qs.set("major", m.key);
        if (year) qs.set("year", year);
        return (
          <Link
            key={m.key}
            href={`/dashboard?${qs.toString()}`}
            className={
              "rounded-full px-3 py-1.5 text-sm transition-colors " +
              (isActive
                ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-950")
            }
          >
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}

