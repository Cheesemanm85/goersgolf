import type { TeamRecord } from "@/lib/teamStore";

export function applySubstituteToGolfers(
  team: Pick<TeamRecord, "golfers" | "substitute">,
) {
  const golfers = Array.isArray(team.golfers) ? team.golfers.slice() : [];
  const sub = (team as any).substitute ?? null;
  if (!sub) return golfers;
  return golfers.map((g) =>
    g.rank === sub.outRank
      ? { rank: sub.inRank, name: sub.inName, playerId: sub.inPlayerId }
      : g,
  );
}

export function isTeamSelectionValid(team: Pick<TeamRecord, "golfers" | "captainRank" | "substitute">) {
  const golfers = applySubstituteToGolfers(team);
  if (golfers.length !== 5) return false;

  const ranks = golfers.map((g) => g.rank);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== 5) return false;

  const top10 = golfers.filter((g) => g.rank <= 10).length;
  if (top10 > 2) return false;

  const totalRank = golfers.reduce((acc, g) => acc + g.rank, 0);
  if (totalRank <= 70) return false;

  if (typeof team.captainRank !== "number") return false;
  if (!uniqueRanks.has(team.captainRank)) return false;

  return true;
}

export function validateGolfersAgainstRules(input: {
  golfers: { rank: number; name: string; playerId?: string }[];
  captainRank: number | null;
}) {
  const golfers = Array.isArray(input.golfers) ? input.golfers : [];
  if (golfers.length !== 5) return { ok: false as const, error: "NEED_5_UNIQUE_PLAYERS" as const };
  const ranks = golfers.map((g) => g.rank);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== 5) return { ok: false as const, error: "NEED_5_UNIQUE_PLAYERS" as const };

  const top10 = golfers.filter((g) => g.rank <= 10).length;
  if (top10 > 2) return { ok: false as const, error: "MAX_2_TOP10" as const };

  const totalRank = golfers.reduce((acc, g) => acc + g.rank, 0);
  if (totalRank <= 70) return { ok: false as const, error: "RANK_SUM_TOO_LOW" as const };

  if (typeof input.captainRank !== "number") return { ok: false as const, error: "CAPTAIN_NOT_SELECTED" as const };
  if (!uniqueRanks.has(input.captainRank)) return { ok: false as const, error: "CAPTAIN_NOT_SELECTED" as const };

  return { ok: true as const, totalRank };
}

