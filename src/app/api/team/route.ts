import { NextResponse } from "next/server";
import { requireSession } from "@/lib/requireSession";
import {
  createTeamForUser,
  getTeamForUser,
  getTeamForUserMajor,
  saveSelectionForUser,
} from "@/lib/teamStore";
import { isAnyMajorInProgress } from "@/lib/tournamentLock";
import type { MajorKey } from "@/lib/majors";

function isMajorKey(v: unknown): v is MajorKey {
  return v === "masters" || v === "pga" || v === "usopen" || v === "open";
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const url = new URL(req.url);
  const majorRaw = url.searchParams.get("major");
  const majorKey: MajorKey = isMajorKey(majorRaw) ? majorRaw : "masters";

  const team = await getTeamForUserMajor(session.sub, majorKey);
  return NextResponse.json({ ok: true, team });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const name = typeof (body as any)?.name === "string" ? (body as any).name.trim() : "";
  const majorRaw = (body as any)?.major;
  const majorKey: MajorKey = isMajorKey(majorRaw) ? majorRaw : "masters";
  if (name.length < 3 || name.length > 32) {
    return NextResponse.json({ ok: false, error: "TEAM_NAME_LENGTH" }, { status: 400 });
  }

  const created = await createTeamForUser({ userId: session.sub, majorKey, name });
  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, team: created.team });
}

function validateSelection(input: unknown) {
  const golfersRaw = (input as any)?.golfers;
  const captainRankRaw = (input as any)?.captainRank;

  if (!Array.isArray(golfersRaw)) return { ok: false as const, error: "INVALID_GOLFERS" as const };
  if (typeof captainRankRaw !== "number") return { ok: false as const, error: "INVALID_CAPTAIN" as const };

  const golfers = golfersRaw
    .map((g: any) => ({
      rank: Number(g?.rank),
      name: typeof g?.name === "string" ? g.name.trim() : "",
      playerId: typeof g?.playerId === "string" ? g.playerId.trim() : undefined,
    }))
    .filter((g: any) => Number.isFinite(g.rank) && g.rank > 0 && g.name.length > 0);

  // Exactly 5 unique ranks.
  const ranks = golfers.map((g: any) => g.rank);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== 5 || golfers.length !== 5) {
    return { ok: false as const, error: "NEED_5_UNIQUE_PLAYERS" as const };
  }

  const top10 = golfers.filter((g: any) => g.rank <= 10).length;
  if (top10 > 2) return { ok: false as const, error: "MAX_2_TOP10" as const };

  const totalRank = golfers.reduce((acc: number, g: any) => acc + g.rank, 0);
  if (totalRank <= 70) return { ok: false as const, error: "RANK_SUM_TOO_LOW" as const };

  if (!uniqueRanks.has(captainRankRaw)) {
    return { ok: false as const, error: "CAPTAIN_NOT_SELECTED" as const };
  }

  return { ok: true as const, golfers, captainRank: captainRankRaw, totalRank };
}

export async function PUT(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  if (isAnyMajorInProgress()) {
    return NextResponse.json(
      { ok: false, error: "TOURNAMENT_STARTED" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = validateSelection(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const majorRaw = (body as any)?.major;
  const majorKey: MajorKey = isMajorKey(majorRaw) ? majorRaw : "masters";

  const saved = await saveSelectionForUser({
    userId: session.sub,
    majorKey,
    golfers: parsed.golfers,
    captainRank: parsed.captainRank,
  });
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true, team: saved.team, totalRank: parsed.totalRank });
}

