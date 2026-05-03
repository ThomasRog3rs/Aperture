import { NextResponse } from "next/server";
import { getEpisodeById, getSeasonById } from "@/lib/storage";
import { reconcileSubtitlesForMedia } from "@/lib/subtitles";
import path from "node:path";
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

  const episode = getEpisodeById(id);
  if (!episode) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }

  const season = getSeasonById(episode.seasonId);
  const folderPath = season?.seasonFolderPath ?? path.dirname(episode.filePath);
  // Use the episode's file base name to filter relevant subtitle files in the season folder
  const episodeFileBase = path.basename(episode.filePath, path.extname(episode.filePath));

  const rows = reconcileSubtitlesForMedia("episode", id, folderPath, episodeFileBase);
  return NextResponse.json({ subtitles: rows.map(rowToSubtitleFile) });
}
