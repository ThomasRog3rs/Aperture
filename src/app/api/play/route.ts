import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { NextResponse } from "next/server";
import { getSetting } from "@/lib/storage";

export const runtime = "nodejs";

type SupportedPlatform = "darwin" | "linux" | "win32";

function normalizePlatform(value?: string | null): SupportedPlatform | null {
  if (!value) {
    return null;
  }

  switch (value.trim().toLowerCase()) {
    case "darwin":
    case "mac":
    case "macos":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
    case "win":
    case "windows":
      return "win32";
    default:
      return null;
  }
}

function resolvePlatform(): NodeJS.Platform {
  return normalizePlatform(process.env.APERTURE_OS) ?? process.platform;
}

// Each branch uses a static command string so Turbopack can narrow the pattern
// rather than producing an overly broad dynamic union.
function openFileForPlatform(
  filePath: string,
  platform: NodeJS.Platform
): Promise<Response> | null {
  const toResponse = (error: Error | null): Response =>
    error
      ? NextResponse.json({ error: "Failed to open file." }, { status: 500 })
      : NextResponse.json({ status: "Playing" });

  if (platform === "darwin") {
    return new Promise((resolve) =>
      execFile("open", [filePath], (err) => resolve(toResponse(err)))
    );
  }

  if (platform === "linux") {
    return new Promise((resolve) =>
      execFile("xdg-open", [filePath], (err) => resolve(toResponse(err)))
    );
  }

  if (platform === "win32") {
    return new Promise((resolve) =>
      execFile("cmd", ["/c", "start", "", filePath], (err) =>
        resolve(toResponse(err))
      )
    );
  }

  return null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { filePath?: string }
    | null;

  const filePath = body?.filePath;
  if (!filePath || typeof filePath !== "string") {
    return NextResponse.json(
      { error: "filePath is required." },
      { status: 400 }
    );
  }

  const libraryRootPath = getSetting("libraryRootPath");
  if (!libraryRootPath) {
    return NextResponse.json(
      { error: "Library path not set." },
      { status: 400 }
    );
  }

  const resolvedRoot = path.resolve(libraryRootPath);
  const resolvedFile = path.resolve(filePath);
  const rootPrefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  if (!resolvedFile.startsWith(rootPrefix)) {
    return NextResponse.json(
      { error: "File path must be within the library root." },
      { status: 403 }
    );
  }

  if (!fs.existsSync(resolvedFile)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const platform = resolvePlatform();
  const result = openFileForPlatform(resolvedFile, platform);
  if (!result) {
    return NextResponse.json(
      {
        error: `Playing files is not supported on this platform: ${platform}.`,
      },
      { status: 501 }
    );
  }

  return result;
}

