import { getDb } from "./db";

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

export function listGenres(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT genresJson, userGenresJson FROM movies")
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

