import { NextRequest, NextResponse } from "next/server";
import { restoreMoviesByIds, restoreSeasonsByIds } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { type: "movie" | "season"; ids: string[] };
  const { type, ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  if (type === "movie") {
    restoreMoviesByIds(ids);
  } else if (type === "season") {
    restoreSeasonsByIds(ids);
  } else {
    return NextResponse.json({ error: "type must be 'movie' or 'season'" }, { status: 400 });
  }

  return NextResponse.json({ restored: ids.length });
}
