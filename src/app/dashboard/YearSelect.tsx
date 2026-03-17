"use client";

import { useRouter, useSearchParams } from "next/navigation";

function isYear(v: string | null) {
  return !!v && /^[0-9]{4}$/.test(v);
}

export function YearSelect(props: { years: number[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const currentYear = String(new Date().getFullYear());
  const current = isYear(sp.get("year")) ? sp.get("year")! : currentYear;

  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span>Year</span>
      <select
        className="rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs text-zinc-700 outline-none hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-950"
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          next.set("year", e.target.value);
          router.push(`/dashboard?${next.toString()}`);
        }}
      >
        {props.years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}

