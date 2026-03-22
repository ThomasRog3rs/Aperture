import crypto from "node:crypto";
import path from "node:path";
import { cleanTitle } from "@/lib/cleanTitle";
import { scanLibraryIncremental } from "@/lib/scan";
import { resolveOmdbMovie, resolveOmdbSeries } from "@/lib/omdb";
import {
  countEpisodesBySeasonId,
  getAllMovieFolderPaths,
  listAllFolderScanEntries,
  listAllFolderScanStates,
  getAllSeasonFolderPaths,
  getMovieById,
  getSeasonById,
  getSetting,
  markEpisodesDeletedNotInSeason,
  markMoviesDeleted,
  markSeasonDeleted,
  markSeasonsDeleted,
  saveFolderScanSnapshot,
  upsertEpisode,
  upsertMovie,
  upsertSeason,
} from "@/lib/storage";

export const runtime = "nodejs";

// Module-level controller so DELETE can abort the active sync.
let currentSyncController: AbortController | null = null;

const encoder = new TextEncoder();

function sseChunk(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function DELETE() {
  if (currentSyncController) {
    currentSyncController.abort();
    return Response.json({ cancelled: true });
  }
  return Response.json({ cancelled: false });
}

function parseGenres(genresJson: string | null) {
  if (!genresJson) return [];
  try {
    const parsed = JSON.parse(genresJson) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePeople(peopleJson: string | null) {
  if (!peopleJson) return [];
  try {
    const parsed = JSON.parse(peopleJson) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST() {
  // Abort any in-flight sync before starting a new one.
  if (currentSyncController) {
    currentSyncController.abort();
  }
  const aborter = new AbortController();
  currentSyncController = aborter;
  const { signal } = aborter;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseChunk(data));

      try {
        const libraryRootPath = getSetting("libraryRootPath");
        if (!libraryRootPath) {
          emit({ type: "error", error: "Library path not set." });
          return;
        }

        emit({ type: "phase", phase: "scanning" });

        const previousScanStates = listAllFolderScanStates();
        const previousScanEntries = listAllFolderScanEntries();
        let scanned;
        try {
          scanned = await scanLibraryIncremental(
            libraryRootPath,
            previousScanStates,
            previousScanEntries
          );
        } catch (error) {
          emit({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "Failed to scan library.",
          });
          return;
        }

        if (signal.aborted) { emit({ type: "cancelled" }); return; }

        const syncedAt = Date.now();
        let updated = 0;
        let notFound = 0;
        let errors = 0;
        let seasonsUpdated = 0;
        let seasonsNotFound = 0;
        let seasonsErrors = 0;
        let moviesDeleted = 0;
        let seasonsDeleted = 0;

        const existingMovieFolderPaths = new Set(getAllMovieFolderPaths());
        const existingSeasonFolderPaths = new Set(getAllSeasonFolderPaths());

        // --- Movies ---
        emit({ type: "phase", phase: "movies" });
        const totalMovies = scanned.movies.length;
        for (let i = 0; i < totalMovies; i++) {
          if (signal.aborted) { emit({ type: "cancelled" }); return; }

          const entry = scanned.movies[i];
          emit({
            type: "progress",
            phase: "movies",
            current: i + 1,
            total: totalMovies,
            title: entry.titleRaw,
          });

          const id = crypto
            .createHash("sha1")
            .update(entry.folderPath)
            .digest("hex");

          const existing = getMovieById(id);
          const existingGenres = existing ? parseGenres(existing.genresJson) : [];
          const existingUserGenres = existing ? parseGenres(existing.userGenresJson) : [];
          const existingDirectors = existing ? parsePeople(existing.directorsJson) : [];
          const existingWriters = existing ? parsePeople(existing.writersJson) : [];
          const existingActors = existing ? parsePeople(existing.actorsJson) : [];
          const missingCrew =
            !existing ||
            existingDirectors.length === 0 ||
            existingWriters.length === 0 ||
            existingActors.length === 0;
          const { titleClean: derivedTitleClean, year } = cleanTitle(entry.titleRaw);
          const titleEditedAt = existing?.titleEditedAt ?? null;
          const titleClean = titleEditedAt
            ? existing?.titleClean ?? derivedTitleClean
            : derivedTitleClean;
          const titleRaw = titleEditedAt
            ? existing?.titleRaw ?? entry.titleRaw
            : entry.titleRaw;
          let errorMessage = entry.errorMessage;
          let tmdbData = null;

          if (!errorMessage && missingCrew) {
            try {
              tmdbData = await resolveOmdbMovie(titleClean, year);
            } catch (error) {
              errorMessage =
                error instanceof Error ? error.message : "OMDb lookup failed.";
            }
          }

          if (!tmdbData && existing?.tmdbId) {
            tmdbData = {
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
            };
          }

          if (!tmdbData && !errorMessage) notFound += 1;
          if (errorMessage) errors += 1;

          const existingPoster = existing?.posterPath ?? null;
          const keepPoster =
            typeof existingPoster === "string" &&
            (existingPoster.startsWith("http://") ||
              existingPoster.startsWith("https://") ||
              existingPoster.startsWith("/api/"));

          upsertMovie({
            id,
            folderPath: entry.folderPath,
            filePath: entry.filePath,
            fileSizeBytes: entry.fileSizeBytes,
            titleRaw,
            titleClean,
            titleEditedAt,
            year,
            tmdbId: tmdbData?.providerId ?? existing?.tmdbId ?? null,
            posterPath: keepPoster
              ? existingPoster
              : tmdbData?.posterPath ?? existing?.posterPath ?? null,
            backdropPath: tmdbData?.backdropPath ?? existing?.backdropPath ?? null,
            runtimeMinutes: tmdbData?.runtimeMinutes ?? existing?.runtimeMinutes ?? null,
            tmdbRating: tmdbData?.tmdbRating ?? existing?.tmdbRating ?? null,
            genres: (tmdbData?.genres?.length ? tmdbData.genres : existingGenres) ?? [],
            directors: (tmdbData?.directors?.length ? tmdbData.directors : existingDirectors) ?? [],
            writers: (tmdbData?.writers?.length ? tmdbData.writers : existingWriters) ?? [],
            actors: (tmdbData?.actors?.length ? tmdbData.actors : existingActors) ?? [],
            userGenres: existingUserGenres,
            youtubeTrailerKey:
              tmdbData?.youtubeTrailerKey ?? existing?.youtubeTrailerKey ?? null,
            personalRating: existing?.personalRating ?? null,
            errorMessage,
            lastSyncedAt: syncedAt,
          });

          updated += 1;
        }

        // --- Soft-delete missing movies ---
        const scannedMovieFolderPaths = new Set(scanned.currentMovieFolderPaths);
        const missingMovieFolderPaths = [...existingMovieFolderPaths].filter(
          (p) => !scannedMovieFolderPaths.has(p)
        );
        if (missingMovieFolderPaths.length > 0) {
          markMoviesDeleted(missingMovieFolderPaths);
          moviesDeleted = missingMovieFolderPaths.length;
        }

        if (signal.aborted) { emit({ type: "cancelled" }); return; }

        // --- Seasons ---
        emit({ type: "phase", phase: "seasons" });
        const totalSeasons = scanned.seasons.length;
        for (let i = 0; i < totalSeasons; i++) {
          if (signal.aborted) { emit({ type: "cancelled" }); return; }

          const season = scanned.seasons[i];
          const seriesTitleRaw = path.basename(season.seriesFolderPath);
          emit({
            type: "progress",
            phase: "seasons",
            current: i + 1,
            total: totalSeasons,
            title: seriesTitleRaw,
          });

          const id = crypto
            .createHash("sha1")
            .update(season.seasonFolderPath)
            .digest("hex");

          const existing = getSeasonById(id);
          const existingGenres = existing ? parseGenres(existing.genresJson) : [];
          const existingUserGenres = existing ? parseGenres(existing.userGenresJson) : [];
          const existingDirectors = existing ? parsePeople(existing.directorsJson) : [];
          const existingWriters = existing ? parsePeople(existing.writersJson) : [];
          const existingActors = existing ? parsePeople(existing.actorsJson) : [];
          const missingCrew =
            !existing ||
            existingDirectors.length === 0 ||
            existingWriters.length === 0 ||
            existingActors.length === 0;
          const { titleClean: seriesTitleClean, year } = cleanTitle(seriesTitleRaw);
          const derivedTitleClean = season.seasonNumber
            ? `${seriesTitleClean} - Season ${season.seasonNumber}`
            : `${seriesTitleClean} - ${season.titleRaw}`;
          const titleEditedAt = existing?.titleEditedAt ?? null;
          const titleClean = titleEditedAt
            ? existing?.titleClean ?? derivedTitleClean
            : derivedTitleClean;
          const titleRaw = titleEditedAt
            ? existing?.titleRaw ?? season.titleRaw
            : season.titleRaw;
          let errorMessage = season.errorMessage;
          let tmdbData = null;

          if (!errorMessage && missingCrew) {
            try {
              tmdbData = await resolveOmdbSeries(seriesTitleClean, year);
            } catch (error) {
              errorMessage =
                error instanceof Error ? error.message : "OMDb lookup failed.";
            }
          }

          if (!tmdbData && existing?.tmdbId) {
            tmdbData = {
              providerId: existing.tmdbId,
              posterPath: existing.posterPath,
              backdropPath: existing.backdropPath,
              runtimeMinutes: null,
              tmdbRating: existing.tmdbRating,
              genres: existingGenres,
              directors: existingDirectors,
              writers: existingWriters,
              actors: existingActors,
              youtubeTrailerKey: null,
            };
          }

          if (!tmdbData && !errorMessage) seasonsNotFound += 1;
          if (errorMessage) seasonsErrors += 1;

          const existingPoster = existing?.posterPath ?? null;
          const keepPoster =
            typeof existingPoster === "string" &&
            (existingPoster.startsWith("http://") ||
              existingPoster.startsWith("https://") ||
              existingPoster.startsWith("/api/"));

          upsertSeason({
            id,
            seriesFolderPath: season.seriesFolderPath,
            seasonFolderPath: season.seasonFolderPath,
            seasonNumber: season.seasonNumber,
            titleRaw,
            titleClean,
            titleEditedAt,
            year,
            tmdbId: tmdbData?.providerId ?? existing?.tmdbId ?? null,
            posterPath: keepPoster
              ? existingPoster
              : tmdbData?.posterPath ?? existing?.posterPath ?? null,
            backdropPath: tmdbData?.backdropPath ?? existing?.backdropPath ?? null,
            tmdbRating: tmdbData?.tmdbRating ?? existing?.tmdbRating ?? null,
            genres: (tmdbData?.genres?.length ? tmdbData.genres : existingGenres) ?? [],
            directors: (tmdbData?.directors?.length ? tmdbData.directors : existingDirectors) ?? [],
            writers: (tmdbData?.writers?.length ? tmdbData.writers : existingWriters) ?? [],
            actors: (tmdbData?.actors?.length ? tmdbData.actors : existingActors) ?? [],
            userGenres: existingUserGenres,
            personalRating: existing?.personalRating ?? null,
            errorMessage,
            lastSyncedAt: syncedAt,
            xxxRated: existing?.xxxRated ?? 0,
            watched: existing?.watched ?? 0,
          });

          const episodeFilePaths: string[] = [];
          for (const episode of season.episodes) {
            const episodeId = crypto
              .createHash("sha1")
              .update(episode.filePath)
              .digest("hex");
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
            seasonsUpdated += 1;
          }
        }

        if (signal.aborted) { emit({ type: "cancelled" }); return; }

        // --- Soft-delete missing seasons ---
        emit({ type: "phase", phase: "cleanup" });
        const scannedSeasonFolderPaths = new Set(scanned.currentSeasonFolderPaths);
        const missingSeasonFolderPaths = [...existingSeasonFolderPaths].filter(
          (p) => !scannedSeasonFolderPaths.has(p)
        );
        if (missingSeasonFolderPaths.length > 0) {
          markSeasonsDeleted(missingSeasonFolderPaths);
          seasonsDeleted = missingSeasonFolderPaths.length;
        }

        emit({ type: "phase", phase: "saving" });
        saveFolderScanSnapshot(
          libraryRootPath,
          scanned.scanStates,
          scanned.scanEntries,
          syncedAt
        );

        emit({
          type: "complete",
          summary: {
            mode: "incremental",
            folders: {
              checked: scanned.stats.rootFoldersChecked + scanned.stats.seasonFoldersChecked,
              rootChecked: scanned.stats.rootFoldersChecked,
              seasonChecked: scanned.stats.seasonFoldersChecked,
              changed: scanned.stats.foldersChanged,
              rescanned: scanned.stats.foldersRescanned,
            },
            movies: {
              scanned: scanned.currentMovieFolderPaths.length,
              updated,
              notFound,
              errors,
              deleted: moviesDeleted,
            },
            seasons: {
              scanned: scanned.currentSeasonFolderPaths.length,
              updated: seasonsUpdated,
              notFound: seasonsNotFound,
              errors: seasonsErrors,
              deleted: seasonsDeleted,
            },
          },
        });
      } catch (err) {
        if (!signal.aborted) {
          emit({
            type: "error",
            error: err instanceof Error ? err.message : "Sync failed.",
          });
        }
      } finally {
        if (currentSyncController === aborter) currentSyncController = null;
        controller.close();
      }
    },
    cancel() {
      // Client disconnected — abort server-side processing.
      aborter.abort();
      if (currentSyncController === aborter) currentSyncController = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
