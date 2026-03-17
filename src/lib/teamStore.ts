import crypto from "node:crypto";
import { getSupabase } from "@/lib/supabase";
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
    afterRound: number;
    madeAt: string;
  } | null;
  createdAt: string;
};

type DbTeam = {
  id: string;
  user_id: string;
  major_key: string;
  name: string;
  golfers: { rank: number; name: string; playerId?: string }[];
  captain_rank: number | null;
  substitute: TeamRecord["substitute"];
  created_at: string;
};

const MAJOR_KEYS: MajorKey[] = ["masters", "pga", "usopen", "open"];

function toMajorKey(s: string): MajorKey {
  return MAJOR_KEYS.includes(s as MajorKey) ? (s as MajorKey) : "masters";
}

function rowToTeam(r: DbTeam): TeamRecord {
  return {
    id: r.id,
    userId: r.user_id,
    majorKey: toMajorKey(r.major_key),
    name: r.name,
    golfers: Array.isArray(r.golfers) ? r.golfers : [],
    captainRank: r.captain_rank ?? null,
    substitute: r.substitute ?? null,
    createdAt: r.created_at,
  };
}

export async function getTeamForUser(userId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("fantasy_teams")
    .select("*")
    .eq("user_id", userId)
    .eq("major_key", "masters")
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTeam(data as DbTeam) : null;
}

export async function getTeamForUserMajor(userId: string, majorKey: MajorKey) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("fantasy_teams")
    .select("*")
    .eq("user_id", userId)
    .eq("major_key", majorKey)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTeam(data as DbTeam) : null;
}

export async function getAllTeams() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("fantasy_teams").select("*");
  if (error) throw error;
  return ((data ?? []) as DbTeam[]).map(rowToTeam);
}

export async function getAllTeamsForMajor(majorKey: MajorKey) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("fantasy_teams")
    .select("*")
    .eq("major_key", majorKey);
  if (error) throw error;
  return ((data ?? []) as DbTeam[]).map(rowToTeam);
}

export async function createTeamForUser(input: { userId: string; majorKey: MajorKey; name: string }) {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("fantasy_teams")
    .select("id")
    .eq("user_id", input.userId)
    .eq("major_key", input.majorKey)
    .maybeSingle();
  if (existing) return { ok: false as const, error: "TEAM_ALREADY_EXISTS" as const };

  const row = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    major_key: input.majorKey,
    name: input.name,
    golfers: [],
    captain_rank: null,
    substitute: null,
    created_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase.from("fantasy_teams").insert(row).select("*").single();
  if (error) throw error;
  return { ok: true as const, team: rowToTeam(inserted as DbTeam) };
}

export async function saveSelectionForUser(input: {
  userId: string;
  majorKey: MajorKey;
  golfers: { rank: number; name: string; playerId?: string }[];
  captainRank: number;
}) {
  const supabase = getSupabase();
  const { data: team, error: fetchError } = await supabase
    .from("fantasy_teams")
    .select("*")
    .eq("user_id", input.userId)
    .eq("major_key", input.majorKey)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!team) return { ok: false as const, error: "TEAM_NOT_FOUND" as const };

  const { error: updateError } = await supabase
    .from("fantasy_teams")
    .update({
      golfers: input.golfers,
      captain_rank: input.captainRank,
      substitute: null,
    })
    .eq("id", (team as DbTeam).id);
  if (updateError) throw updateError;

  const updated: TeamRecord = {
    ...rowToTeam(team as DbTeam),
    golfers: input.golfers,
    captainRank: input.captainRank,
    substitute: null,
  };
  return { ok: true as const, team: updated };
}

export async function setSubstituteForUserMajor(input: {
  userId: string;
  majorKey: MajorKey;
  substitute: NonNullable<TeamRecord["substitute"]>;
}) {
  const supabase = getSupabase();
  const { data: team, error: fetchError } = await supabase
    .from("fantasy_teams")
    .select("*")
    .eq("user_id", input.userId)
    .eq("major_key", input.majorKey)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!team) return { ok: false as const, error: "TEAM_NOT_FOUND" as const };

  const current = team as DbTeam;
  let newCaptainRank = current.captain_rank;
  if (current.captain_rank === input.substitute.outRank) {
    newCaptainRank = input.substitute.inRank;
  }

  const { error: updateError } = await supabase
    .from("fantasy_teams")
    .update({ substitute: input.substitute, captain_rank: newCaptainRank })
    .eq("id", current.id);
  if (updateError) throw updateError;

  const updated: TeamRecord = {
    ...rowToTeam(current),
    substitute: input.substitute,
    captainRank: newCaptainRank,
  };
  return { ok: true as const, team: updated };
}
