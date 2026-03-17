export type MajorKey = "masters" | "pga" | "usopen" | "open";

export type MajorConfig = {
  key: MajorKey;
  label: string;
  orgId: string;
  tournId: string;
  year: string;
  startAtIso: string; // ISO datetime in UTC (e.g. 2026-04-09T12:00:00Z)
  courseName?: string;
};

export const majors: MajorConfig[] = [
  {
    key: "masters",
    label: "Masters",
    orgId: "1",
    // Default known-good example (2024 Masters in this dataset).
    tournId: process.env.MAJORS_MASTERS_TOURN_ID ?? "014",
    year: process.env.MAJORS_YEAR ?? "2024",
    startAtIso:
      process.env.MAJORS_MASTERS_START_AT ??
      // Placeholder; set in .env.local for accuracy.
      "2026-04-09T12:00:00Z",
    // 2024 Masters: Augusta National Golf Club
    courseName: "Augusta National Golf Club",
  },
  {
    key: "pga",
    label: "PGA Championship",
    orgId: "1",
    tournId: process.env.MAJORS_PGA_TOURN_ID ?? "",
    year: process.env.MAJORS_YEAR ?? "2024",
    startAtIso:
      process.env.MAJORS_PGA_START_AT ??
      "2026-05-14T12:00:00Z",
    // 2024 PGA Championship: Valhalla Golf Club
    courseName: "Valhalla Golf Club",
  },
  {
    key: "usopen",
    label: "U.S. Open",
    orgId: "1",
    tournId: process.env.MAJORS_USOPEN_TOURN_ID ?? "",
    year: process.env.MAJORS_YEAR ?? "2024",
    startAtIso:
      process.env.MAJORS_USOPEN_START_AT ??
      "2026-06-18T12:00:00Z",
    // 2024 U.S. Open: Pinehurst No. 2
    courseName: "Pinehurst No. 2",
  },
  {
    key: "open",
    label: "The Open",
    orgId: "1",
    tournId: process.env.MAJORS_OPEN_TOURN_ID ?? "",
    year: process.env.MAJORS_YEAR ?? "2024",
    startAtIso:
      process.env.MAJORS_OPEN_START_AT ??
      "2026-07-16T06:00:00Z",
    // 2024 Open Championship: Royal Troon Golf Club
    courseName: "Royal Troon Golf Club",
  },
];

export function getMajor(key: MajorKey) {
  return majors.find((m) => m.key === key) ?? majors[0]!;
}

