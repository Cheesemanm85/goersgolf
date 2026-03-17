"use client";

import { useMemo, useState } from "react";

type Row = {
  rank: number;
  userId: string;
  teamName: string;
  isValid: boolean;
  points: number;
  rounds: (number | null)[];
  players: {
    rank: number;
    name: string;
    replacedBy?: { rank: number; name: string } | null;
    total: number | null;
    rounds: (number | null)[];
  }[];
};

export function MajorLeagueTable(props: {
  rows: Row[];
  currentUserId: string;
  canRevealAllTeams: boolean;
}) {
  const [openTeams, setOpenTeams] = useState<Set<string>>(() => new Set());

  const flatRows = useMemo(() => {
    const out: Array<
      | { kind: "team"; key: string; row: Row }
      | { kind: "player"; key: string; teamKey: string; player: Row["players"][number] }
    > = [];

    for (const r of props.rows) {
      const teamKey = `${r.rank}-${r.teamName}`;
      out.push({ kind: "team", key: `team-${teamKey}`, row: r });
      const canReveal =
        props.canRevealAllTeams || r.userId === props.currentUserId;
      if (canReveal && openTeams.has(teamKey)) {
        for (const p of r.players) {
          out.push({
            kind: "player",
            key: `player-${teamKey}-${p.rank}-${p.name}`,
            teamKey,
            player: p,
          });
        }
      }
    }

    return out;
  }, [openTeams, props.rows]);

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium text-right">R1</th>
            <th className="px-3 py-2 font-medium text-right">R2</th>
            <th className="px-3 py-2 font-medium text-right">R3</th>
            <th className="px-3 py-2 font-medium text-right">R4</th>
            <th className="px-3 py-2 font-medium text-right">Total</th>
          </tr>
        </thead>

        <tbody>
          {flatRows.map((item) => {
            if (item.kind === "team") {
              const r = item.row;
              const teamKey = `${r.rank}-${r.teamName}`;
              const isOpen = openTeams.has(teamKey);
              const canReveal =
                props.canRevealAllTeams || r.userId === props.currentUserId;
              return (
                <tr
                  key={item.key}
                  className="border-t border-zinc-200/70 hover:bg-zinc-50/60 dark:border-zinc-800/70 dark:hover:bg-zinc-950/40"
                >
                  <td className="px-3 py-2">{r.rank}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left"
                      disabled={!canReveal}
                      onClick={() => {
                        if (!canReveal) return;
                        setOpenTeams((prev) => {
                          const next = new Set(prev);
                          if (next.has(teamKey)) next.delete(teamKey);
                          else next.add(teamKey);
                          return next;
                        });
                      }}
                    >
                      <span
                        className={[
                          "font-medium text-zinc-900 dark:text-zinc-100",
                          r.isValid ? "" : "line-through text-zinc-500 dark:text-zinc-400",
                        ].join(" ")}
                      >
                        {r.teamName}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {canReveal ? (isOpen ? "Hide players" : "Show players") : "Hidden until start"}
                      </span>
                    </button>
                  </td>
                  {r.rounds.map((v, idx) => (
                    <td
                      key={idx}
                      className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300"
                    >
                      {r.points === Number.MAX_SAFE_INTEGER ? "—" : v ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {r.points === Number.MAX_SAFE_INTEGER ? "—" : r.points}
                  </td>
                </tr>
              );
            }

            const p = item.player;
            return (
              <tr
                key={item.key}
                className="bg-zinc-50/40 text-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
              >
                <td className="px-3 py-2 tabular-nums text-zinc-500 dark:text-zinc-400">
                  {p.rank}
                </td>
                <td className="px-3 py-2">
                  <span className="text-zinc-500 dark:text-zinc-400">↳</span>{" "}
                  {p.replacedBy ? (
                    <span>
                      <span className="line-through text-zinc-500 dark:text-zinc-400">{p.name}</span>{" "}
                      <span className="text-zinc-500 dark:text-zinc-400">→</span>{" "}
                      {p.replacedBy.name}
                    </span>
                  ) : (
                    p.name
                  )}
                </td>
                {p.rounds.map((v, idx) => (
                  <td
                    key={idx}
                    className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300"
                  >
                    {v ?? "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.total ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

