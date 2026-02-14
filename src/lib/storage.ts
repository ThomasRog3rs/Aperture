import { getDb } from "@/lib/db";

export type MovieUpsert = {
  id: string;
  folderPath: string;
  filePath: string;
  fileSizeBytes: number;
  titleRaw: string;
  titleClean: string;
  year: number | null;
  tmdbId: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  runtimeMinutes: number | null;
  tmdbRating: number | null;
  genres: string[];
  youtubeTrailerKey: string | null;
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
};

export type MovieRow = Omit<MovieUpsert, "genres"> & {
  genresJson: string;
};

export type MovieQuery = {
  q?: string;
  genre?: string;
  minPersonalRating?: number;
  sort?: "title" | "rating" | "recent";
};

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
      year,
      tmdbId,
      posterPath,
      backdropPath,
      runtimeMinutes,
      tmdbRating,
      genresJson,
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
      @year,
      @tmdbId,
      @posterPath,
      @backdropPath,
      @runtimeMinutes,
      @tmdbRating,
      @genresJson,
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
      year = excluded.year,
      tmdbId = excluded.tmdbId,
      posterPath = excluded.posterPath,
      backdropPath = excluded.backdropPath,
      runtimeMinutes = excluded.runtimeMinutes,
      tmdbRating = excluded.tmdbRating,
      genresJson = excluded.genresJson,
      youtubeTrailerKey = excluded.youtubeTrailerKey,
      personalRating = excluded.personalRating,
      errorMessage = excluded.errorMessage,
      lastSyncedAt = excluded.lastSyncedAt
  `
  ).run({
    ...movie,
    genresJson: JSON.stringify(movie.genres),
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
    where.push("genresJson LIKE @genre");
    params.genre = `%\"${query.genre}\"%`;
  }

  if (typeof query.minPersonalRating === "number") {
    where.push("personalRating >= @minPersonalRating");
    params.minPersonalRating = query.minPersonalRating;
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

