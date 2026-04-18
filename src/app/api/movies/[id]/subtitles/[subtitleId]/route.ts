import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getMovieById, getSubtitleById, deleteSubtitleById } from "@/lib/storage";
import { validateLibraryPath } from "@/lib/streaming";
import { SUBTITLE_EXTENSIONS } from "@/lib/subtitles";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id?: string; subtitleId?: string }> }
) {
  const { id, subtitleId } = await context.params;
  if (!id || !subtitleId) {
    return NextResponse.json({ error: "id and subtitleId are required." }, { status: 400 });
  }

  const movie = getMovieById(id);
  if (!movie) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  const subtitle = getSubtitleById(subtitleId);
  if (!subtitle || subtitle.mediaType !== "movie" || subtitle.mediaId !== id) {
    return NextResponse.json({ error: "Subtitle not found." }, { status: 404 });
  }

  // Security: validate path is inside library root
  const validated = validateLibraryPath(subtitle.filePath);
  if (validated instanceof NextResponse) return validated;

  // Security: extension whitelist
  const ext = path.extname(subtitle.filePath).toLowerCase();
  if (!SUBTITLE_EXTENSIONS.includes(ext as (typeof SUBTITLE_EXTENSIONS)[number])) {
    return NextResponse.json({ error: "File type not allowed." }, { status: 403 });
  }

  // Security: ensure file is inside movie's folder
  const resolvedFolder = path.resolve(movie.folderPath);
  const resolvedFile = path.resolve(subtitle.filePath);
  const folderPrefix = resolvedFolder.endsWith(path.sep)
    ? resolvedFolder
    : `${resolvedFolder}${path.sep}`;
  if (!resolvedFile.startsWith(folderPrefix)) {
    return NextResponse.json(
      { error: "File is not within the expected media folder." },
      { status: 403 }
    );
  }

  try {
    if (fs.existsSync(subtitle.filePath)) {
      fs.unlinkSync(subtitle.filePath);
    }
    deleteSubtitleById(subtitleId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete subtitle." },
      { status: 500 }
    );
  }
}
