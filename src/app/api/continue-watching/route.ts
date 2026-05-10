import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSeriesId } from "@/lib/series";
import type { ContinueWatchingItem, Episode, Movie, Season, Series } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_PROGRESS_SECONDS = 30;
const MAX_ITEMS = 10;

function parseJson(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeGenres(omdb: string[], user: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const g of [...omdb, ...user]) {
    const key = g.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(g.trim());
  }
  return merged;
}

type MovieDbRow = {
  id: string;
  folderPath: string;
  filePath: string;
  fileSizeBytes: number;
  titleRaw: string;
  titleClean: string;
  titleEditedAt: number | null;
  year: number | null;
  tmdbId: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  runtimeMinutes: number | null;
  tmdbRating: number | null;
  genresJson: string;
  userGenresJson: string;
  directorsJson: string;
  writersJson: string;
  actorsJson: string;
  youtubeTrailerKey: string | null;
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
  xxxRated: number;
  watched: number;
  watchProgressSeconds: number;
  watchProgressUpdatedAt: number;
  durationSeconds: number;
  transcodeStatus: string | null;
  transcodedPath: string | null;
  hlsPath: string | null;
  storyboardPath: string | null;
  selectedSubtitleId: string | null;
  subtitlesEnabled: number;
};

type EpisodeDbRow = {
  id: string;
  seasonId: string;
  episodeNumber: number | null;
  titleRaw: string;
  titleClean: string;
  filePath: string;
  fileSizeBytes: number;
  lastSyncedAt: number;
  watched: number;
  watchProgressSeconds: number;
  watchProgressUpdatedAt: number;
  durationSeconds: number;
  transcodeStatus: string | null;
  transcodedPath: string | null;
  hlsPath: string | null;
  storyboardPath: string | null;
  selectedSubtitleId: string | null;
  subtitlesEnabled: number;
  // joined season fields
  seasonFolderPath: string;
  seriesFolderPath: string;
  seasonNumber: number | null;
  seasonTitleClean: string;
  seasonTitleRaw: string;
  seasonTitleEditedAt: number | null;
  seasonYear: number | null;
  seasonTmdbId: number | null;
  seasonPosterPath: string | null;
  seasonBackdropPath: string | null;
  seasonTmdbRating: number | null;
  seasonGenresJson: string;
  seasonUserGenresJson: string;
  seasonDirectorsJson: string;
  seasonWritersJson: string;
  seasonActorsJson: string;
  seasonPersonalRating: number | null;
  seasonErrorMessage: string | null;
  seasonLastSyncedAt: number;
  seasonXxxRated: number;
  seasonWatched: number;
  // joined series fields
  seriesId: string | null;
  seriesTitleClean: string | null;
  seriesPosterPath: string | null;
  seriesTmdbRating: number | null;
  seriesLastSyncedAt: number | null;
  seriesGenresJson: string | null;
  seriesUserGenresJson: string | null;
  seriesDirectorsJson: string | null;
  seriesWritersJson: string | null;
  seriesActorsJson: string | null;
  seriesErrorMessage: string | null;
};

export async function GET() {
  const db = getDb();

  // In-progress movies
  const movieRows = db
    .prepare(
      `SELECT * FROM movies
       WHERE watchProgressSeconds >= ? AND watched = 0 AND deletedAt IS NULL
       ORDER BY watchProgressUpdatedAt DESC
       LIMIT ?`
    )
    .all(MIN_PROGRESS_SECONDS, MAX_ITEMS) as MovieDbRow[];

  // In-progress episodes, joined with their season and series
  const episodeRows = db
    .prepare(
      `SELECT
         e.*,
         s.seasonFolderPath,
         s.seriesFolderPath,
         s.seasonNumber,
         s.titleClean      AS seasonTitleClean,
         s.titleRaw        AS seasonTitleRaw,
         s.titleEditedAt   AS seasonTitleEditedAt,
         s.year            AS seasonYear,
         s.tmdbId          AS seasonTmdbId,
         s.posterPath      AS seasonPosterPath,
         s.backdropPath    AS seasonBackdropPath,
         s.tmdbRating      AS seasonTmdbRating,
         s.genresJson      AS seasonGenresJson,
         s.userGenresJson  AS seasonUserGenresJson,
         s.directorsJson   AS seasonDirectorsJson,
         s.writersJson     AS seasonWritersJson,
         s.actorsJson      AS seasonActorsJson,
         s.personalRating  AS seasonPersonalRating,
         s.errorMessage    AS seasonErrorMessage,
         s.lastSyncedAt    AS seasonLastSyncedAt,
         s.xxxRated        AS seasonXxxRated,
         s.watched         AS seasonWatched,
         sr.id             AS seriesId,
         sr.titleClean     AS seriesTitleClean,
         sr.posterPath     AS seriesPosterPath,
         sr.tmdbRating     AS seriesTmdbRating,
         sr.lastSyncedAt   AS seriesLastSyncedAt,
         sr.genresJson     AS seriesGenresJson,
         sr.userGenresJson AS seriesUserGenresJson,
         sr.directorsJson  AS seriesDirectorsJson,
         sr.writersJson    AS seriesWritersJson,
         sr.actorsJson     AS seriesActorsJson,
         sr.errorMessage   AS seriesErrorMessage
       FROM episodes e
       JOIN seasons s ON e.seasonId = s.id
       LEFT JOIN series sr ON s.seriesFolderPath = sr.seriesFolderPath
       WHERE e.watchProgressSeconds >= ? AND e.watched = 0 AND e.deletedAt IS NULL
         AND s.deletedAt IS NULL
       ORDER BY e.watchProgressUpdatedAt DESC
       LIMIT ?`
    )
    .all(MIN_PROGRESS_SECONDS, MAX_ITEMS) as EpisodeDbRow[];

  // Map movies
  const movieItems: (ContinueWatchingItem & { _updatedAt: number })[] = movieRows.map((row) => {
    const movie: Movie = {
      id: row.id,
      folderPath: row.folderPath,
      filePath: row.filePath,
      fileSizeBytes: row.fileSizeBytes,
      titleRaw: row.titleRaw,
      titleClean: row.titleClean,
      titleEditedAt: row.titleEditedAt,
      year: row.year,
      tmdbId: row.tmdbId,
      posterPath: row.posterPath,
      backdropPath: row.backdropPath,
      runtimeMinutes: row.runtimeMinutes,
      tmdbRating: row.tmdbRating,
      genres: mergeGenres(parseJson(row.genresJson), parseJson(row.userGenresJson)),
      omdbGenres: parseJson(row.genresJson),
      userGenres: parseJson(row.userGenresJson),
      directors: parseJson(row.directorsJson),
      writers: parseJson(row.writersJson),
      actors: parseJson(row.actorsJson),
      youtubeTrailerKey: row.youtubeTrailerKey,
      personalRating: row.personalRating,
      errorMessage: row.errorMessage,
      lastSyncedAt: row.lastSyncedAt,
      xxxRated: Boolean(row.xxxRated),
      watched: Boolean(row.watched),
      watchProgressSeconds: row.watchProgressSeconds,
      watchProgressUpdatedAt: row.watchProgressUpdatedAt,
      durationSeconds: row.durationSeconds,
      transcodeStatus: row.transcodeStatus ?? undefined,
      transcodedPath: row.transcodedPath,
      hlsPath: row.hlsPath,
      storyboardPath: row.storyboardPath,
      selectedSubtitleId: row.selectedSubtitleId,
      subtitlesEnabled: Boolean(row.subtitlesEnabled),
    };
    return {
      type: "movie" as const,
      movie,
      progressSeconds: row.watchProgressSeconds,
      durationSeconds: row.durationSeconds || (row.runtimeMinutes ? row.runtimeMinutes * 60 : 0),
      updatedAt: row.watchProgressUpdatedAt,
      _updatedAt: row.watchProgressUpdatedAt,
    };
  });

  // Map episodes
  const episodeItems: (ContinueWatchingItem & { _updatedAt: number })[] = episodeRows.map((row) => {
    const episode: Episode = {
      id: row.id,
      seasonId: row.seasonId,
      episodeNumber: row.episodeNumber,
      titleRaw: row.titleRaw,
      titleClean: row.titleClean,
      filePath: row.filePath,
      fileSizeBytes: row.fileSizeBytes,
      lastSyncedAt: row.lastSyncedAt,
      watched: Boolean(row.watched),
      watchProgressSeconds: row.watchProgressSeconds,
      watchProgressUpdatedAt: row.watchProgressUpdatedAt,
      durationSeconds: row.durationSeconds,
      transcodeStatus: row.transcodeStatus ?? undefined,
      transcodedPath: row.transcodedPath,
      hlsPath: row.hlsPath,
      storyboardPath: row.storyboardPath,
      selectedSubtitleId: row.selectedSubtitleId,
      subtitlesEnabled: Boolean(row.subtitlesEnabled),
    };

    const season: Season = {
      id: row.seasonId,
      seriesFolderPath: row.seriesFolderPath,
      seriesId: row.seriesId ?? getSeriesId(row.seriesFolderPath),
      seasonFolderPath: row.seasonFolderPath,
      seasonNumber: row.seasonNumber,
      titleRaw: row.seasonTitleRaw,
      titleClean: row.seasonTitleClean,
      titleEditedAt: row.seasonTitleEditedAt,
      year: row.seasonYear,
      tmdbId: row.seasonTmdbId,
      posterPath: row.seasonPosterPath,
      backdropPath: row.seasonBackdropPath,
      tmdbRating: row.seasonTmdbRating,
      genres: mergeGenres(parseJson(row.seasonGenresJson), parseJson(row.seasonUserGenresJson)),
      omdbGenres: parseJson(row.seasonGenresJson),
      userGenres: parseJson(row.seasonUserGenresJson),
      directors: parseJson(row.seasonDirectorsJson),
      writers: parseJson(row.seasonWritersJson),
      actors: parseJson(row.seasonActorsJson),
      personalRating: row.seasonPersonalRating,
      errorMessage: row.seasonErrorMessage,
      lastSyncedAt: row.seasonLastSyncedAt,
      xxxRated: Boolean(row.seasonXxxRated),
      watched: Boolean(row.seasonWatched),
    };

    const seriesId = row.seriesId ?? getSeriesId(row.seriesFolderPath);
    const series: Series = {
      id: seriesId,
      titleClean: row.seriesTitleClean ?? season.titleClean,
      seasonCount: 1,
      posterPath: row.seriesPosterPath ?? season.posterPath,
      seasons: [season],
    };

    return {
      type: "episode" as const,
      episode,
      season,
      series,
      progressSeconds: row.watchProgressSeconds,
      durationSeconds: row.durationSeconds,
      updatedAt: row.watchProgressUpdatedAt,
      _updatedAt: row.watchProgressUpdatedAt,
    };
  });

  // Merge, sort by most recently watched, cap at MAX_ITEMS
  const combined = [...movieItems, ...episodeItems]
    .sort((a, b) => b._updatedAt - a._updatedAt)
    .slice(0, MAX_ITEMS)
    .map(({ _updatedAt: _, ...item }) => item);

  return NextResponse.json({ items: combined });
}
