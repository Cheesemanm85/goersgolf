import { NextResponse } from "next/server";
import { requireSession } from "@/lib/requireSession";
import type { MajorKey } from "@/lib/majors";
import { getTeamForUserMajor, setSubstituteForUserMajor } from "@/lib/teamStore";
import { fetchMajorLeaderboardShots } from "@/lib/leaderboard";
import { isAnyMajorInProgress } from "@/lib/tournamentLock";
import { validateGolfersAgainstRules } from "@/lib/teamRules";

function isMajorKey(v: unknown): v is MajorKey {
  return v === "masters" || v === "pga" || v === "usopen" || v === "open";
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  if (!isAnyMajorInProgress()) {
    return NextResponse.json({ ok: false, error: "SUB_ONLY_DURING_MAJOR" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("INVALID_JSON");
  }
  if (!body || typeof body !== "object") return badRequest("INVALID_BODY");

  const majorRaw = (body as any).major;
  const majorKey: MajorKey = isMajorKey(majorRaw) ? majorRaw : "masters";
  const year = typeof (body as any).year === "string" ? (body as any).year : undefined;

  const outRank = Number((body as any).outRank);
  const outName = String((body as any).outName ?? "").trim();
  const outPlayerId = typeof (body as any).outPlayerId === "string" ? (body as any).outPlayerId.trim() : undefined;
  const inRank = Number((body as any).inRank);
  const inName = String((body as any).inName ?? "").trim();
  const inPlayerId = typeof (body as any).inPlayerId === "string" ? (body as any).inPlayerId.trim() : undefined;

  if (!Number.isFinite(outRank) || outRank <= 0) return badRequest("INVALID_OUT_PLAYER");
  if (!Number.isFinite(inRank) || inRank <= 0) return badRequest("INVALID_IN_PLAYER");
  if (!outName || !inName) return badRequest("INVALID_PLAYER_NAMES");

  const team = await getTeamForUserMajor(session.sub, majorKey);
  if (!team) return NextResponse.json({ ok: false, error: "TEAM_NOT_FOUND" }, { status: 404 });

  if (team.substitute) {
    return NextResponse.json({ ok: false, error: "SUB_ALREADY_USED" }, { status: 409 });
  }

  const hasOut = (team.golfers ?? []).some((g) => g.rank === outRank);
  if (!hasOut) return badRequest("OUT_NOT_IN_TEAM");

  const hasInAlready = (team.golfers ?? []).some((g) => g.rank === inRank);
  if (hasInAlready) return badRequest("IN_ALREADY_IN_TEAM");

  const nextGolfers = (team.golfers ?? []).map((g) =>
    g.rank === outRank ? { rank: inRank, name: inName, playerId: inPlayerId } : g,
  );
  const nextCaptainRank =
    team.captainRank === outRank ? inRank : team.captainRank;
  const rulesOk = validateGolfersAgainstRules({
    golfers: nextGolfers,
    captainRank: nextCaptainRank,
  });
  if (!rulesOk.ok) {
    return NextResponse.json({ ok: false, error: rulesOk.error }, { status: 400 });
  }

  // Only allow between rounds: we approximate by requiring that at least one
  // round has completed and no next-round scores exist yet for the field.
  const lb = await fetchMajorLeaderboardShots(majorKey, { year, allowEmptyIfMissing: false });
  const afterRound = lb.maxRoundSeen;
  if (!afterRound || afterRound < 1 || afterRound > 4) {
    return NextResponse.json({ ok: false, error: "NOT_BETWEEN_ROUNDS" }, { status: 403 });
  }

  const saved = await setSubstituteForUserMajor({
    userId: session.sub,
    majorKey,
    substitute: {
      outRank,
      outName,
      outPlayerId,
      inRank,
      inName,
      inPlayerId,
      afterRound,
      madeAt: new Date().toISOString(),
    },
  });
  if (!saved.ok) return NextResponse.json({ ok: false, error: saved.error }, { status: 404 });

  return NextResponse.json({ ok: true, team: saved.team });
}

