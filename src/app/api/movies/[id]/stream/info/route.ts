import fs from "node:fs";
import { NextResponse } from "next/server";
import { getMovieById } from "@/lib/storage";
import { validateLibraryPath } from "@/lib/streaming";
import { probeFile, getPlaybackMode, getTranscodedPath } from "@/lib/transcoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const movie = getMovieById(id);
  if (!movie?.filePath) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  // If pre-transcoded, always direct play
  if (getTranscodedPath(id)) {
    return NextResponse.json({
      mode: "direct",
      duration: 0,
      videoCodec: "h264",
      audioCodec: "aac",
    });
  }

  const result = validateLibraryPath(movie.filePath);
  if (result instanceof NextResponse) return result;
  if (!fs.existsSync(result)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  try {
    const probe = await probeFile(result);
    const mode = getPlaybackMode(probe);
    return NextResponse.json({
      mode,
      duration: probe.duration,
      videoCodec: probe.videoCodec,
      audioCodec: probe.audioCodec,
      width: probe.width,
      height: probe.height,
    });
  } catch {
    return NextResponse.json({
      mode: "direct",
      duration: 0,
      videoCodec: null,
      audioCodec: null,
    });
  }
}
