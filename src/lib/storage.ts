import { getDb } from "./db";
import { getSeriesId } from "@/lib/series";

export type MovieUpsert = {
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
  genres: string[];
  userGenres: string[];
  youtubeTrailerKey: string | null;
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
};

export type MovieRow = Omit<MovieUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
  xxxRated: number;
  watched: number;
};

export type SeasonUpsert = {
  id: string;
  seriesFolderPath: string;
  seasonFolderPath: string;
  seasonNumber: number | null;
  titleRaw: string;
  titleClean: string;
  titleEditedAt: number | null;
  year: number | null;
  tmdbId: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  tmdbRating: number | null;
  genres: string[];
  userGenres: string[];
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
  xxxRated: number;
  watched: number;
};

export type SeasonRow = Omit<SeasonUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
};

export type EpisodeUpsert = {
  id: string;
  seasonId: string;
  episodeNumber: number | null;
  titleRaw: string;
  titleClean: string;
  filePath: string;
  fileSizeBytes: number;
  lastSyncedAt: number;
};

export type EpisodeRow = EpisodeUpsert & {
  watched: number;
};

export type SeriesUpsert = {
  id: string;
  seriesFolderPath: string;
  titleClean: string;
  titleEditedAt: number | null;
  year: number | null;
  tmdbId: number | null;
  posterPath: string | null;
  tmdbRating: number | null;
  genres: string[];
  userGenres: string[];
  errorMessage: string | null;
  lastSyncedAt: number;
};

export type SeriesRow = Omit<SeriesUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
};

export type MovieQuery = {
  q?: string;
  genre?: string;
  minPersonalRating?: number;
  watched?: "all" | "watched" | "unwatched";
  sort?: "title" | "rating" | "recent";
};

export type SeasonQuery = MovieQuery;

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function upsertMovie(movie: MovieUpsert) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO movies (
      id,
      folderPath,
      filePath,
      fileSizeBytes,
      titleRaw,
      titleClean,
      titleEditedAt,
      year,
      tmdbId,
      posterPath,
      backdropPath,
      runtimeMinutes,
      tmdbRating,
      genresJson,
      userGenresJson,
      youtubeTrailerKey,
      personalRating,
      errorMessage,
      lastSyncedAt
    ) VALUES (
      @id,
      @folderPath,
      @filePath,
      @fileSizeBytes,
      @titleRaw,
      @titleClean,
      @titleEditedAt,
      @year,
      @tmdbId,
      @posterPath,
      @backdropPath,
      @runtimeMinutes,
      @tmdbRating,
      @genresJson,
      @userGenresJson,
      @youtubeTrailerKey,
      @personalRating,
      @errorMessage,
      @lastSyncedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      folderPath = excluded.folderPath,
      filePath = excluded.filePath,
      fileSizeBytes = excluded.fileSizeBytes,
      titleRaw = excluded.titleRaw,
      titleClean = excluded.titleClean,
      titleEditedAt = excluded.titleEditedAt,
      year = excluded.year,
      tmdbId = excluded.tmdbId,
      posterPath = excluded.posterPath,
      backdropPath = excluded.backdropPath,
      runtimeMinutes = excluded.runtimeMinutes,
      tmdbRating = excluded.tmdbRating,
      genresJson = excluded.genresJson,
      userGenresJson = excluded.userGenresJson,
      youtubeTrailerKey = excluded.youtubeTrailerKey,
      personalRating = excluded.personalRating,
      errorMessage = excluded.errorMessage,
      lastSyncedAt = excluded.lastSyncedAt
  `
  ).run({
    ...movie,
    genresJson: JSON.stringify(movie.genres),
    userGenresJson: JSON.stringify(movie.userGenres),
  });
}

export function upsertSeason(season: SeasonUpsert) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO seasons (
      id,
      seriesFolderPath,
      seasonFolderPath,
      seasonNumber,
      titleRaw,
      titleClean,
      titleEditedAt,
      year,
      tmdbId,
      posterPath,
      backdropPath,
      tmdbRating,
      genresJson,
      userGenresJson,
      personalRating,
      errorMessage,
      lastSyncedAt,
      xxxRated,
      watched
    ) VALUES (
      @id,
      @seriesFolderPath,
      @seasonFolderPath,
      @seasonNumber,
      @titleRaw,
      @titleClean,
      @titleEditedAt,
      @year,
      @tmdbId,
      @posterPath,
      @backdropPath,
      @tmdbRating,
      @genresJson,
      @userGenresJson,
      @personalRating,
      @errorMessage,
      @lastSyncedAt,
      @xxxRated,
      @watched
    )
    ON CONFLICT(id) DO UPDATE SET
      seriesFolderPath = excluded.seriesFolderPath,
      seasonFolderPath = excluded.seasonFolderPath,
      seasonNumber = excluded.seasonNumber,
      titleRaw = excluded.titleRaw,
      titleClean = excluded.titleClean,
      titleEditedAt = excluded.titleEditedAt,
      year = excluded.year,
      tmdbId = excluded.tmdbId,
      posterPath = excluded.posterPath,
      backdropPath = excluded.backdropPath,
      tmdbRating = excluded.tmdbRating,
      genresJson = excluded.genresJson,
      userGenresJson = excluded.userGenresJson,
      personalRating = excluded.personalRating,
      errorMessage = excluded.errorMessage,
      lastSyncedAt = excluded.lastSyncedAt,
      xxxRated = excluded.xxxRated,
      watched = excluded.watched
    `
  ).run({
    ...season,
    genresJson: JSON.stringify(season.genres),
    userGenresJson: JSON.stringify(season.userGenres),
  });
}

export function upsertEpisode(episode: EpisodeUpsert) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO episodes (
      id,
      seasonId,
      episodeNumber,
      titleRaw,
      titleClean,
      filePath,
      fileSizeBytes,
      lastSyncedAt
    ) VALUES (
      @id,
      @seasonId,
      @episodeNumber,
      @titleRaw,
      @titleClean,
      @filePath,
      @fileSizeBytes,
      @lastSyncedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      seasonId = excluded.seasonId,
      episodeNumber = excluded.episodeNumber,
      titleRaw = excluded.titleRaw,
      titleClean = excluded.titleClean,
      filePath = excluded.filePath,
      fileSizeBytes = excluded.fileSizeBytes,
      lastSyncedAt = excluded.lastSyncedAt
    `
  ).run(episode);
}

export function upsertSeries(series: SeriesUpsert) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO series (
      id,
      seriesFolderPath,
      titleClean,
      titleEditedAt,
      year,
      tmdbId,
      posterPath,
      tmdbRating,
      genresJson,
      userGenresJson,
      errorMessage,
      lastSyncedAt
    ) VALUES (
      @id,
      @seriesFolderPath,
      @titleClean,
      @titleEditedAt,
      @year,
      @tmdbId,
      @posterPath,
      @tmdbRating,
      @genresJson,
      @userGenresJson,
      @errorMessage,
      @lastSyncedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      seriesFolderPath = excluded.seriesFolderPath,
      titleClean = excluded.titleClean,
      titleEditedAt = excluded.titleEditedAt,
      year = excluded.year,
      tmdbId = excluded.tmdbId,
      posterPath = excluded.posterPath,
      tmdbRating = excluded.tmdbRating,
      genresJson = excluded.genresJson,
      userGenresJson = excluded.userGenresJson,
      errorMessage = excluded.errorMessage,
      lastSyncedAt = excluded.lastSyncedAt
    `
  ).run({
    ...series,
    genresJson: JSON.stringify(series.genres),
    userGenresJson: JSON.stringify(series.userGenres),
  });
}

export function listMovies(query: MovieQuery): MovieRow[] {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, string | number> = {};

  if (query.q) {
    where.push(
      "(LOWER(titleClean) LIKE @q OR LOWER(titleRaw) LIKE @q)"
    );
    params.q = `%${query.q.toLowerCase()}%`;
  }

  if (query.genre) {
    where.push("(genresJson LIKE @genre OR userGenresJson LIKE @genre)");
    params.genre = `%\"${query.genre}\"%`;
  }

  if (typeof query.minPersonalRating === "number") {
    where.push("personalRating >= @minPersonalRating");
    params.minPersonalRating = query.minPersonalRating;
  }

  if (query.watched === "watched") {
    where.push("watched = 1");
  } else if (query.watched === "unwatched") {
    where.push("watched = 0");
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  let orderBy = "titleClean ASC";
  if (query.sort === "rating") {
    orderBy = "tmdbRating IS NULL, tmdbRating DESC";
  } else if (query.sort === "recent") {
    orderBy = "lastSyncedAt DESC";
  }

  const sql = `
    SELECT *
    FROM movies
    ${whereClause}
    ORDER BY ${orderBy}
  `;

  return db.prepare(sql).all(params) as MovieRow[];
}

export function listSeasons(query: SeasonQuery): SeasonRow[] {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, string | number> = {};

  if (query.q) {
    where.push("(LOWER(titleClean) LIKE @q OR LOWER(titleRaw) LIKE @q)");
    params.q = `%${query.q.toLowerCase()}%`;
  }

  if (query.genre) {
    where.push("(genresJson LIKE @genre OR userGenresJson LIKE @genre)");
    params.genre = `%\"${query.genre}\"%`;
  }

  if (typeof query.minPersonalRating === "number") {
    where.push("personalRating >= @minPersonalRating");
    params.minPersonalRating = query.minPersonalRating;
  }

  if (query.watched === "watched") {
    where.push("watched = 1");
  } else if (query.watched === "unwatched") {
    where.push("watched = 0");
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  let orderBy = "titleClean ASC";
  if (query.sort === "rating") {
    orderBy = "tmdbRating IS NULL, tmdbRating DESC";
  } else if (query.sort === "recent") {
    orderBy = "lastSyncedAt DESC";
  }

  const sql = `
    SELECT *
    FROM seasons
    ${whereClause}
    ORDER BY ${orderBy}
  `;

  return db.prepare(sql).all(params) as SeasonRow[];
}

export function listSeasonsBySeriesFolderPath(
  seriesFolderPath: string
): SeasonRow[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT *
      FROM seasons
      WHERE seriesFolderPath = ?
      ORDER BY
        CASE WHEN seasonNumber IS NULL THEN 1 ELSE 0 END,
        seasonNumber ASC,
        titleClean ASC
      `
    )
    .all(seriesFolderPath) as SeasonRow[];
}

export function listSeriesFolderPaths(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT DISTINCT seriesFolderPath FROM seasons")
    .all() as Array<{ seriesFolderPath: string }>;
  return rows.map((row) => row.seriesFolderPath);
}

export function getSeriesFolderPathById(seriesId: string): string | null {
  const folders = listSeriesFolderPaths();
  for (const folder of folders) {
    if (getSeriesId(folder) === seriesId) return folder;
  }
  return null;
}

export function listGenres(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT genresJson, userGenresJson FROM movies
      UNION ALL
      SELECT genresJson, userGenresJson FROM seasons
      `
    )
    .all() as { genresJson: string | null; userGenresJson: string | null }[];
  const unique = new Map<string, string>();

  const parseGenres = (genresJson: string | null) => {
    if (!genresJson) return [];
    try {
      const parsed = JSON.parse(genresJson) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  rows.forEach((row) => {
    const merged = [
      ...parseGenres(row.genresJson),
      ...parseGenres(row.userGenresJson),
    ];
    merged.forEach((genreName) => {
      const trimmed = genreName.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (unique.has(key)) return;
      unique.set(key, trimmed);
    });
  });

  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
}

export type MovieUpdate = {
  titleRaw?: string;
  titleClean?: string;
  titleEditedAt?: number | null;
  posterPath?: string | null;
  tmdbId?: number | null;
  backdropPath?: string | null;
  runtimeMinutes?: number | null;
  tmdbRating?: number | null;
  genresJson?: string;
  userGenresJson?: string;
  youtubeTrailerKey?: string | null;
  errorMessage?: string | null;
  lastSyncedAt?: number;
  personalRating?: number | null;
  xxxRated?: number | null;
  watched?: number | null;
};

export function updateMovie(id: string, updates: MovieUpdate) {
  const db = getDb();
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const setClauses = entries.map(([key]) => `${key} = @${key}`).join(", ");
  const params = entries.reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    { id } as Record<string, string | number | null>
  );

  db.prepare(`UPDATE movies SET ${setClauses} WHERE id = @id`).run(params);
}

export type SeasonUpdate = {
  titleRaw?: string;
  titleClean?: string;
  titleEditedAt?: number | null;
  posterPath?: string | null;
  tmdbId?: number | null;
  backdropPath?: string | null;
  tmdbRating?: number | null;
  genresJson?: string;
  userGenresJson?: string;
  errorMessage?: string | null;
  lastSyncedAt?: number;
  personalRating?: number | null;
  xxxRated?: number | null;
  watched?: number | null;
};

export function updateSeason(id: string, updates: SeasonUpdate) {
  const db = getDb();
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const setClauses = entries.map(([key]) => `${key} = @${key}`).join(", ");
  const params = entries.reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    { id } as Record<string, string | number | null>
  );

  db.prepare(`UPDATE seasons SET ${setClauses} WHERE id = @id`).run(params);
}

export type SeriesUpdate = {
  titleClean?: string;
  titleEditedAt?: number | null;
  posterPath?: string | null;
  tmdbId?: number | null;
  tmdbRating?: number | null;
  genresJson?: string;
  userGenresJson?: string;
  errorMessage?: string | null;
  lastSyncedAt?: number;
};

export function updateSeries(id: string, updates: SeriesUpdate) {
  const db = getDb();
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const setClauses = entries.map(([key]) => `${key} = @${key}`).join(", ");
  const params = entries.reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    { id } as Record<string, string | number | null>
  );

  db.prepare(`UPDATE series SET ${setClauses} WHERE id = @id`).run(params);
}

export function updatePersonalRating(id: string, personalRating: number | null) {
  const db = getDb();
  db.prepare(
    "UPDATE movies SET personalRating = @personalRating WHERE id = @id"
  ).run({ id, personalRating });
}

export function getMovieById(id: string): MovieRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM movies WHERE id = ?").get(id);
  return (row as MovieRow | undefined) ?? null;
}

export function getSeasonById(id: string): SeasonRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM seasons WHERE id = ?").get(id);
  return (row as SeasonRow | undefined) ?? null;
}

export function getSeriesById(id: string): SeriesRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM series WHERE id = ?").get(id);
  return (row as SeriesRow | undefined) ?? null;
}

export function getSeriesByFolderPath(seriesFolderPath: string): SeriesRow | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM series WHERE seriesFolderPath = ?")
    .get(seriesFolderPath);
  return (row as SeriesRow | undefined) ?? null;
}

export function deleteSeasonById(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM seasons WHERE id = ?").run(id);
}

export function getEpisodesBySeasonId(seasonId: string): EpisodeRow[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT *
      FROM episodes
      WHERE seasonId = ?
      ORDER BY
        CASE WHEN episodeNumber IS NULL THEN 1 ELSE 0 END,
        episodeNumber ASC,
        titleClean ASC
      `
    )
    .all(seasonId) as EpisodeRow[];
}

export function countEpisodesBySeasonId(seasonId: string): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM episodes WHERE seasonId = ?")
    .get(seasonId) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function getEpisodeCountsBySeasonIds(seasonIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  if (seasonIds.length === 0) return counts;
  const db = getDb();
  const placeholders = seasonIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `
      SELECT seasonId, COUNT(*) as count
      FROM episodes
      WHERE seasonId IN (${placeholders})
      GROUP BY seasonId
      `
    )
    .all(...seasonIds) as Array<{ seasonId: string; count: number }>;
  rows.forEach((row) => counts.set(row.seasonId, row.count));
  return counts;
}

export function getEpisodeById(id: string): EpisodeRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM episodes WHERE id = ?").get(id);
  return (row as EpisodeRow | undefined) ?? null;
}

export type EpisodeUpdate = {
  watched?: number;
};

export function updateEpisode(id: string, updates: EpisodeUpdate) {
  const db = getDb();
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const setClauses = entries.map(([key]) => `${key} = @${key}`).join(", ");
  const params = entries.reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    { id } as Record<string, string | number | null>
  );

  db.prepare(`UPDATE episodes SET ${setClauses} WHERE id = @id`).run(params);
}

export function deleteEpisodesNotInSeason(
  seasonId: string,
  filePaths: string[]
) {
  const db = getDb();
  if (filePaths.length === 0) {
    db.prepare("DELETE FROM episodes WHERE seasonId = ?").run(seasonId);
    return;
  }
  const placeholders = filePaths.map(() => "?").join(", ");
  db.prepare(
    `
    DELETE FROM episodes
    WHERE seasonId = ?
    AND filePath NOT IN (${placeholders})
    `
  ).run(seasonId, ...filePaths);
}

