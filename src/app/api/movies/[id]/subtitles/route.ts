import { NextResponse } from "next/server";
import { getMovieById } from "@/lib/storage";
import { reconcileSubtitlesForMedia } from "@/lib/subtitles";
import type { SubtitleFile } from "@/lib/types";

export const runtime = "nodejs";

function rowToSubtitleFile(row: {
  id: string;
  mediaType: string;
  mediaId: string;
  filePath: string;
  fileName: string;
  language: string;
  format: string;
  source: string;
  downloadedAt: number | null;
}): SubtitleFile {
  return {
    id: row.id,
    mediaType: row.mediaType as "movie" | "episode",
    mediaId: row.mediaId,
    filePath: row.filePath,
    fileName: row.fileName,
    language: row.language,
    format: row.format,
    source: row.source as "local" | "opensubtitles",
    downloadedAt: row.downloadedAt,
  };
}

export async function GET(
  _request: Request,
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

  const rows = reconcileSubtitlesForMedia("movie", id, movie.folderPath);
  return NextResponse.json({ subtitles: rows.map(rowToSubtitleFile) });
}
