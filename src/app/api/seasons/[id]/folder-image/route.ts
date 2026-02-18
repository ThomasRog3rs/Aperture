import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSeasonById } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function isSafeFileName(name: string) {
  if (!name) return false;
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) return false;
  return name === path.basename(name);
}

function isWithinFolder(filePath: string, folderPath: string) {
  const resolvedFolder = path.resolve(folderPath);
  const resolvedFile = path.resolve(filePath);
  return (
    resolvedFile !== resolvedFolder &&
    resolvedFile.startsWith(`${resolvedFolder}${path.sep}`)
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const season = getSeasonById(id);
  if (!season) {
    return NextResponse.json({ error: "Season not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "";
  if (!isSafeFileName(name)) {
    return NextResponse.json(
      { error: "Invalid file name." },
      { status: 400 }
    );
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json(
      { error: "Unsupported image type." },
      { status: 400 }
    );
  }

  const filePath = path.join(season.seasonFolderPath, name);
  if (!isWithinFolder(filePath, season.seasonFolderPath)) {
    return NextResponse.json(
      { error: "Invalid file path." },
      { status: 400 }
    );
  }

  let file: Buffer;
  try {
    file = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const body = new Uint8Array(file);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
