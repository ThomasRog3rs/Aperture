import { cleanTitle } from "@/lib/cleanTitle";
import { resolveOmdbMovie } from "@/lib/omdb";
import type { OmdbMovie } from "@/lib/omdb";
import {
  getAllMovieFolderPaths,
  getMovieById,
  markMoviesDeleted,
  upsertMovie,
} from "@/lib/storage";
import type { MovieRow, MovieUpsert } from "@/lib/storage";
import type { ScannedMovie } from "@/lib/scan";
import {
  generateMediaId,
  parseJsonArray,
  resolveTitle,
  shouldKeepPoster,
} from "./mediaUtils";
import type { MovieSyncStats, SyncEmitter } from "./types";

type ScannedResult = {
  movies: ScannedMovie[];
  currentMovieFolderPaths: string[];
};

export function buildMoviePayload(
  entry: ScannedMovie,
  existing: MovieRow | null,
  omdbData: OmdbMovie | null,
  syncedAt: number,
  id: string
): MovieUpsert {
  const existingGenres = existing ? parseJsonArray(existing.genresJson) : [];
  const existingUserGenres = existing ? parseJsonArray(existing.userGenresJson) : [];
  const existingDirectors = existing ? parseJsonArray(existing.directorsJson) : [];
  const existingWriters = existing ? parseJsonArray(existing.writersJson) : [];
  const existingActors = existing ? parseJsonArray(existing.actorsJson) : [];

  const { titleClean: derivedTitleClean, year } = cleanTitle(entry.titleRaw);
  const { titleClean, titleRaw } = resolveTitle(existing, derivedTitleClean, entry.titleRaw);

  const existingPoster = existing?.posterPath ?? null;

  const resolvedOmdb =
    !omdbData && existing?.tmdbId
      ? {
          providerId: existing.tmdbId,
          posterPath: existing.posterPath,
          backdropPath: existing.backdropPath,
          runtimeMinutes: existing.runtimeMinutes,
          tmdbRating: existing.tmdbRating,
          genres: existingGenres,
          directors: existingDirectors,
          writers: existingWriters,
          actors: existingActors,
          youtubeTrailerKey: existing.youtubeTrailerKey,
        }
      : omdbData;

  return {
    id,
    folderPath: entry.folderPath,
    filePath: entry.filePath,
    fileSizeBytes: entry.fileSizeBytes,
    titleRaw,
    titleClean,
    titleEditedAt: existing?.titleEditedAt ?? null,
    year,
    tmdbId: resolvedOmdb?.providerId ?? existing?.tmdbId ?? null,
    posterPath: shouldKeepPoster(existingPoster)
      ? existingPoster
      : resolvedOmdb?.posterPath ?? existing?.posterPath ?? null,
    backdropPath: resolvedOmdb?.backdropPath ?? existing?.backdropPath ?? null,
    runtimeMinutes: resolvedOmdb?.runtimeMinutes ?? existing?.runtimeMinutes ?? null,
    tmdbRating: resolvedOmdb?.tmdbRating ?? existing?.tmdbRating ?? null,
    genres:
      (resolvedOmdb?.genres?.length ? resolvedOmdb.genres : existingGenres) ?? [],
    directors:
      (resolvedOmdb?.directors?.length ? resolvedOmdb.directors : existingDirectors) ?? [],
    writers:
      (resolvedOmdb?.writers?.length ? resolvedOmdb.writers : existingWriters) ?? [],
    actors:
      (resolvedOmdb?.actors?.length ? resolvedOmdb.actors : existingActors) ?? [],
    userGenres: existingUserGenres,
    youtubeTrailerKey:
      resolvedOmdb?.youtubeTrailerKey ?? existing?.youtubeTrailerKey ?? null,
    personalRating: existing?.personalRating ?? null,
    errorMessage: entry.errorMessage,
    lastSyncedAt: syncedAt,
  };
}

export async function syncMovies(
  scanned: ScannedResult,
  signal: AbortSignal,
  syncedAt: number,
  emit: SyncEmitter
): Promise<MovieSyncStats> {
  const existingMovieFolderPaths = new Set(getAllMovieFolderPaths());
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  emit({ type: "phase", phase: "movies" });
  const totalMovies = scanned.movies.length;

  for (let i = 0; i < totalMovies; i++) {
    if (signal.aborted) {
      emit({ type: "cancelled" });
      return { updated, notFound, errors, deleted: 0 };
    }

    const entry = scanned.movies[i];
    emit({
      type: "progress",
      phase: "movies",
      current: i + 1,
      total: totalMovies,
      title: entry.titleRaw,
    });

    const id = generateMediaId(entry.folderPath);
    const existing = getMovieById(id);

    const existingDirectors = existing ? parseJsonArray(existing.directorsJson) : [];
    const existingWriters = existing ? parseJsonArray(existing.writersJson) : [];
    const existingActors = existing ? parseJsonArray(existing.actorsJson) : [];
    const missingCrew =
      !existing ||
      existingDirectors.length === 0 ||
      existingWriters.length === 0 ||
      existingActors.length === 0;

    const { titleClean, year } = cleanTitle(entry.titleRaw);
    let errorMessage = entry.errorMessage;
    let omdbData: OmdbMovie | null = null;

    if (!errorMessage && missingCrew) {
      try {
        omdbData = await resolveOmdbMovie(titleClean, year);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "OMDb lookup failed.";
      }
    }

    if (!omdbData && !errorMessage) notFound += 1;
    if (errorMessage) errors += 1;

    const payload = buildMoviePayload(
      { ...entry, errorMessage },
      existing ?? null,
      omdbData,
      syncedAt,
      id
    );
    upsertMovie(payload);
    updated += 1;
  }

  const scannedMovieFolderPaths = new Set(scanned.currentMovieFolderPaths);
  const missingMovieFolderPaths = [...existingMovieFolderPaths].filter(
    (p) => !scannedMovieFolderPaths.has(p)
  );
  let deleted = 0;
  if (missingMovieFolderPaths.length > 0) {
    markMoviesDeleted(missingMovieFolderPaths);
    deleted = missingMovieFolderPaths.length;
  }

  return { updated, notFound, errors, deleted };
}
