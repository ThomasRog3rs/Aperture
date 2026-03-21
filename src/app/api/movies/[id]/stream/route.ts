import fs from "node:fs";
import { NextResponse } from "next/server";
import { getMovieById } from "@/lib/storage";
import {
  validateLibraryPath,
  getVideoContentType,
  createStreamResponse,
} from "@/lib/streaming";
import {
  getTranscodedPath,
  probeFile,
  getPlaybackMode,
  createLiveStream,
} from "@/lib/transcoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const movie = getMovieById(id);
  if (!movie) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  if (!movie.filePath) {
    return NextResponse.json(
      { error: "No file path for this movie." },
      { status: 404 }
    );
  }

  // Prefer pre-transcoded file if available (always direct-play compatible)
  const transcodedPath = getTranscodedPath(id);
  if (transcodedPath) {
    const rangeHeader = request.headers.get("range");
    return createStreamResponse(transcodedPath, rangeHeader);
  }

  const result = validateLibraryPath(movie.filePath);
  if (result instanceof NextResponse) {
    return result;
  }
  const resolvedFile = result;

  if (!fs.existsSync(resolvedFile)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  // Probe the file to determine playback mode
  let mode: "direct" | "remux" | "transcode";
  try {
    const probe = await probeFile(resolvedFile);
    mode = getPlaybackMode(probe);
  } catch {
    // If probe fails, try direct play as fallback
    mode = "direct";
  }

  if (mode === "direct") {
    const contentType = getVideoContentType(movie.filePath);
    if (!contentType) {
      return NextResponse.json(
        { error: "Unsupported video format." },
        { status: 400 }
      );
    }
    const rangeHeader = request.headers.get("range");
    return createStreamResponse(resolvedFile, rangeHeader);
  }

  // Remux or transcode on-the-fly via FFmpeg → fragmented MP4
  const url = new URL(request.url);
  const startTime = parseFloat(url.searchParams.get("start") || "0") || 0;

  try {
    const { stream, process: proc } = await createLiveStream(
      resolvedFile,
      mode,
      startTime > 0 ? startTime : undefined
    );

    // Clean up FFmpeg process when the client disconnects
    request.signal.addEventListener("abort", () => {
      proc.kill("SIGTERM");
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "none",
        "Cache-Control": "no-store",
        "X-Playback-Mode": mode,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to start transcoding stream." },
      { status: 500 }
    );
  }
}
