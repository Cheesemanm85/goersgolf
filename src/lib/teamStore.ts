import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { MajorKey } from "@/lib/majors";

export type TeamRecord = {
  id: string;
  userId: string;
  majorKey: MajorKey;
  name: string;
  golfers: { rank: number; name: string; playerId?: string }[];
  captainRank: number | null;
  substitute?: {
    outRank: number;
    outName: string;
    outPlayerId?: string;
    inRank: number;
    inName: string;
    inPlayerId?: string;
    afterRound: number; // 1-4, substitute applies from (afterRound+1)
    madeAt: string;
  } | null;
  createdAt: string;
};

function teamsFilePath() {
  return path.join(process.cwd(), "data", "teams.json");
}

async function readAllTeams(): Promise<TeamRecord[]> {
  const file = teamsFilePath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? (parsed as any[]) : [];
    // Back-compat: old records didn't have majorKey; treat them as Masters picks.
    return rows
      .map((t) => ({
        ...t,
        majorKey:
          t?.majorKey === "masters" || t?.majorKey === "pga" || t?.majorKey === "usopen" || t?.majorKey === "open"
            ? (t.majorKey as MajorKey)
            : ("masters" as MajorKey),
        substitute: t?.substitute ?? null,
      }))
      .filter((t) => typeof t.userId === "string" && typeof t.name === "string") as TeamRecord[];
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && e.code === "ENOENT") {
      return [];
    }
    throw e;
  }
}

async function writeAllTeams(teams: TeamRecord[]) {
  const file = teamsFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(teams, null, 2) + "\n", "utf8");
}

export async function getTeamForUser(userId: string) {
  const teams = await readAllTeams();
  return teams.find((t) => t.userId === userId && t.majorKey === "masters") ?? null;
}

export async function getTeamForUserMajor(userId: string, majorKey: MajorKey) {
  const teams = await readAllTeams();
  return teams.find((t) => t.userId === userId && t.majorKey === majorKey) ?? null;
}

export async function getAllTeams() {
  return readAllTeams();
}

export async function getAllTeamsForMajor(majorKey: MajorKey) {
  const teams = await readAllTeams();
  return teams.filter((t) => t.majorKey === majorKey);
}

export async function createTeamForUser(input: { userId: string; majorKey: MajorKey; name: string }) {
  const teams = await readAllTeams();
  const existing = teams.find((t) => t.userId === input.userId && t.majorKey === input.majorKey);
  if (existing) return { ok: false as const, error: "TEAM_ALREADY_EXISTS" as const };

  const team: TeamRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    majorKey: input.majorKey,
    name: input.name,
    golfers: [],
    captainRank: null,
    substitute: null,
    createdAt: new Date().toISOString(),
  };
  teams.push(team);
  await writeAllTeams(teams);
  return { ok: true as const, team };
}

export async function saveSelectionForUser(input: {
  userId: string;
  majorKey: MajorKey;
  golfers: { rank: number; name: string; playerId?: string }[];
  captainRank: number;
}) {
  const teams = await readAllTeams();
  const idx = teams.findIndex((t) => t.userId === input.userId && t.majorKey === input.majorKey);
  if (idx === -1) return { ok: false as const, error: "TEAM_NOT_FOUND" as const };

  const team = teams[idx]!;
  team.golfers = input.golfers;
  team.captainRank = input.captainRank;
  team.substitute = null;
  teams[idx] = team;

  await writeAllTeams(teams);
  return { ok: true as const, team };
}

export async function setSubstituteForUserMajor(input: {
  userId: string;
  majorKey: MajorKey;
  substitute: NonNullable<TeamRecord["substitute"]>;
}) {
  const teams = await readAllTeams();
  const idx = teams.findIndex((t) => t.userId === input.userId && t.majorKey === input.majorKey);
  if (idx === -1) return { ok: false as const, error: "TEAM_NOT_FOUND" as const };

  const team = teams[idx]!;
  team.substitute = input.substitute;
  if (team.captainRank === input.substitute.outRank) {
    team.captainRank = input.substitute.inRank;
  }
  teams[idx] = team;

  await writeAllTeams(teams);
  return { ok: true as const, team };
}

