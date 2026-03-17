import { getSession } from "@/lib/session";
import { MajorTabs } from "@/app/dashboard/MajorTabs";
import { computeMajorLeagueTable } from "@/lib/league";
import { getMajor, type MajorKey } from "@/lib/majors";
import { MajorLeagueTable } from "@/app/dashboard/MajorLeagueTable";
import { fetchMajorLeaderboardTop } from "@/lib/leaderboard";
import { TournamentCountdown } from "@/app/dashboard/TournamentCountdown";
import { YearSelect } from "@/app/dashboard/YearSelect";
import { isAnyMajorInProgress } from "@/lib/tournamentLock";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goers Golf",
};

function isMajorKey(v: unknown): v is MajorKey {
  return v === "masters" || v === "pga" || v === "usopen" || v === "open";
}

export default async function DashboardPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const sp = (await props.searchParams) ?? {};
  const defaultYear = String(new Date().getFullYear());
  const majorKeyRaw = Array.isArray(sp.major) ? sp.major[0] : sp.major;
  const majorKey: MajorKey = isMajorKey(majorKeyRaw) ? majorKeyRaw : "masters";
  const major = getMajor(majorKey);
  const yearRaw = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  const year = typeof yearRaw === "string" && /^[0-9]{4}$/.test(yearRaw) ? yearRaw : defaultYear;
  const canRevealAllTeams = isAnyMajorInProgress();
  const years = [0, 1, 2, 3, 4].map((d) => Number(defaultYear) - d);

  let majorLeague:
    | { ok: true; rows: Awaited<ReturnType<typeof computeMajorLeagueTable>> }
    | { ok: false; error: string };
  try {
    const rows = await computeMajorLeagueTable(majorKey, { year, allowEmptyIfMissing: true });
    const sanitized = rows.map((r) => {
      if (canRevealAllTeams || r.userId === session?.sub) return r;
      return { ...r, players: [] };
    });
    majorLeague = { ok: true, rows: sanitized };
  } catch (e: unknown) {
    majorLeague = { ok: false, error: e instanceof Error ? e.message : "LEAGUE_ERROR" };
  }

  let majorsLeaderboard:
    | { ok: true; data: Awaited<ReturnType<typeof fetchMajorLeaderboardTop>> }
    | { ok: false; error: string };
  try {
    const data = await fetchMajorLeaderboardTop(majorKey, { year, allowEmptyIfMissing: true });
    majorsLeaderboard = { ok: true, data };
  } catch (e: unknown) {
    majorsLeaderboard = {
      ok: false,
      error: e instanceof Error ? e.message : "LEADERBOARD_ERROR",
    };
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MajorTabs />
          <YearSelect years={years} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Course:{" "}
            <span className="text-zinc-900 dark:text-zinc-100">
              {majorsLeaderboard.ok ? majorsLeaderboard.data.courseName ?? "—" : "—"}
            </span>
          </div>
          <TournamentCountdown startAtIso={major.startAtIso} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {major.label} league table
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Live</span>
          </div>

          {majorLeague.ok && session ? (
            <MajorLeagueTable
              rows={majorLeague.rows}
              currentUserId={session.sub}
              canRevealAllTeams={canRevealAllTeams}
            />
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {major.label} leaderboard
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Live</span>
          </div>

          {majorsLeaderboard.ok ? (
            <div className="mt-4 rounded-md border border-zinc-200 dark:border-zinc-800">
              <div className="max-h-[22rem] overflow-auto">
                <table className="min-w-[520px] w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Pos</th>
                      <th className="px-3 py-2 font-medium">Player</th>
                      <th className="px-3 py-2 font-medium text-right">To par</th>
                      <th className="px-3 py-2 font-medium text-right">Strokes</th>
                      <th className="px-3 py-2 font-medium text-right">Thru</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(majorsLeaderboard.data.entries.length
                      ? majorsLeaderboard.data.entries
                      : Array.from({ length: 10 })
                    ).map((r: any, idx: number) => (
                        <tr
                          key={`${idx}-${r?.pos ?? "—"}-${r?.player ?? "—"}`}
                          className="border-t border-zinc-200/70 dark:border-zinc-800/70"
                        >
                          <td className="px-3 py-2">{r?.pos ?? "—"}</td>
                          <td className="px-3 py-2">{r?.player ?? "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                            {r?.totalToPar ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                            {r?.totalStrokes ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                            {r?.thru ?? "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {majorsLeaderboard.data.entries.length
                  ? "Showing all players; scroll to view more. (Top ~10 rows visible.)"
                  : "No data for this year. Showing blank rows to preserve layout."}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-zinc-200 dark:border-zinc-800">
              <div className="max-h-[22rem] overflow-auto">
                <table className="min-w-[520px] w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Pos</th>
                      <th className="px-3 py-2 font-medium">Player</th>
                      <th className="px-3 py-2 font-medium text-right">To par</th>
                      <th className="px-3 py-2 font-medium text-right">Strokes</th>
                      <th className="px-3 py-2 font-medium text-right">Thru</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <tr
                        key={idx}
                        className="border-t border-zinc-200/70 dark:border-zinc-800/70"
                      >
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">—</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">—</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                No data for this year. Showing blank rows to preserve layout.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

