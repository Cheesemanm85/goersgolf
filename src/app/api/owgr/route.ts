import { NextResponse } from "next/server";
import { fetchOwgrCurrentRanking, getOwgrSourceUrl } from "@/lib/owgr";

export async function GET() {
  try {
    if (!process.env.RAPIDAPI_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "RAPIDAPI_KEY_MISSING",
          hint: "Set RAPIDAPI_KEY in .env.local (see .env.local.example), then restart `npm run dev`.",
        },
        { status: 500 },
      );
    }

    const players = await fetchOwgrCurrentRanking();
    return NextResponse.json({
      ok: true,
      source: getOwgrSourceUrl(),
      updatedAt: new Date().toISOString(),
      players,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "OWGR_ERROR" },
      { status: 502 },
    );
  }
}

