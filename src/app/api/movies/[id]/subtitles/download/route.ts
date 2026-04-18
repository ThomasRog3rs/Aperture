import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getMovieById, upsertSubtitle } from "@/lib/storage";
import {
  isOpenSubtitlesConfigured,
  getSubtitleDownloadLink,
} from "@/lib/openSubtitlesApi";
import { buildSubtitleFilePath, SUBTITLE_EXTENSIONS } from "@/lib/subtitles";
import { validateLibraryPath } from "@/lib/streaming";
import type { SubtitleFile } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (!isOpenSubtitlesConfigured()) {
    return NextResponse.json(
      { error: "OpenSubtitles is not configured. Add OPENSUBTITLES_API_KEY to your .env file." },
      { status: 503 }
    );
  }

  const movie = getMovieById(id);
  if (!movie) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { file_id?: number; file_name?: string; language?: string }
    | null;

  if (!body?.file_id || typeof body.file_id !== "number") {
    return NextResponse.json({ error: "file_id is required." }, { status: 400 });
  }

  const rawFileName = body.file_name?.trim() || `subtitle.${body.file_id}.srt`;
  const ext = path.extname(rawFileName).toLowerCase();
  if (!SUBTITLE_EXTENSIONS.includes(ext as (typeof SUBTITLE_EXTENSIONS)[number])) {
    return NextResponse.json({ error: "Unsupported subtitle format." }, { status: 400 });
  }
  const language = body.language?.trim() || "und";

  // Validate the target folder is in the library
  const folderCheck = validateLibraryPath(movie.folderPath);
  if (folderCheck instanceof NextResponse) return folderCheck;

  try {
    const { link } = await getSubtitleDownloadLink(body.file_id);

    // Download subtitle content
    const fetchResponse = await fetch(link, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch subtitle file (${fetchResponse.status})`);
    }
    const content = await fetchResponse.arrayBuffer();

    const targetPath = buildSubtitleFilePath(movie.folderPath, rawFileName);
    fs.writeFileSync(targetPath, Buffer.from(content));

    const subtitleId = crypto.randomUUID();
    const format = ext.slice(1);

    upsertSubtitle({
      id: subtitleId,
      mediaType: "movie",
      mediaId: id,
      filePath: targetPath,
      fileName: path.basename(targetPath),
      language,
      format,
      source: "opensubtitles",
      downloadedAt: Date.now(),
    });

    const subtitle: SubtitleFile = {
      id: subtitleId,
      mediaType: "movie",
      mediaId: id,
      filePath: targetPath,
      fileName: path.basename(targetPath),
      language,
      format,
      source: "opensubtitles",
      downloadedAt: Date.now(),
    };

    return NextResponse.json({ subtitle });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed." },
      { status: 500 }
    );
  }
}
