"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { MajorKey } from "@/lib/majors";

type Team = {
  id: string;
  name: string;
  golfers: { rank: number; name: string; playerId?: string }[];
  captainRank: number | null;
};

const MAJORS: { key: MajorKey; label: string }[] = [
  { key: "masters", label: "Masters" },
  { key: "pga", label: "PGA" },
  { key: "usopen", label: "U.S. Open" },
  { key: "open", label: "Open" },
];

export function TeamClient(props: { initialTeam: Team | null; isLocked: boolean; majorKey: MajorKey }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [team, setTeam] = useState<Team | null>(props.initialTeam);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const year = sp.get("year") ?? undefined;

  const hasTeam = !!team;
  const header = useMemo(() => (hasTeam ? "Your team" : "Create your team"), [hasTeam]);

  useEffect(() => {
    setTeam(props.initialTeam);
  }, [props.initialTeam]);

  const [players, setPlayers] = useState<{ rank: number; name: string; playerId?: string }[]>([]);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedRanks, setSelectedRanks] = useState<number[]>(
    props.initialTeam?.golfers?.map((g) => g.rank) ?? [],
  );
  const [captainRank, setCaptainRank] = useState<number | null>(
    props.initialTeam?.captainRank ?? null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [subOutRank, setSubOutRank] = useState<number | null>(null);
  const [subInRank, setSubInRank] = useState<number | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [isSubbing, startSubbing] = useTransition();

  const isSaved = !!(props.initialTeam && props.initialTeam.golfers.length === 5 && props.initialTeam.captainRank);
  const [isEditing, setIsEditing] = useState(() => !isSaved);

  useEffect(() => {
    setSelectedRanks(props.initialTeam?.golfers?.map((g) => g.rank) ?? []);
    setCaptainRank(props.initialTeam?.captainRank ?? null);
    const saved = !!(
      props.initialTeam &&
      props.initialTeam.golfers.length === 5 &&
      props.initialTeam.captainRank
    );
    setIsEditing(saved ? false : true);
  }, [props.initialTeam?.golfers, props.initialTeam?.captainRank]);

  useEffect(() => {
    if (props.isLocked) setIsEditing(false);
  }, [props.isLocked]);

  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    setPlayersError(null);

    (async () => {
      const res = await fetch("/api/owgr");
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok || !data?.ok) {
        setPlayersError(data?.error ?? "OWGR_UNAVAILABLE");
        return;
      }
      setPlayers(Array.isArray(data.players) ? data.players : []);
    })();

    return () => {
      cancelled = true;
    };
  }, [team?.id]);

  const selectedPlayers = useMemo(() => {
    const set = new Set(selectedRanks);
    return players.filter((p) => set.has(p.rank));
  }, [players, selectedRanks]);

  const subInCandidates = useMemo(() => {
    const chosen = new Set(selectedRanks);
    return players.filter((p) => !chosen.has(p.rank)).slice(0, 200);
  }, [players, selectedRanks]);

  const selectedCount = selectedRanks.length;
  const top10Count = useMemo(
    () => selectedRanks.filter((r) => r <= 10).length,
    [selectedRanks],
  );
  const totalRank = useMemo(
    () => selectedRanks.reduce((acc, r) => acc + r, 0),
    [selectedRanks],
  );

  const constraints = useMemo(() => {
    const need5 = selectedCount === 5;
    const top10Ok = top10Count <= 2;
    const sumOk = totalRank > 70;
    const captainOk = captainRank !== null && selectedRanks.includes(captainRank);
    return { need5, top10Ok, sumOk, captainOk };
  }, [captainRank, selectedCount, selectedRanks, top10Count, totalRank]);

  const canSave =
    constraints.need5 && constraints.top10Ok && constraints.sumOk && constraints.captainOk;

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players.slice(0, 200);
    return players
      .filter((p) => p.name.toLowerCase().includes(q) || String(p.rank).includes(q))
      .slice(0, 200);
  }, [players, query]);

  function toggleRank(rank: number) {
    if (!isEditing) return;
    setSaveError(null);
    setSelectedRanks((prev) => {
      const has = prev.includes(rank);
      if (has) {
        const next = prev.filter((r) => r !== rank);
        if (captainRank === rank) setCaptainRank(null);
        return next;
      }
      if (prev.length >= 5) return prev;
      return [...prev, rank].sort((a, b) => a - b);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{header}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {hasTeam
            ? props.isLocked
              ? "Your team is locked while a major is in progress."
              : isEditing
                ? "Select 5 players, choose a captain, then save."
                : "Saved. You can edit until a major starts."
            : "Pick a team name to get started."}
        </p>
        {hasTeam && props.isLocked ? (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Tournament Started
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {MAJORS.map((m) => {
          const active = m.key === props.majorKey;
          const year = sp.get("year");
          const href = `/team?major=${encodeURIComponent(m.key)}${year ? `&year=${encodeURIComponent(year)}` : ""}`;
          return (
            <Link
              key={m.key}
              href={href}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                active
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                  : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-950",
              ].join(" ")}
            >
              {m.label}
            </Link>
          );
        })}
      </div>

      {team ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{team.name}</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Selected: <span className="tabular-nums">{selectedCount}</span>/5 · Top 10:{" "}
                  <span className="tabular-nums">{top10Count}</span>/2 · Total rank:{" "}
                  <span className="tabular-nums">{totalRank}</span> (&gt; 70)
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isSaved && !isEditing ? (
                  <button
                    type="button"
                    className="rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    disabled={props.isLocked}
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      disabled={!isEditing}
                      onClick={() => {
                        setSaveError(null);
                        setSelectedRanks([]);
                        setCaptainRank(null);
                      }}
                    >
                      Clear
                    </button>
                    {isSaved ? (
                      <button
                        type="button"
                        className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        disabled={!isEditing}
                        onClick={() => {
                          setSaveError(null);
                          setSelectedRanks(props.initialTeam?.golfers?.map((g) => g.rank) ?? []);
                          setCaptainRank(props.initialTeam?.captainRank ?? null);
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                      disabled={isSaving || !canSave || !isEditing || props.isLocked}
                      onClick={() => {
                        setSaveError(null);
                        startSaving(async () => {
                          const golfers = selectedPlayers
                            .slice()
                            .sort((a, b) => a.rank - b.rank);
                          const res = await fetch("/api/team", {
                            method: "PUT",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              major: props.majorKey,
                              golfers,
                              captainRank,
                            }),
                          });
                          const data = await res.json().catch(() => null);
                          if (!res.ok) {
                            setSaveError(data?.error ?? "SAVE_FAILED");
                            return;
                          }
                          setTeam(data.team);
                          setIsEditing(false);
                          router.push("/dashboard");
                        });
                      }}
                    >
                      {isSaving ? "Saving…" : "Save team"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Rules
                </div>
                <ul className="mt-1 space-y-1 text-zinc-700 dark:text-zinc-200">
                  <li className={constraints.need5 ? "" : "text-zinc-500"}>
                    Pick exactly 5 players
                  </li>
                  <li className={constraints.top10Ok ? "" : "text-red-600 dark:text-red-400"}>
                    Max 2 players in the top 10
                  </li>
                  <li className={constraints.sumOk ? "" : "text-red-600 dark:text-red-400"}>
                    Total world-ranking number must be over 70
                  </li>
                  <li className={constraints.captainOk ? "" : "text-red-600 dark:text-red-400"}>
                    Choose a captain from your 5
                  </li>
                </ul>
              </div>

              <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Captain
                </div>
                <div className="mt-1 space-y-1">
                  {selectedRanks.length === 0 ? (
                    <div className="text-zinc-600 dark:text-zinc-300">
                      Select players to choose a captain.
                    </div>
                  ) : (
                    selectedPlayers
                      .slice()
                      .sort((a, b) => a.rank - b.rank)
                      .map((p) => (
                        <label
                          key={p.rank}
                          className="flex items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-950"
                        >
                          <span className="truncate">
                            <span className="mr-2 inline-block w-7 tabular-nums text-zinc-500 dark:text-zinc-400">
                              {p.rank}
                            </span>
                            {p.name}
                          </span>
                          <input
                            type="radio"
                            name="captain"
                            checked={captainRank === p.rank}
                            onChange={() => setCaptainRank(p.rank)}
                            disabled={!isEditing || props.isLocked}
                          />
                        </label>
                      ))
                  )}
                </div>
              </div>
            </div>

            {saveError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{saveError}</p>
            ) : null}
          </section>

          {props.isLocked ? (
            <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Substitute</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  You can make <span className="font-medium">one</span> substitute between rounds.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Replace</span>
                  <select
                    className="h-10 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-black"
                    value={subOutRank ?? ""}
                    onChange={(e) => setSubOutRank(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select player</option>
                    {selectedPlayers
                      .slice()
                      .sort((a, b) => a.rank - b.rank)
                      .map((p) => (
                        <option key={p.rank} value={p.rank}>
                          {p.rank} · {p.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">With</span>
                  <select
                    className="h-10 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-black"
                    value={subInRank ?? ""}
                    onChange={(e) => setSubInRank(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select replacement</option>
                    {subInCandidates.map((p) => (
                      <option key={p.rank} value={p.rank}>
                        {p.rank} · {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Uses OWGR list; only 200 options shown (search above to narrow).
                  </span>
                </label>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  disabled={!subOutRank || !subInRank || isSubbing}
                  onClick={() => {
                    setSubError(null);
                    startSubbing(async () => {
                      const out = selectedPlayers.find((p) => p.rank === subOutRank);
                      const inn = players.find((p) => p.rank === subInRank);
                      if (!out || !inn) {
                        setSubError("Please pick both players.");
                        return;
                      }
                      const res = await fetch("/api/team/substitute", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          major: props.majorKey,
                          year,
                          outRank: out.rank,
                          outName: out.name,
                          outPlayerId: out.playerId,
                          inRank: inn.rank,
                          inName: inn.name,
                          inPlayerId: inn.playerId,
                        }),
                      });
                      const data = await res.json().catch(() => null);
                      if (!res.ok || !data?.ok) {
                        setSubError(data?.error ?? "SUB_FAILED");
                        return;
                      }
                      setSubError(null);
                      router.push(`/dashboard?major=${encodeURIComponent(props.majorKey)}`);
                    });
                  }}
                >
                  {isSubbing ? "Submitting…" : "Make substitute"}
                </button>
                {subError ? (
                  <div className="text-sm text-red-600 dark:text-red-400">{subError}</div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">OWGR current ranking</h3>
              <div className="flex items-center gap-2">
                <input
                  className="w-64 max-w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
                  placeholder="Search name or rank…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Link
                  href="https://www.owgr.com/current-world-ranking"
                  target="_blank"
                  className="text-xs text-zinc-500 underline dark:text-zinc-400"
                >
                  Source
                </Link>
              </div>
            </div>

            {playersError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                Couldn’t load OWGR right now ({playersError}). Try again soon.
              </p>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pick</th>
                    <th className="px-3 py-2 font-medium">Rank</th>
                    <th className="px-3 py-2 font-medium">Golfer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((p) => {
                    const checked = selectedRanks.includes(p.rank);
                    const atLimit = selectedRanks.length >= 5 && !checked;
                    return (
                      <tr
                        key={p.rank}
                        className="border-t border-zinc-200/70 dark:border-zinc-800/70"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={atLimit || !isEditing || props.isLocked}
                            onChange={() => toggleRank(p.rank)}
                          />
                        </td>
                        <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">
                          {p.rank}
                        </td>
                        <td className="px-3 py-2">{p.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Showing up to 200 results for performance.
            </p>
          </section>
        </div>
      ) : (
        <form
          className="space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await fetch("/api/team", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ major: props.majorKey, name }),
              });
              const data = await res.json().catch(() => null);
              if (!res.ok) {
                setError(data?.error ?? "CREATE_TEAM_FAILED");
                return;
              }
              setTeam(data.team);
              setName("");
            });
          }}
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Team name</label>
            <input
              className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              maxLength={32}
              placeholder="e.g. Fairway Finders"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              3–32 characters.
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
            {isPending ? "Creating…" : "Create team"}
          </button>
        </form>
      )}
    </div>
  );
}

