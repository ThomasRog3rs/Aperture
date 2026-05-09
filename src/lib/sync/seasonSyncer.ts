import path from "node:path";
import { cleanTitle } from "@/lib/cleanTitle";
import { resolveOmdbSeries } from "@/lib/omdb";
import type { OmdbMovie } from "@/lib/omdb";
import {
  countEpisodesBySeasonId,
  getAllSeasonFolderPaths,
  getSeasonById,
  markEpisodesDeletedNotInSeason,
  markSeasonDeleted,
  markSeasonsDeleted,
  upsertEpisode,
  upsertSeason,
} from "@/lib/storage";
import type { SeasonUpsert } from "@/lib/storage";
import type { ScannedSeason } from "@/lib/scan";
import type { SeasonRow } from "@/lib/storage";
import {
  generateMediaId,
  parseJsonArray,
  resolveTitle,
  shouldKeepPoster,
} from "./mediaUtils";
import type { SeasonSyncStats, SyncEmitter } from "./types";

type ScannedResult = {
  seasons: ScannedSeason[];
  currentSeasonFolderPaths: string[];
};

export function buildSeasonPayload(
  season: ScannedSeason,
  existing: SeasonRow | null,
  omdbData: OmdbMovie | null,
  syncedAt: number,
  id: string
): SeasonUpsert {
  const seriesTitleRaw = path.basename(season.seriesFolderPath);
  const existingGenres = existing ? parseJsonArray(existing.genresJson) : [];
  const existingUserGenres = existing ? parseJsonArray(existing.userGenresJson) : [];
  const existingDirectors = existing ? parseJsonArray(existing.directorsJson) : [];
  const existingWriters = existing ? parseJsonArray(existing.writersJson) : [];
  const existingActors = existing ? parseJsonArray(existing.actorsJson) : [];

  const { titleClean: seriesTitleClean } = cleanTitle(seriesTitleRaw);
  const derivedTitleClean = season.seasonNumber
    ? `${seriesTitleClean} - Season ${season.seasonNumber}`
    : `${seriesTitleClean} - ${season.titleRaw}`;

  const { titleClean, titleRaw } = resolveTitle(existing, derivedTitleClean, season.titleRaw);

  const { year } = cleanTitle(seriesTitleRaw);
  const existingPoster = existing?.posterPath ?? null;

  const resolvedOmdb =
    !omdbData && existing?.tmdbId
      ? {
          providerId: existing.tmdbId,
          posterPath: existing.posterPath,
          backdropPath: existing.backdropPath,
          runtimeMinutes: null as null,
          tmdbRating: existing.tmdbRating,
          genres: existingGenres,
          directors: existingDirectors,
          writers: existingWriters,
          actors: existingActors,
          youtubeTrailerKey: null as null,
        }
      : omdbData;

  return {
    id,
    seriesFolderPath: season.seriesFolderPath,
    seasonFolderPath: season.seasonFolderPath,
    seasonNumber: season.seasonNumber,
    titleRaw,
    titleClean,
    titleEditedAt: existing?.titleEditedAt ?? null,
    year,
    tmdbId: resolvedOmdb?.providerId ?? existing?.tmdbId ?? null,
    posterPath: shouldKeepPoster(existingPoster)
      ? existingPoster
      : resolvedOmdb?.posterPath ?? existing?.posterPath ?? null,
    backdropPath: resolvedOmdb?.backdropPath ?? existing?.backdropPath ?? null,
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
    personalRating: existing?.personalRating ?? null,
    errorMessage: season.errorMessage,
    lastSyncedAt: syncedAt,
    xxxRated: existing?.xxxRated ?? 0,
    watched: existing?.watched ?? 0,
  };
}

export async function syncSeasons(
  scanned: ScannedResult,
  signal: AbortSignal,
  syncedAt: number,
  emit: SyncEmitter
): Promise<SeasonSyncStats> {
  const existingSeasonFolderPaths = new Set(getAllSeasonFolderPaths());
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  emit({ type: "phase", phase: "seasons" });
  const totalSeasons = scanned.seasons.length;

  for (let i = 0; i < totalSeasons; i++) {
    if (signal.aborted) {
      emit({ type: "cancelled" });
      return { updated, notFound, errors, deleted: 0 };
    }

    const season = scanned.seasons[i];
    const seriesTitleRaw = path.basename(season.seriesFolderPath);
    emit({
      type: "progress",
      phase: "seasons",
      current: i + 1,
      total: totalSeasons,
      title: seriesTitleRaw,
    });

    const id = generateMediaId(season.seasonFolderPath);
    const existing = getSeasonById(id);

    const existingDirectors = existing ? parseJsonArray(existing.directorsJson) : [];
    const existingWriters = existing ? parseJsonArray(existing.writersJson) : [];
    const existingActors = existing ? parseJsonArray(existing.actorsJson) : [];
    const missingCrew =
      !existing ||
      existingDirectors.length === 0 ||
      existingWriters.length === 0 ||
      existingActors.length === 0;

    const { titleClean: seriesTitleClean, year } = cleanTitle(seriesTitleRaw);
    let errorMessage = season.errorMessage;
    let omdbData: OmdbMovie | null = null;

    if (!errorMessage && missingCrew) {
      try {
        omdbData = await resolveOmdbSeries(seriesTitleClean, year);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "OMDb lookup failed.";
      }
    }

    const payload = buildSeasonPayload(
      { ...season, errorMessage },
      existing ?? null,
      omdbData,
      syncedAt,
      id
    );
    upsertSeason(payload);

    const episodeFilePaths: string[] = [];
    for (const episode of season.episodes) {
      const episodeId = generateMediaId(episode.filePath);
      episodeFilePaths.push(episode.filePath);
      upsertEpisode({
        id: episodeId,
        seasonId: id,
        episodeNumber: episode.episodeNumber,
        titleRaw: episode.titleRaw,
        titleClean: episode.titleClean,
        filePath: episode.filePath,
        fileSizeBytes: episode.fileSizeBytes,
        lastSyncedAt: syncedAt,
      });
    }

    markEpisodesDeletedNotInSeason(id, episodeFilePaths);
    const episodeCount = countEpisodesBySeasonId(id);
    if (episodeCount === 0 && !errorMessage) {
      markSeasonDeleted(id);
    } else {
      if (!omdbData && !errorMessage) notFound += 1;
      if (errorMessage) errors += 1;
      updated += 1;
    }
  }

  emit({ type: "phase", phase: "cleanup" });
  const scannedSeasonFolderPaths = new Set(scanned.currentSeasonFolderPaths);
  const missingSeasonFolderPaths = [...existingSeasonFolderPaths].filter(
    (p) => !scannedSeasonFolderPaths.has(p)
  );
  let deleted = 0;
  if (missingSeasonFolderPaths.length > 0) {
    markSeasonsDeleted(missingSeasonFolderPaths);
    deleted = missingSeasonFolderPaths.length;
  }

  return { updated, notFound, errors, deleted };
}
