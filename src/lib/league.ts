import { getAllTeamsForMajor, type TeamRecord } from "@/lib/teamStore";
import { fetchMajorLeaderboardShots } from "@/lib/leaderboard";
import type { MajorKey } from "@/lib/majors";
import { isTeamSelectionValid } from "@/lib/teamRules";

export type LeagueTableRow = {
  rank: number;
  userId: string;
  teamName: string;
  isValid: boolean;
  points: number; // total strokes (lower is better)
  rounds: (number | null)[]; // R1..R4 totals
  players: {
    rank: number;
    name: string;
    replacedBy?: { rank: number; name: string } | null;
    total: number | null;
    rounds: (number | null)[];
  }[];
  counted: number; // golfers counted
  missing: number; // golfers missing from leaderboard
};

export async function computeMajorLeagueTable(
  major: MajorKey,
  opts?: { year?: string; allowEmptyIfMissing?: boolean },
) {
  const teams = await getAllTeamsForMajor(major);
  const { byPlayerId, byName, roundsByPlayerId, roundsByName, missedCutByPlayerId, missedCutByName } =
    await fetchMajorLeaderboardShots(major, {
      year: opts?.year,
      allowEmptyIfMissing: opts?.allowEmptyIfMissing,
    });

  const rows = teams.map((t) =>
    scoreTeam(
      t,
      major,
      opts?.year,
      byPlayerId,
      byName,
      roundsByPlayerId,
      roundsByName,
      missedCutByPlayerId,
      missedCutByName,
    ),
  );
  rows.sort((a, b) => a.points - b.points || a.teamName.localeCompare(b.teamName));

  return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

function courseParFor(major: MajorKey, year: string | undefined) {
  // Used for missed-cut penalty: "4 over par" for missing rounds.
  const y = year ?? "";
  const map: Record<string, Partial<Record<MajorKey, number>>> = {
    "2024": { masters: 72, pga: 71, usopen: 70, open: 71 },
    "2026": { masters: 72, pga: 70, usopen: 70, open: 70 },
  };
  return map[y]?.[major] ?? 72;
}

function scoreTeam(
  team: TeamRecord,
  major: MajorKey,
  year: string | undefined,
  byPlayerId: Map<string, number>,
  byName: Map<string, number>,
  roundsByPlayerId: Map<string, (number | null)[]>,
  roundsByName: Map<string, (number | null)[]>,
  missedCutByPlayerId: Map<string, boolean>,
  missedCutByName: Map<string, boolean>,
): Omit<LeagueTableRow, "rank"> {
  const CUT_PENALTY = courseParFor(major, year) + 4;
  let points = 0;
  let counted = 0;
  let missing = 0;
  const rounds: (number | null)[] = [0, 0, 0, 0];
  const roundsSeen: boolean[] = [false, false, false, false];
  const players: LeagueTableRow["players"] = [];

  const sub = team.substitute ?? null;

  function getPlayerData(g: { rank: number; name: string; playerId?: string }) {
    const pid = g.playerId?.trim();
    const shotsById = pid ? byPlayerId.get(pid) : undefined;
    const shots =
      shotsById ??
      (g.name ? byName.get(g.name.toLowerCase()) : undefined);

    const playerRounds =
      (pid ? roundsByPlayerId.get(pid) : undefined) ??
      (g.name ? roundsByName.get(g.name.toLowerCase()) : undefined) ??
      null;

    const missedCut =
      (pid ? missedCutByPlayerId.get(pid) : undefined) ??
      (g.name ? missedCutByName.get(g.name.toLowerCase()) : undefined) ??
      false;

    const effectiveRounds: (number | null)[] = playerRounds
      ? (playerRounds as (number | null)[])
      : [null, null, null, null];

    return { shots, missedCut, effectiveRounds };
  }

  function scoreSegment(
    g: { rank: number; name: string; playerId?: string },
    roundMask: (idx: number) => boolean,
  ) {
    const { shots, missedCut, effectiveRounds } = getPlayerData(g);

    // We primarily use per-round strokes so we can split pre/post substitute.
    let segTotal = 0;
    let any = false;
    let missingRounds = 0;
    const segRounds: (number | null)[] = [null, null, null, null];

    for (let i = 0; i < 4; i++) {
      if (!roundMask(i)) continue;
      const v = effectiveRounds[i];
      if (typeof v === "number") {
        segRounds[i] = v;
        segTotal += v;
        any = true;
      } else if (missedCut) {
        segRounds[i] = CUT_PENALTY;
        segTotal += CUT_PENALTY;
        any = true;
        missingRounds += 1;
      } else {
        segRounds[i] = null;
        missingRounds += 1;
      }
    }

    // If we have no per-round info for this segment, fallback to total strokes if present.
    // (This still lets teams show something even if round breakdown is missing.)
    if (!any && typeof shots === "number") return { total: shots, rounds: segRounds };
    return { total: any ? segTotal : null, rounds: segRounds };
  }

  for (const g of team.golfers ?? []) {
    const isSubOut = sub && sub.outRank === g.rank;
    const preMask = (i: number) => (sub ? i < sub.afterRound : true); // rounds 0..afterRound-1
    const postMask = (i: number) => (sub ? i >= sub.afterRound : false); // rounds afterRound..3

    const pre = scoreSegment(g, isSubOut ? preMask : () => true);
    const post = isSubOut && sub
      ? scoreSegment(
          { rank: sub.inRank, name: sub.inName, playerId: sub.inPlayerId },
          postMask,
        )
      : { total: null, rounds: [null, null, null, null] as (number | null)[] };

    const effectiveTotal =
      (typeof pre.total === "number" ? pre.total : 0) + (typeof post.total === "number" ? post.total : 0);

    const hasAny =
      typeof pre.total === "number" || typeof post.total === "number" ||
      pre.rounds.some((v) => typeof v === "number") || post.rounds.some((v) => typeof v === "number");

    if (hasAny) {
      points += effectiveTotal;
      counted += 1;

      for (let i = 0; i < 4; i++) {
        const v = (pre.rounds[i] ?? 0) + (post.rounds[i] ?? 0);
        if (v > 0) {
          rounds[i] = (rounds[i] ?? 0) + v;
          roundsSeen[i] = true;
        }
      }
    } else {
      missing += 1;
    }

    players.push({
      rank: g.rank,
      name: g.name,
      replacedBy: isSubOut && sub ? { rank: sub.inRank, name: sub.inName } : null,
      total: hasAny ? effectiveTotal : null,
      rounds: [0, 1, 2, 3].map((i) => {
        const v = (pre.rounds[i] ?? 0) + (post.rounds[i] ?? 0);
        return v > 0 ? v : null;
      }),
    });
  }

  // If nothing matched, keep points very high so it sinks.
  if (counted === 0 && missing > 0) points = Number.MAX_SAFE_INTEGER;

  return {
    userId: team.userId,
    teamName: team.name,
    isValid: isTeamSelectionValid(team),
    points,
    rounds: rounds.map((v, idx) => (roundsSeen[idx] ? v : null)),
    players: players.sort((a, b) => a.rank - b.rank),
    counted,
    missing,
  };
}

