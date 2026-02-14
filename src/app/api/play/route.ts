import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { NextResponse } from "next/server";
import { getSetting } from "@/lib/storage";

export const runtime = "nodejs";

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

  return new Promise<Response>((resolve) => {
    execFile("open", [resolvedFile], (error) => {
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

