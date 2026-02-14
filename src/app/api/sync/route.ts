import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cleanTitle } from "@/lib/cleanTitle";
import { scanLibrary } from "@/lib/scan";
import { resolveOmdbMovie } from "@/lib/omdb";
import { getMovieById, getSetting, upsertMovie } from "@/lib/storage";

export const runtime = "nodejs";

function parseGenres(genresJson: string | null) {
  if (!genresJson) return [];
  try {
    const parsed = JSON.parse(genresJson) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST() {
  const libraryRootPath = getSetting("libraryRootPath");
  if (!libraryRootPath) {
    return NextResponse.json(
      { error: "Library path not set." },
      { status: 400 }
    );
  }

  let scanned;
  try {
    scanned = await scanLibrary(libraryRootPath);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to scan library.",
      },
      { status: 500 }
    );
  }
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const entry of scanned) {
    const id = crypto
      .createHash("sha1")
      .update(entry.folderPath)
      .digest("hex");

    const existing = getMovieById(id);
    const existingGenres = existing ? parseGenres(existing.genresJson) : [];
    const { titleClean, year } = cleanTitle(entry.titleRaw);
    let errorMessage = entry.errorMessage;
    let tmdbData = null;

    if (!errorMessage) {
      try {
        tmdbData = await resolveOmdbMovie(titleClean, year);
      } catch (error) {
        errorMessage =
          error instanceof Error ? error.message : "OMDb lookup failed.";
      }
    }

    if (!tmdbData && existing?.tmdbId) {
      tmdbData = {
        tmdbId: existing.tmdbId,
        posterPath: existing.posterPath,
        backdropPath: existing.backdropPath,
        runtimeMinutes: existing.runtimeMinutes,
        tmdbRating: existing.tmdbRating,
        genres: existingGenres,
        youtubeTrailerKey: existing.youtubeTrailerKey,
      };
    }

    if (!tmdbData && !errorMessage) {
      notFound += 1;
    }

    if (errorMessage) {
      errors += 1;
    }

    upsertMovie({
      id,
      folderPath: entry.folderPath,
      filePath: entry.filePath,
      fileSizeBytes: entry.fileSizeBytes,
      titleRaw: entry.titleRaw,
      titleClean,
      year,
      tmdbId: tmdbData?.providerId ?? null,
      posterPath: tmdbData?.posterPath ?? null,
      backdropPath: tmdbData?.backdropPath ?? null,
      runtimeMinutes: tmdbData?.runtimeMinutes ?? null,
      tmdbRating: tmdbData?.tmdbRating ?? null,
      genres: tmdbData?.genres ?? [],
      youtubeTrailerKey: tmdbData?.youtubeTrailerKey ?? null,
      personalRating: existing?.personalRating ?? null,
      errorMessage,
      lastSyncedAt: Date.now(),
    });

    updated += 1;
  }

  return NextResponse.json({
    scanned: scanned.length,
    updated,
    notFound,
    errors,
  });
}

