import crypto from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { cleanTitle } from "@/lib/cleanTitle";
import { scanLibrary } from "@/lib/scan";
import { resolveOmdbMovie, resolveOmdbSeries } from "@/lib/omdb";
import {
  countEpisodesBySeasonId,
  deleteEpisodesNotInSeason,
  deleteSeasonById,
  getMovieById,
  getSeasonById,
  getSetting,
  upsertEpisode,
  upsertMovie,
  upsertSeason,
} from "@/lib/storage";

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
  let seasonsUpdated = 0;
  let seasonsNotFound = 0;
  let seasonsErrors = 0;

  for (const entry of scanned.movies) {
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
        tmdbId: existing.tmdbId,
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

    if (!tmdbData && !errorMessage) {
      notFound += 1;
    }

    if (errorMessage) {
      errors += 1;
    }

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
      tmdbId: tmdbData?.providerId ?? null,
      posterPath: keepPoster ? existingPoster : tmdbData?.posterPath ?? null,
      backdropPath: tmdbData?.backdropPath ?? null,
      runtimeMinutes: tmdbData?.runtimeMinutes ?? null,
      tmdbRating: tmdbData?.tmdbRating ?? null,
      genres: tmdbData?.genres ?? [],
      directors: tmdbData?.directors ?? [],
      writers: tmdbData?.writers ?? [],
      actors: tmdbData?.actors ?? [],
      userGenres: existingUserGenres,
      youtubeTrailerKey: tmdbData?.youtubeTrailerKey ?? null,
      personalRating: existing?.personalRating ?? null,
      errorMessage,
      lastSyncedAt: Date.now(),
    });

    updated += 1;
  }

  for (const season of scanned.seasons) {
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
    const seriesTitleRaw = path.basename(season.seriesFolderPath);
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

    if (!tmdbData && !errorMessage) {
      seasonsNotFound += 1;
    }

    if (errorMessage) {
      seasonsErrors += 1;
    }

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
      tmdbId: tmdbData?.providerId ?? null,
      posterPath: keepPoster ? existingPoster : tmdbData?.posterPath ?? null,
      backdropPath: tmdbData?.backdropPath ?? null,
      tmdbRating: tmdbData?.tmdbRating ?? null,
      genres: tmdbData?.genres ?? [],
      directors: tmdbData?.directors ?? [],
      writers: tmdbData?.writers ?? [],
      actors: tmdbData?.actors ?? [],
      userGenres: existingUserGenres,
      personalRating: existing?.personalRating ?? null,
      errorMessage,
      lastSyncedAt: Date.now(),
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
        lastSyncedAt: Date.now(),
      });
    }

    deleteEpisodesNotInSeason(id, episodeFilePaths);
    const episodeCount = countEpisodesBySeasonId(id);
    if (episodeCount === 0 && !errorMessage) {
      deleteSeasonById(id);
    } else {
      seasonsUpdated += 1;
    }
  }

  return NextResponse.json({
    movies: {
      scanned: scanned.movies.length,
      updated,
      notFound,
      errors,
    },
    seasons: {
      scanned: scanned.seasons.length,
      updated: seasonsUpdated,
      notFound: seasonsNotFound,
      errors: seasonsErrors,
    },
  });
}

