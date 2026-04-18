import fs from "node:fs";
import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const libraryRootPath = getSetting("libraryRootPath");
  const playerMode = getSetting("playerMode") ?? "browser";
  const omdbApiKey = getSetting("omdbApiKey") ?? null;
  const magnetApiEnabled = getSetting("magnetApiEnabled") ?? "false";
  const magnetApiBaseUrl = getSetting("magnetApiBaseUrl") ?? "http://localhost:8000";
  return NextResponse.json({ libraryRootPath, playerMode, omdbApiKey, magnetApiEnabled, magnetApiBaseUrl });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        libraryRootPath?: string;
        playerMode?: string;
        omdbApiKey?: string;
        magnetApiEnabled?: boolean | string;
        magnetApiBaseUrl?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Handle playerMode setting (standalone)
  if (body.playerMode !== undefined && !body.libraryRootPath) {
    const mode = body.playerMode === "external" ? "external" : "browser";
    setSetting("playerMode", mode);
    return NextResponse.json({ playerMode: mode });
  }

  // Handle omdbApiKey setting (standalone)
  if (body.omdbApiKey !== undefined && !body.libraryRootPath) {
    const key = body.omdbApiKey.trim();
    if (!key) {
      return NextResponse.json({ error: "omdbApiKey must not be empty." }, { status: 400 });
    }
    setSetting("omdbApiKey", key);
    return NextResponse.json({ omdbApiKey: key });
  }

  // Handle magnetApi settings (standalone)
  if ((body.magnetApiEnabled !== undefined || body.magnetApiBaseUrl !== undefined) && !body.libraryRootPath) {
    if (body.magnetApiEnabled !== undefined) {
      setSetting("magnetApiEnabled", body.magnetApiEnabled === true || body.magnetApiEnabled === "true" ? "true" : "false");
    }
    if (body.magnetApiBaseUrl !== undefined) {
      const url = body.magnetApiBaseUrl.trim().replace(/\/+$/, "");
      setSetting("magnetApiBaseUrl", url || "http://localhost:8000");
    }
    return NextResponse.json({
      magnetApiEnabled: getSetting("magnetApiEnabled") ?? "false",
      magnetApiBaseUrl: getSetting("magnetApiBaseUrl") ?? "http://localhost:8000",
    });
  }

  const libraryRootPath = body.libraryRootPath?.trim();
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

