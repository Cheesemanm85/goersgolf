import { majors } from "@/lib/majors";

function parseDateMs(iso: string) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function isAnyMajorInProgress(nowMs = Date.now()) {
  const durationHours = Number(process.env.MAJORS_IN_PROGRESS_WINDOW_HOURS ?? "96");
  const durationMs = Number.isFinite(durationHours) ? durationHours * 60 * 60 * 1000 : 96 * 60 * 60 * 1000;

  for (const m of majors) {
    const startMs = parseDateMs(m.startAtIso);
    if (!startMs) continue;
    const endMs = startMs + durationMs;
    if (nowMs >= startMs && nowMs < endMs) return true;
  }
  return false;
}

