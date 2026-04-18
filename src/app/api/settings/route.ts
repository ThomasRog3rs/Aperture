import fs from "node:fs";
import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/storage";
import { isOpenSubtitlesConfigured } from "@/lib/openSubtitlesApi";

export const runtime = "nodejs";

export async function GET() {
  const libraryRootPath = getSetting("libraryRootPath");
  const playerMode = getSetting("playerMode") ?? "browser";
  const openSubtitlesConfigured = isOpenSubtitlesConfigured();
  return NextResponse.json({ libraryRootPath, playerMode, openSubtitlesConfigured });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { libraryRootPath?: string; playerMode?: string }
    | null;

  // Handle playerMode setting (standalone)
  if (body?.playerMode && !body?.libraryRootPath) {
    const mode = body.playerMode === "external" ? "external" : "browser";
    setSetting("playerMode", mode);
    return NextResponse.json({ playerMode: mode });
  }

  const libraryRootPath = body?.libraryRootPath?.trim();
  if (!libraryRootPath) {
    return NextResponse.json(
      { error: "libraryRootPath is required." },
      { status: 400 }
    );
  }

  if (!fs.existsSync(libraryRootPath)) {
    return NextResponse.json(
      { error: "Path does not exist." },
      { status: 400 }
    );
  }

  const stat = fs.statSync(libraryRootPath);
  if (!stat.isDirectory()) {
    return NextResponse.json(
      { error: "Path must be a directory." },
      { status: 400 }
    );
  }

  setSetting("libraryRootPath", libraryRootPath);

  return NextResponse.json({ libraryRootPath });
}

