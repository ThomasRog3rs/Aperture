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

function getOpenCommand(
  filePath: string,
  platform: NodeJS.Platform
): { command: string; args: string[] } | null {
  if (platform === "darwin") {
    return { command: "open", args: [filePath] };
  }

  if (platform === "linux") {
    return { command: "xdg-open", args: [filePath] };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", filePath] };
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
  const openCommand = getOpenCommand(resolvedFile, platform);
  if (!openCommand) {
    return NextResponse.json(
      { error: `Playing files is not supported on this platform: ${platform}.` },
      { status: 501 }
    );
  }

  return new Promise<Response>((resolve) => {
    execFile(openCommand.command, openCommand.args, (error) => {
      if (error) {
        resolve(
          NextResponse.json(
            { error: "Failed to open file." },
            { status: 500 }
          )
        );
        return;
      }

      resolve(NextResponse.json({ status: "Playing" }));
    });
  });
}

