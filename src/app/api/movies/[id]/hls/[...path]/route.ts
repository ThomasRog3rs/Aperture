import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRANSCODES_DIR = path.join(process.cwd(), "data", "transcodes");

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".m4s": "video/mp4",
  ".mp4": "video/mp4",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id?: string; path?: string[] }> }
) {
  const { id, path: segments } = await context.params;
  if (!id || !segments || segments.length === 0) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const hlsDir = path.join(TRANSCODES_DIR, id, "hls");

  // Sanitize: ensure no traversal
  const relPath = segments.join("/");
  const resolved = path.resolve(hlsDir, relPath);
  if (!resolved.startsWith(path.resolve(hlsDir))) {
    return NextResponse.json({ error: "Invalid path." }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(resolved);
  const fileBuffer = fs.readFileSync(resolved);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": ext === ".m3u8" ? "no-cache" : "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
