import { NextRequest, NextResponse } from "next/server";
import { purgeDeletedItems, purgeMoviesByIds, purgeSeasonsByIds } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { type?: "movie" | "season"; ids?: string[] } = {};
  try {
    body = (await req.json()) as { type?: "movie" | "season"; ids?: string[] };
  } catch {
    // No body — purge all
  }

  if (body.ids && body.ids.length > 0) {
    if (body.type === "movie") {
      purgeMoviesByIds(body.ids);
    } else if (body.type === "season") {
      purgeSeasonsByIds(body.ids);
    } else {
      return NextResponse.json({ error: "type must be 'movie' or 'season'" }, { status: 400 });
    }
    return NextResponse.json({ purged: body.ids.length });
  }

  const purged = purgeDeletedItems();
  return NextResponse.json({ purged });
}
