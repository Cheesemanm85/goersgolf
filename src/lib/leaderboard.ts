import { majors, type MajorKey } from "@/lib/majors";
import { isAnyMajorInProgress } from "@/lib/tournamentLock";

type LeaderboardRow = {
  playerId?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  status?: string;
  total?: string;
  currentRound?: unknown;
  totalStrokesFromCompletedRounds?: string;
  totalStrokes?: string;
  rounds?: { strokes?: unknown; roundId?: unknown; courseName?: string }[];
};

function unwrapMongoNumber(v: unknown) {
  if (v && typeof v === "object") {
    const obj = v as any;
    const ni = obj.$numberInt;
    if (typeof ni === "string" || typeof ni === "number") return Number(ni);
    const nd = obj.$numberDouble;
    if (typeof nd === "string" || typeof nd === "number") return Number(nd);
  }
  return v;
}

function asCleanString(v: unknown) {
  const s = typeof v === "string" ? v : String(v ?? "");
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

function asPositiveInt(v: unknown) {
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseTotalStrokes(row: LeaderboardRow) {
  // This API uses strings for total strokes, sometimes alongside Mongo-ish wrappers elsewhere.
  const a = asPositiveInt(unwrapMongoNumber(row.totalStrokesFromCompletedRounds));
  if (a) return a;
  const b = asPositiveInt(unwrapMongoNumber(row.totalStrokes));
  if (b) return b;
  return null;
}

function parseRoundStrokes(row: LeaderboardRow) {
  const rounds = Array.isArray(row.rounds) ? row.rounds : [];
  // Output in [R1, R2, R3, R4] order (null if missing).
  const out: (number | null)[] = [null, null, null, null];

  for (const r of rounds) {
    const rid = asPositiveInt(unwrapMongoNumber((r as any)?.roundId));
    if (!rid || rid < 1 || rid > 4) continue;
    const strokes = asPositiveInt(unwrapMongoNumber((r as any)?.strokes));
    if (!strokes) continue;
    out[rid - 1] = strokes;
  }

  return out;
}

function isMissedCut(row: LeaderboardRow) {
  const status = asCleanString(row.status)?.toLowerCase() ?? "";
  const pos = asCleanString(row.position)?.toLowerCase() ?? "";
  return status.includes("cut") || pos === "cut" || pos === "mc";
}

export async function fetchMajorLeaderboardShots(
  major: MajorKey,
  opts?: { year?: string; allowEmptyIfMissing?: boolean },
) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY_MISSING");

  const cfg = majors.find((m) => m.key === major);
  if (!cfg) throw new Error("MAJOR_UNKNOWN");
  if (!cfg.tournId) throw new Error("MAJOR_TOURN_ID_NOT_SET");
  const year = opts?.year ?? cfg.year;

  const url = `https://live-golf-data.p.rapidapi.com/leaderboard?orgId=${encodeURIComponent(
    cfg.orgId,
  )}&tournId=${encodeURIComponent(cfg.tournId)}&year=${encodeURIComponent(year)}`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
      "x-rapidapi-key": key,
    },
    next: { revalidate: isAnyMajorInProgress() ? 60 : 60 * 60 * 24 },
  });

  if (!res.ok) {
    if (opts?.allowEmptyIfMissing && (res.status === 404 || res.status === 400)) {
      return {
        byPlayerId: new Map<string, number>(),
        byName: new Map<string, number>(),
        roundsByPlayerId: new Map<string, (number | null)[]>(),
        roundsByName: new Map<string, (number | null)[]>(),
        missedCutByPlayerId: new Map<string, boolean>(),
        missedCutByName: new Map<string, boolean>(),
        maxRoundSeen: 0,
        rawCount: 0,
      };
    }
    const text = await res.text().catch(() => "");
    throw new Error(`LEADERBOARD_FETCH_${res.status}${text ? `:${text}` : ""}`);
  }

  const json = await res.json().catch(() => null);
  const rows: LeaderboardRow[] = Array.isArray(json?.leaderboardRows)
    ? json.leaderboardRows
    : [];

  const byPlayerId = new Map<string, number>();
  const byName = new Map<string, number>();
  const roundsByPlayerId = new Map<string, (number | null)[]>();
  const roundsByName = new Map<string, (number | null)[]>();
  const missedCutByPlayerId = new Map<string, boolean>();
  const missedCutByName = new Map<string, boolean>();
  let maxRoundSeen = 0;

  for (const r of rows) {
    const shots = parseTotalStrokes(r);
    const pid = asCleanString(r.playerId);
    const name = asCleanString(r.fullName);
    if (typeof shots === "number") {
      if (pid && !byPlayerId.has(pid)) byPlayerId.set(pid, shots);
      if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), shots);
    }

    const rounds = parseRoundStrokes(r);
    if (pid && !roundsByPlayerId.has(pid)) roundsByPlayerId.set(pid, rounds);
    if (name && !roundsByName.has(name.toLowerCase()))
      roundsByName.set(name.toLowerCase(), rounds);

    for (let i = 0; i < 4; i++) {
      if (typeof rounds[i] === "number") maxRoundSeen = Math.max(maxRoundSeen, i + 1);
    }

    const mc = isMissedCut(r);
    if (pid && !missedCutByPlayerId.has(pid)) missedCutByPlayerId.set(pid, mc);
    if (name && !missedCutByName.has(name.toLowerCase()))
      missedCutByName.set(name.toLowerCase(), mc);
  }

  return {
    byPlayerId,
    byName,
    roundsByPlayerId,
    roundsByName,
    missedCutByPlayerId,
    missedCutByName,
    maxRoundSeen,
    rawCount: rows.length,
  };
}

export type MajorLeaderboardEntry = {
  pos: string;
  player: string;
  totalToPar: string;
  thru: string;
  totalStrokes: number | null;
};

export type MajorLeaderboardResult = {
  courseName: string | null;
  entries: MajorLeaderboardEntry[];
};

export async function fetchMajorLeaderboardTop(
  major: MajorKey,
  opts?: { year?: string; allowEmptyIfMissing?: boolean },
) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY_MISSING");

  const cfg = majors.find((m) => m.key === major);
  if (!cfg) throw new Error("MAJOR_UNKNOWN");
  if (!cfg.tournId) throw new Error("MAJOR_TOURN_ID_NOT_SET");
  const year = opts?.year ?? cfg.year;

  // Known venues by year when the API doesn't send a course name or the year
  // isn't available in the API yet.
  const fallbackByYear: Record<string, Partial<Record<MajorKey, string>>> = {
    "2024": {
      masters: "Augusta National Golf Club",
      pga: "Valhalla Golf Club",
      usopen: "Pinehurst No. 2",
      open: "Royal Troon Golf Club",
    },
    "2026": {
      masters: "Augusta National Golf Club",
      pga: "Aronimink Golf Club",
      usopen: "Shinnecock Hills Golf Club",
      open: "Royal Birkdale Golf Club",
    },
  };
  const courseFallback = fallbackByYear[year]?.[major];

  const url = `https://live-golf-data.p.rapidapi.com/leaderboard?orgId=${encodeURIComponent(
    cfg.orgId,
  )}&tournId=${encodeURIComponent(cfg.tournId)}&year=${encodeURIComponent(year)}`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
      "x-rapidapi-key": key,
    },
    next: { revalidate: isAnyMajorInProgress() ? 60 : 60 * 60 * 24 },
  });

  if (!res.ok) {
    if (opts?.allowEmptyIfMissing && (res.status === 404 || res.status === 400)) {
      return { courseName: courseFallback ?? null, entries: [] } satisfies MajorLeaderboardResult;
    }
    const text = await res.text().catch(() => "");
    throw new Error(`LEADERBOARD_FETCH_${res.status}${text ? `:${text}` : ""}`);
  }

  const json = await res.json().catch(() => null);
  const rows: LeaderboardRow[] = Array.isArray(json?.leaderboardRows)
    ? json.leaderboardRows
    : [];

  const courseFromApi =
    asCleanString((rows[0] as any)?.rounds?.[0]?.courseName) ?? null;
  const courseName = courseFromApi ?? courseFallback ?? cfg.courseName ?? null;

  const entries = rows.map((r) => {
    const nameFromFull = asCleanString(r.fullName);
    const nameFromParts = [r.firstName, r.lastName]
      .map((v) => asCleanString(v))
      .filter(Boolean)
      .join(" ");
    const player = nameFromFull || nameFromParts || "—";
    const pos = asCleanString(r.position) ?? "—";
    const totalToPar = asCleanString(r.total) ?? "—";
    const thruRaw = (r as any).thru;
    const thru =
      asCleanString(thruRaw) ??
      (asCleanString(r.status) === "complete" ? "F" : asCleanString(r.status) ?? "—");
    const totalStrokes = parseTotalStrokes(r);
    return { pos, player, totalToPar, thru, totalStrokes } satisfies MajorLeaderboardEntry;
  });

  return { courseName, entries } satisfies MajorLeaderboardResult;
}

