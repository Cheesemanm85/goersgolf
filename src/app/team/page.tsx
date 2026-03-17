import { getSession } from "@/lib/session";
import { getTeamForUserMajor } from "@/lib/teamStore";
import { TeamClient } from "@/app/team/TeamClient";
import { isAnyMajorInProgress } from "@/lib/tournamentLock";
import type { MajorKey } from "@/lib/majors";

function isMajorKey(v: unknown): v is MajorKey {
  return v === "masters" || v === "pga" || v === "usopen" || v === "open";
}

export default async function TeamPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const sp = (await props.searchParams) ?? {};
  const majorKeyRaw = Array.isArray(sp.major) ? sp.major[0] : sp.major;
  const majorKey: MajorKey = isMajorKey(majorKeyRaw) ? majorKeyRaw : "masters";

  const team = session ? await getTeamForUserMajor(session.sub, majorKey) : null;
  const isLocked = isAnyMajorInProgress();

  return (
    <TeamClient
      isLocked={isLocked}
      majorKey={majorKey}
      initialTeam={
        team
          ? {
              id: team.id,
              name: team.name,
              golfers: team.golfers,
              captainRank: team.captainRank,
            }
          : null
      }
    />
  );
}

