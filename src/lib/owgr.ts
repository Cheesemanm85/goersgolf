export type OwgrPlayer = { rank: number; name: string; playerId?: string };

const OWGR_URL = "https://www.owgr.com/current-world-ranking";
const RAPID_HOST = "live-golf-data.p.rapidapi.com";
const RAPID_URL = `https://${RAPID_HOST}/stats?year=2024&statId=186`;

function asPositiveInt(v: unknown) {
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function asCleanString(v: unknown) {
  const s = typeof v === "string" ? v : String(v ?? "");
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

function extractNextDataJson(html: string) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;
  const end = html.indexOf("</script>", jsonStart);
  if (end === -1) return null;
  const raw = html.slice(jsonStart, end);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractScriptSrcs(html: string) {
  const out = new Set<string>();
  const re = /_next\/static\/[^"'\\s>]+\.js[^"'\\s>]*/g;
  for (const m of html.matchAll(re)) {
    out.add(m[0].startsWith("/") ? m[0] : `/${m[0]}`);
  }
  return [...out];
}

function extractApiPathCandidates(js: string) {
  // Collect relative api-ish paths present in the bundle.
  const out = new Set<string>();
  const re = /\/api\/[a-zA-Z0-9/_-]{3,120}/g;
  for (const m of js.matchAll(re)) {
    out.add(m[0]);
  }
  return [...out];
}

function findPlayersInUnknownJson(root: unknown): OwgrPlayer[] | null {
  // Heuristic deep search: find an array of objects containing both a rank-ish
  // numeric field and a name-ish string field.
  const visited = new Set<object>();

  const rankKeys = ["ranking", "rank", "position", "worldRank", "world_rank"];
  const nameKeys = ["name", "playerName", "player_name", "fullName", "full_name"];

  function tryArray(arr: unknown[]) {
    if (arr.length < 5) return null;
    const sample = arr.slice(0, 20).filter((x) => x && typeof x === "object") as any[];
    if (sample.length < 5) return null;

    const candidates: OwgrPlayer[] = [];
    for (const item of sample) {
      const rankVal =
        rankKeys.map((k) => item[k]).find((v) => asPositiveInt(v) !== null) ??
        null;
      const nameVal =
        nameKeys.map((k) => item[k]).find((v) => asCleanString(v) !== null) ??
        null;
      const rank = asPositiveInt(rankVal);
      const name = asCleanString(nameVal);
      if (rank && name) candidates.push({ rank, name });
    }

    if (candidates.length >= Math.min(10, sample.length)) {
      // Expand using the same keys chosen from the first good item.
      const byRank = new Map<number, OwgrPlayer>();
      for (const it of arr as any[]) {
        if (!it || typeof it !== "object") continue;
        const rankVal =
          rankKeys.map((k) => (it as any)[k]).find((v) => asPositiveInt(v) !== null) ??
          null;
        const nameVal =
          nameKeys.map((k) => (it as any)[k]).find((v) => asCleanString(v) !== null) ??
          null;
        const rank = asPositiveInt(rankVal);
        const name = asCleanString(nameVal);
        if (rank && name && !byRank.has(rank)) byRank.set(rank, { rank, name });
      }
      const players = [...byRank.values()].sort((a, b) => a.rank - b.rank);
      return players.length ? players : null;
    }

    return null;
  }

  function walk(node: unknown): OwgrPlayer[] | null {
    if (!node) return null;
    if (Array.isArray(node)) {
      const fromArr = tryArray(node);
      if (fromArr) return fromArr;
      for (const v of node) {
        const found = walk(v);
        if (found) return found;
      }
      return null;
    }

    if (typeof node === "object") {
      if (visited.has(node)) return null;
      visited.add(node);
      for (const v of Object.values(node as Record<string, unknown>)) {
        const found = walk(v);
        if (found) return found;
      }
    }
    return null;
  }

  return walk(root);
}

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

function parseRapidOwgr(json: any): OwgrPlayer[] | null {
  const rankings = json?.rankings;
  if (!Array.isArray(rankings) || rankings.length === 0) return null;

  const byRank = new Map<number, OwgrPlayer>();
  for (const r of rankings) {
    const rank = asPositiveInt(unwrapMongoNumber(r?.rank));
    const name = asCleanString(r?.fullName ?? r?.name);
    const playerId = asCleanString(r?.playerId);
    if (!rank || !name) continue;
    if (!byRank.has(rank)) byRank.set(rank, { rank, name, playerId: playerId ?? undefined });
  }
  const players = [...byRank.values()].sort((a, b) => a.rank - b.rank);
  return players.length ? players : null;
}

export async function fetchOwgrCurrentRanking(): Promise<OwgrPlayer[]> {
  // Preferred: use a stable API feed (RapidAPI), configured via env.
  // This avoids OWGR's client-rendered table markup changing frequently.
  const rapidKey = process.env.RAPIDAPI_KEY;
  if (rapidKey) {
    const r = await fetch(RAPID_URL, {
      headers: {
        "content-type": "application/json",
        "x-rapidapi-host": RAPID_HOST,
        "x-rapidapi-key": rapidKey,
      },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (r.ok) {
      const json = await r.json().catch(() => null);
      const fromRapid = json ? parseRapidOwgr(json) : null;
      if (fromRapid?.length) return fromRapid;

      const players = json ? findPlayersInUnknownJson(json) : null;
      if (players?.length) return players;
    }
  }

  const res = await fetch(OWGR_URL, {
    headers: {
      "user-agent": "GolfFantasy/0.1 (+local dev)",
      accept: "text/html",
    },
    // Be polite and cache for a short window.
    next: { revalidate: 60 * 10 },
  });

  if (!res.ok) {
    throw new Error(`OWGR_FETCH_FAILED_${res.status}`);
  }

  const html = await res.text();
  const nextData = extractNextDataJson(html);

  // OWGR's table content is client-rendered; the HTML often contains placeholders.
  // We instead parse `__NEXT_DATA__` and, if possible, the `_next/data/<buildId>/...json` payload.
  const fromNextData = nextData ? findPlayersInUnknownJson(nextData) : null;
  if (fromNextData?.length) return fromNextData;

  const buildId = asCleanString((nextData as any)?.buildId);
  if (buildId) {
    const dataUrl = `https://www.owgr.com/_next/data/${buildId}/current-world-ranking.json`;
    const dataRes = await fetch(dataUrl, {
      headers: { "user-agent": "GolfFantasy/0.1 (+local dev)", accept: "application/json" },
      next: { revalidate: 60 * 10 },
    });
    if (dataRes.ok) {
      const json = await dataRes.json().catch(() => null);
      const fromNextJson = json ? findPlayersInUnknownJson(json) : null;
      if (fromNextJson?.length) return fromNextJson;
    }
  }

  // Last resort: OWGR is client-driven. Inspect page bundles for an API endpoint.
  const scriptSrcs = extractScriptSrcs(html).slice(0, 8);
  const apiPaths = new Set<string>();
  for (const src of scriptSrcs) {
    const full = src.startsWith("http") ? src : `https://www.owgr.com${src}`;
    const jsRes = await fetch(full, {
      headers: { "user-agent": "GolfFantasy/0.1 (+local dev)", accept: "text/javascript,*/*" },
      next: { revalidate: 60 * 60 },
    });
    if (!jsRes.ok) continue;
    const js = await jsRes.text();
    for (const p of extractApiPathCandidates(js)) apiPaths.add(p);
  }

  // Try candidates that look likely (contain 'rank').
  const ranked = [...apiPaths].sort((a, b) => {
    const ai = a.toLowerCase().includes("rank") ? 0 : 1;
    const bi = b.toLowerCase().includes("rank") ? 0 : 1;
    return ai - bi || a.length - b.length;
  });

  for (const path of ranked.slice(0, 20)) {
    const url = `https://www.owgr.com${path}`;
    const r = await fetch(url, {
      headers: { "user-agent": "GolfFantasy/0.1 (+local dev)", accept: "application/json" },
      next: { revalidate: 60 * 10 },
    });
    if (!r.ok) continue;
    const json = await r.json().catch(() => null);
    const players = json ? findPlayersInUnknownJson(json) : null;
    if (players?.length) return players;
  }

  return [];
}

export function getOwgrSourceUrl() {
  return process.env.RAPIDAPI_KEY ? `https://${RAPID_HOST}` : OWGR_URL;
}

