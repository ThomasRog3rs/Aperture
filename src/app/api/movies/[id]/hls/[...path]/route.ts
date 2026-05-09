import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  getHlsAssetPath,
  isSafeMediaId,
  isSafeRelativePathSegment,
} from "@/lib/transcodePaths";
import { getMovieById } from "@/lib/storage";
import { parseRangeHeader, validateLibraryPath } from "@/lib/streaming";
import { packageAsHLS } from "@/lib/transcoding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  if (!isSafeMediaId(id) || !segments.every(isSafeRelativePathSegment)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 403 });
  }

  const resolved = getHlsAssetPath(id, segments);

  if (!fs.existsSync(resolved)) {
    const movie = getMovieById(id);
    if (!movie?.filePath) {
      return NextResponse.json({ error: "Movie not found." }, { status: 404 });
    }

    const result = validateLibraryPath(movie.filePath);
    if (result instanceof NextResponse) {
      return result;
    }

    try {
      await packageAsHLS(id, result);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to prepare HLS stream." },
        { status: 500 }
      );
    }
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(resolved);
  const rangeHeader = _request.headers.get("range");

  let start = 0;
  let end = stat.size - 1;
  let status = 200;

  if (rangeHeader) {
    try {
      const parsed = parseRangeHeader(rangeHeader, stat.size);
      if (parsed) {
        start = parsed.start;
        end = parsed.end;
        status = 206;
      }
    } catch {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stat.size}`,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Content-Type",
        },
      });
    }
  }

  const stream = fs.createReadStream(resolved, { start, end });
  const webStream = readableNodeToWeb(stream);
  const contentLength = end - start + 1;

  return new Response(webStream, {
    status,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(contentLength),
      ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` } : {}),
      "Accept-Ranges": "bytes",
      "Cache-Control": ext === ".m3u8" ? "no-cache" : "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  });
}

function readableNodeToWeb(nodeStream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        controller.enqueue(new Uint8Array(Buffer.from(chunk)));
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}
