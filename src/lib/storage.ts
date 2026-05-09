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
  directors: string[];
  writers: string[];
  actors: string[];
  youtubeTrailerKey: string | null;
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
};

export type MovieRow = Omit<MovieUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
  directorsJson: string;
  writersJson: string;
  actorsJson: string;
  xxxRated: number;
  watched: number;
  selectedSubtitleId?: string | null;
  subtitlesEnabled?: number;
  watchProgressSeconds?: number;
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
  directors: string[];
  writers: string[];
  actors: string[];
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
  xxxRated: number;
  watched: number;
};

export type SeasonRow = Omit<SeasonUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
  directorsJson: string;
  writersJson: string;
  actorsJson: string;
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
  selectedSubtitleId?: string | null;
  subtitlesEnabled?: number;
  watchProgressSeconds?: number;
  transcodeStatus?: string;
  transcodedPath?: string | null;
  hlsPath?: string | null;
  storyboardPath?: string | null;
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
  directors: string[];
  writers: string[];
  actors: string[];
  errorMessage: string | null;
  lastSyncedAt: number;
};

export type SeriesRow = Omit<SeriesUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
  directorsJson: string;
  writersJson: string;
  actorsJson: string;
};

export type SeriesRandomSessionRow = {
  seriesId: string;
  startedEpisodeIdsJson: string;
  currentEpisodeId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SeriesRandomSession = {
  seriesId: string;
  startedEpisodeIds: string[];
  currentEpisodeId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type FolderScanType = "movie" | "series" | "season";

export type FolderScanStateUpsert = {
  folderPath: string;
  folderType: FolderScanType;
  parentFolderPath: string | null;
  dirMtimeMs: number;
  fingerprint: string;
  lastSeenAt: number;
  lastScannedAt: number;
};

export type FolderScanStateRow = FolderScanStateUpsert;

export type FolderScanEntryUpsert = {
  folderPath: string;
  entryPath: string;
  sizeBytes: number;
  mtimeMs: number;
};

export type FolderScanEntryRow = FolderScanEntryUpsert;

export type MovieQuery = {
  q?: string;
  genre?: string;
  person?: string;
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

export function listAllFolderScanStates(): FolderScanStateRow[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        folderPath,
        folderType,
        parentFolderPath,
        dirMtimeMs,
        fingerprint,
        lastSeenAt,
        lastScannedAt
      FROM folder_scan_state
      `
    )
    .all() as FolderScanStateRow[];
}

export function listAllFolderScanEntries(): FolderScanEntryRow[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        folderPath,
        entryPath,
        sizeBytes,
        mtimeMs
      FROM folder_scan_entries
      `
    )
    .all() as FolderScanEntryRow[];
}

export function saveFolderScanSnapshot(
  rootPath: string,
  states: FolderScanStateUpsert[],
  entries: FolderScanEntryUpsert[],
  lastSyncedAt: number
) {
  const db = getDb();
  const existingStateRows = db
    .prepare("SELECT folderPath FROM folder_scan_state")
    .all() as Array<{ folderPath: string }>;
  const currentStatePaths = new Set(states.map((state) => state.folderPath));
  const removedStatePaths = existingStateRows
    .map((row) => row.folderPath)
    .filter((folderPath) => !currentStatePaths.has(folderPath));
  const trackedFolderPaths = new Set(
    states
      .filter((state) => state.folderType === "movie" || state.folderType === "season")
      .map((state) => state.folderPath)
  );
  for (const folderPath of removedStatePaths) {
    trackedFolderPaths.add(folderPath);
  }

  const upsertState = db.prepare(
    `
    INSERT INTO folder_scan_state (
      folderPath,
      folderType,
      parentFolderPath,
      dirMtimeMs,
      fingerprint,
      lastSeenAt,
      lastScannedAt
    ) VALUES (
      @folderPath,
      @folderType,
      @parentFolderPath,
      @dirMtimeMs,
      @fingerprint,
      @lastSeenAt,
      @lastScannedAt
    )
    ON CONFLICT(folderPath) DO UPDATE SET
      folderType = excluded.folderType,
      parentFolderPath = excluded.parentFolderPath,
      dirMtimeMs = excluded.dirMtimeMs,
      fingerprint = excluded.fingerprint,
      lastSeenAt = excluded.lastSeenAt,
      lastScannedAt = excluded.lastScannedAt
    `
  );
  const deleteState = db.prepare("DELETE FROM folder_scan_state WHERE folderPath = ?");
  const deleteEntries = db.prepare("DELETE FROM folder_scan_entries WHERE folderPath = ?");
  const insertEntry = db.prepare(
    `
    INSERT INTO folder_scan_entries (
      folderPath,
      entryPath,
      sizeBytes,
      mtimeMs
    ) VALUES (
      @folderPath,
      @entryPath,
      @sizeBytes,
      @mtimeMs
    )
    ON CONFLICT(folderPath, entryPath) DO UPDATE SET
      sizeBytes = excluded.sizeBytes,
      mtimeMs = excluded.mtimeMs
    `
  );
  const upsertRoot = db.prepare(
    `
    INSERT INTO sync_roots (
      rootPath,
      lastSyncedAt,
      lastFullSyncedAt
    ) VALUES (
      @rootPath,
      @lastSyncedAt,
      NULL
    )
    ON CONFLICT(rootPath) DO UPDATE SET
      lastSyncedAt = excluded.lastSyncedAt
    `
  );

  const saveSnapshot = db.transaction(() => {
    for (const folderPath of removedStatePaths) {
      deleteState.run(folderPath);
    }

    for (const state of states) {
      upsertState.run(state);
    }

    for (const folderPath of trackedFolderPaths) {
      deleteEntries.run(folderPath);
    }

    for (const entry of entries) {
      insertEntry.run(entry);
    }

    upsertRoot.run({ rootPath, lastSyncedAt });
  });

  saveSnapshot();
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
      directorsJson,
      writersJson,
      actorsJson,
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
      @directorsJson,
      @writersJson,
      @actorsJson,
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
      directorsJson = excluded.directorsJson,
      writersJson = excluded.writersJson,
      actorsJson = excluded.actorsJson,
      youtubeTrailerKey = excluded.youtubeTrailerKey,
      personalRating = excluded.personalRating,
      errorMessage = excluded.errorMessage,
      lastSyncedAt = excluded.lastSyncedAt,
      deletedAt = NULL
  `
  ).run({
    ...movie,
    genresJson: JSON.stringify(movie.genres),
    userGenresJson: JSON.stringify(movie.userGenres),
    directorsJson: JSON.stringify(movie.directors),
    writersJson: JSON.stringify(movie.writers),
    actorsJson: JSON.stringify(movie.actors),
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
      directorsJson,
      writersJson,
      actorsJson,
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
      @directorsJson,
      @writersJson,
      @actorsJson,
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
      directorsJson = excluded.directorsJson,
      writersJson = excluded.writersJson,
      actorsJson = excluded.actorsJson,
      personalRating = excluded.personalRating,
      errorMessage = excluded.errorMessage,
      lastSyncedAt = excluded.lastSyncedAt,
      xxxRated = excluded.xxxRated,
      watched = excluded.watched,
      deletedAt = NULL
    `
  ).run({
    ...season,
    genresJson: JSON.stringify(season.genres),
    userGenresJson: JSON.stringify(season.userGenres),
    directorsJson: JSON.stringify(season.directors),
    writersJson: JSON.stringify(season.writers),
    actorsJson: JSON.stringify(season.actors),
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
      lastSyncedAt = excluded.lastSyncedAt,
      deletedAt = NULL
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
      directorsJson,
      writersJson,
      actorsJson,
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
      @directorsJson,
      @writersJson,
      @actorsJson,
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
      directorsJson = excluded.directorsJson,
      writersJson = excluded.writersJson,
      actorsJson = excluded.actorsJson,
      errorMessage = excluded.errorMessage,
      lastSyncedAt = excluded.lastSyncedAt
    `
  ).run({
    ...series,
    genresJson: JSON.stringify(series.genres),
    userGenresJson: JSON.stringify(series.userGenres),
    directorsJson: JSON.stringify(series.directors),
    writersJson: JSON.stringify(series.writers),
    actorsJson: JSON.stringify(series.actors),
  });
}

export function listMovies(query: MovieQuery): MovieRow[] {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, string | number> = {};

  if (query.q) {
    where.push(
      "(LOWER(titleClean) LIKE @q OR LOWER(titleRaw) LIKE @q OR LOWER(directorsJson) LIKE @q OR LOWER(writersJson) LIKE @q OR LOWER(actorsJson) LIKE @q)"
    );
    params.q = `%${query.q.toLowerCase()}%`;
  }

  if (query.genre) {
    where.push("(genresJson LIKE @genre OR userGenresJson LIKE @genre)");
    params.genre = `%\"${query.genre}\"%`;
  }

  if (query.person) {
    where.push(
      "(directorsJson LIKE @person OR writersJson LIKE @person OR actorsJson LIKE @person)"
    );
    params.person = `%\"${query.person}\"%`;
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

  where.push("deletedAt IS NULL");

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
    where.push(
      "(LOWER(titleClean) LIKE @q OR LOWER(titleRaw) LIKE @q OR LOWER(directorsJson) LIKE @q OR LOWER(writersJson) LIKE @q OR LOWER(actorsJson) LIKE @q)"
    );
    params.q = `%${query.q.toLowerCase()}%`;
  }

  if (query.genre) {
    where.push("(genresJson LIKE @genre OR userGenresJson LIKE @genre)");
    params.genre = `%\"${query.genre}\"%`;
  }

  if (query.person) {
    where.push(
      "(directorsJson LIKE @person OR writersJson LIKE @person OR actorsJson LIKE @person)"
    );
    params.person = `%\"${query.person}\"%`;
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

  where.push("deletedAt IS NULL");

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
      AND deletedAt IS NULL
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
    .prepare("SELECT DISTINCT seriesFolderPath FROM seasons WHERE deletedAt IS NULL")
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
      SELECT genresJson, userGenresJson FROM movies WHERE deletedAt IS NULL
      UNION ALL
      SELECT genresJson, userGenresJson FROM seasons WHERE deletedAt IS NULL
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

export function listPeople(): {
  directors: string[];
  writers: string[];
  actors: string[];
} {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT directorsJson, writersJson, actorsJson FROM movies WHERE deletedAt IS NULL
      UNION ALL
      SELECT directorsJson, writersJson, actorsJson FROM seasons WHERE deletedAt IS NULL
      `
    )
    .all() as Array<{
    directorsJson: string | null;
    writersJson: string | null;
    actorsJson: string | null;
  }>;

  const parseList = (value: string | null) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const collect = (
    rowsToScan: typeof rows,
    key: "directorsJson" | "writersJson" | "actorsJson"
  ) => {
    const unique = new Map<string, string>();
    rowsToScan.forEach((row) => {
      parseList(row[key]).forEach((name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const lookupKey = trimmed.toLowerCase();
        if (unique.has(lookupKey)) return;
        unique.set(lookupKey, trimmed);
      });
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  };

  return {
    directors: collect(rows, "directorsJson"),
    writers: collect(rows, "writersJson"),
    actors: collect(rows, "actorsJson"),
  };
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
  directorsJson?: string;
  writersJson?: string;
  actorsJson?: string;
  youtubeTrailerKey?: string | null;
  errorMessage?: string | null;
  lastSyncedAt?: number;
  personalRating?: number | null;
  xxxRated?: number | null;
  watched?: number | null;
  transcodeStatus?: string;
  transcodedPath?: string | null;
  hlsPath?: string | null;
  storyboardPath?: string | null;
  watchProgressSeconds?: number;
  selectedSubtitleId?: string | null;
  subtitlesEnabled?: number;
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
  directorsJson?: string;
  writersJson?: string;
  actorsJson?: string;
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
  directorsJson?: string;
  writersJson?: string;
  actorsJson?: string;
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

function parseSeriesRandomSessionIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "string" || !entry.trim()) continue;
      if (seen.has(entry)) continue;
      seen.add(entry);
      ids.push(entry);
    }
    return ids;
  } catch {
    return [];
  }
}

function mapSeriesRandomSessionRow(
  row: SeriesRandomSessionRow
): SeriesRandomSession {
  const startedEpisodeIds = parseSeriesRandomSessionIds(row.startedEpisodeIdsJson);
  return {
    seriesId: row.seriesId,
    startedEpisodeIds,
    currentEpisodeId:
      row.currentEpisodeId && row.currentEpisodeId.trim()
        ? row.currentEpisodeId
        : startedEpisodeIds[startedEpisodeIds.length - 1] ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function getSeriesRandomSession(
  seriesId: string
): SeriesRandomSession | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM series_random_sessions WHERE seriesId = ?")
    .get(seriesId) as SeriesRandomSessionRow | undefined;
  return row ? mapSeriesRandomSessionRow(row) : null;
}

export function replaceSeriesRandomSession(
  seriesId: string,
  startedEpisodeIds: string[] = [],
  currentEpisodeId: string | null = null
): SeriesRandomSession {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `
    INSERT INTO series_random_sessions (
      seriesId,
      startedEpisodeIdsJson,
      currentEpisodeId,
      createdAt,
      updatedAt
    ) VALUES (
      @seriesId,
      @startedEpisodeIdsJson,
      @currentEpisodeId,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(seriesId) DO UPDATE SET
      startedEpisodeIdsJson = excluded.startedEpisodeIdsJson,
      currentEpisodeId = excluded.currentEpisodeId,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt
    `
  ).run({
    seriesId,
    startedEpisodeIdsJson: JSON.stringify(startedEpisodeIds),
    currentEpisodeId,
    createdAt: now,
    updatedAt: now,
  });
  return {
    seriesId,
    startedEpisodeIds: [...startedEpisodeIds],
    currentEpisodeId,
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteSeriesRandomSession(seriesId: string) {
  const db = getDb();
  db.prepare("DELETE FROM series_random_sessions WHERE seriesId = ?").run(seriesId);
}

export function markSeriesRandomSessionEpisodeStarted(
  seriesId: string,
  episodeId: string
): SeriesRandomSession {
  const db = getDb();
  const transaction = db.transaction(() => {
    const current = getSeriesRandomSession(seriesId);
    const startedEpisodeIds = current ? [...current.startedEpisodeIds] : [];
    if (!startedEpisodeIds.includes(episodeId)) {
      startedEpisodeIds.push(episodeId);
    }
    const createdAt = current?.createdAt ?? Date.now();
    const updatedAt = Date.now();
    db.prepare(
      `
      INSERT INTO series_random_sessions (
        seriesId,
        startedEpisodeIdsJson,
        currentEpisodeId,
        createdAt,
        updatedAt
      ) VALUES (
        @seriesId,
        @startedEpisodeIdsJson,
        @currentEpisodeId,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(seriesId) DO UPDATE SET
        startedEpisodeIdsJson = excluded.startedEpisodeIdsJson,
        currentEpisodeId = excluded.currentEpisodeId,
        createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt
      `
    ).run({
      seriesId,
      startedEpisodeIdsJson: JSON.stringify(startedEpisodeIds),
      currentEpisodeId: episodeId,
      createdAt,
      updatedAt,
    });
    return {
      seriesId,
      startedEpisodeIds,
      currentEpisodeId: episodeId,
      createdAt,
      updatedAt,
    };
  });

  return transaction();
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

export function deleteMovie(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM movies WHERE id = ?").run(id);
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

export function deleteSeries(id: string) {
  const db = getDb();
  const seriesFolderPath = getSeriesFolderPathById(id);
  if (!seriesFolderPath) return;
  const seasonRows = listSeasonsBySeriesFolderPath(seriesFolderPath);
  const seasonIds = seasonRows.map((r) => r.id);
  if (seasonIds.length > 0) {
    const placeholders = seasonIds.map(() => "?").join(", ");
    db.prepare(
      `DELETE FROM episodes WHERE seasonId IN (${placeholders})`
    ).run(...seasonIds);
  }
  db.prepare("DELETE FROM seasons WHERE seriesFolderPath = ?").run(seriesFolderPath);
  db.prepare("DELETE FROM series WHERE id = ?").run(id);
  db.prepare("DELETE FROM series_random_sessions WHERE seriesId = ?").run(id);
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
      AND deletedAt IS NULL
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
    .prepare("SELECT COUNT(*) as count FROM episodes WHERE seasonId = ? AND deletedAt IS NULL")
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
      AND deletedAt IS NULL
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
  transcodeStatus?: string;
  transcodedPath?: string | null;
  hlsPath?: string | null;
  storyboardPath?: string | null;
  watchProgressSeconds?: number;
  selectedSubtitleId?: string | null;
  subtitlesEnabled?: number;
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

export function markEpisodesDeletedNotInSeason(
  seasonId: string,
  filePaths: string[]
) {
  const db = getDb();
  const now = Date.now();
  if (filePaths.length === 0) {
    db.prepare(
      "UPDATE episodes SET deletedAt = ? WHERE seasonId = ? AND deletedAt IS NULL"
    ).run(now, seasonId);
    return;
  }
  const placeholders = filePaths.map(() => "?").join(", ");
  db.prepare(
    `
    UPDATE episodes
    SET deletedAt = ?
    WHERE seasonId = ?
    AND filePath NOT IN (${placeholders})
    AND deletedAt IS NULL
    `
  ).run(now, seasonId, ...filePaths);
}

export function getAllMovieFolderPaths(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT folderPath FROM movies WHERE deletedAt IS NULL")
    .all() as Array<{ folderPath: string }>;
  return rows.map((row) => row.folderPath);
}

export function getAllSeasonFolderPaths(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT seasonFolderPath FROM seasons WHERE deletedAt IS NULL")
    .all() as Array<{ seasonFolderPath: string }>;
  return rows.map((row) => row.seasonFolderPath);
}

export function markMoviesDeleted(folderPaths: string[]) {
  if (folderPaths.length === 0) return;
  const db = getDb();
  const now = Date.now();
  const placeholders = folderPaths.map(() => "?").join(", ");
  db.prepare(
    `UPDATE movies SET deletedAt = ? WHERE folderPath IN (${placeholders}) AND deletedAt IS NULL`
  ).run(now, ...folderPaths);
}

export function markSeasonsDeleted(seasonFolderPaths: string[]) {
  if (seasonFolderPaths.length === 0) return;
  const db = getDb();
  const now = Date.now();
  const placeholders = seasonFolderPaths.map(() => "?").join(", ");
  db.prepare(
    `UPDATE seasons SET deletedAt = ? WHERE seasonFolderPath IN (${placeholders}) AND deletedAt IS NULL`
  ).run(now, ...seasonFolderPaths);
}

export function markSeasonDeleted(id: string) {
  const db = getDb();
  db.prepare(
    "UPDATE seasons SET deletedAt = ? WHERE id = ? AND deletedAt IS NULL"
  ).run(Date.now(), id);
}

export type DeletedMovieRow = MovieRow & { deletedAt: number };
export type DeletedSeasonRow = SeasonRow & { deletedAt: number; deletedEpisodeCount: number };

export function listDeletedMovies(): DeletedMovieRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM movies WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC")
    .all() as DeletedMovieRow[];
}

export function listDeletedSeasons(): DeletedSeasonRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.*, COUNT(e.id) as deletedEpisodeCount
       FROM seasons s
       LEFT JOIN episodes e ON e.seasonId = s.id AND e.deletedAt IS NOT NULL
       WHERE s.deletedAt IS NOT NULL
       GROUP BY s.id
       ORDER BY s.deletedAt DESC`
    )
    .all() as DeletedSeasonRow[];
}

export function purgeMoviesByIds(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(", ");
  db.prepare(`DELETE FROM movies WHERE id IN (${placeholders})`).run(...ids);
}

export function purgeSeasonsByIds(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(", ");
  db.prepare(`DELETE FROM episodes WHERE seasonId IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM seasons WHERE id IN (${placeholders})`).run(...ids);
}

export function restoreMoviesByIds(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(", ");
  db.prepare(`UPDATE movies SET deletedAt = NULL WHERE id IN (${placeholders})`).run(...ids);
}

export function restoreSeasonsByIds(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(", ");
  db.prepare(`UPDATE seasons SET deletedAt = NULL WHERE id IN (${placeholders})`).run(...ids);
  db.prepare(`UPDATE episodes SET deletedAt = NULL WHERE seasonId IN (${placeholders})`).run(...ids);
}

export function countDeletedItems(): {
  movies: number;
  seasons: number;
  episodes: number;
  total: number;
} {
  const db = getDb();
  const movies = (
    db.prepare("SELECT COUNT(*) as count FROM movies WHERE deletedAt IS NOT NULL").get() as {
      count: number;
    }
  ).count;
  const seasons = (
    db.prepare("SELECT COUNT(*) as count FROM seasons WHERE deletedAt IS NOT NULL").get() as {
      count: number;
    }
  ).count;
  const episodes = (
    db.prepare("SELECT COUNT(*) as count FROM episodes WHERE deletedAt IS NOT NULL").get() as {
      count: number;
    }
  ).count;
  return { movies, seasons, episodes, total: movies + seasons + episodes };
}

export function purgeDeletedItems(): number {
  const db = getDb();
  const deletedMovieCount = (
    db.prepare("SELECT COUNT(*) as count FROM movies WHERE deletedAt IS NOT NULL").get() as {
      count: number;
    }
  ).count;
  const deletedSeasonIds = (
    db
      .prepare("SELECT id FROM seasons WHERE deletedAt IS NOT NULL")
      .all() as Array<{ id: string }>
  ).map((r) => r.id);

  db.prepare("DELETE FROM movies WHERE deletedAt IS NOT NULL").run();

  if (deletedSeasonIds.length > 0) {
    const placeholders = deletedSeasonIds.map(() => "?").join(", ");
    db.prepare(
      `DELETE FROM episodes WHERE seasonId IN (${placeholders})`
    ).run(...deletedSeasonIds);
  }
  db.prepare("DELETE FROM seasons WHERE deletedAt IS NOT NULL").run();
  db.prepare("DELETE FROM episodes WHERE deletedAt IS NOT NULL").run();

  return deletedMovieCount + deletedSeasonIds.length;
}

// ── Subtitle helpers ─────────────────────────────────────────────────────────

export type SubtitleUpsert = {
  id: string;
  mediaType: "movie" | "episode";
  mediaId: string;
  filePath: string;
  fileName: string;
  language: string;
  format: string;
  source: "local" | "opensubtitles";
  downloadedAt: number | null;
};

export type SubtitleRow = SubtitleUpsert;

export function upsertSubtitle(sub: SubtitleUpsert): void {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO subtitles (
      id, mediaType, mediaId, filePath, fileName, language, format, source, downloadedAt
    ) VALUES (
      @id, @mediaType, @mediaId, @filePath, @fileName, @language, @format, @source, @downloadedAt
    )
    ON CONFLICT(filePath) DO UPDATE SET
      fileName = excluded.fileName,
      language = excluded.language,
      format = excluded.format,
      source = CASE WHEN subtitles.source = 'opensubtitles' THEN 'opensubtitles' ELSE excluded.source END,
      downloadedAt = CASE WHEN excluded.downloadedAt IS NOT NULL THEN excluded.downloadedAt ELSE subtitles.downloadedAt END
    `
  ).run(sub);
}

export function listSubtitlesByMedia(
  mediaType: string,
  mediaId: string
): SubtitleRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM subtitles WHERE mediaType = ? AND mediaId = ? ORDER BY language ASC, fileName ASC"
    )
    .all(mediaType, mediaId) as SubtitleRow[];
}

export function getSubtitleById(id: string): SubtitleRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM subtitles WHERE id = ?").get(id);
  return (row as SubtitleRow | undefined) ?? null;
}

export function deleteSubtitleById(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM subtitles WHERE id = ?").run(id);
}

export function deleteSubtitlesByMediaId(
  mediaType: string,
  mediaId: string,
  filePaths: string[]
): void {
  const db = getDb();
  if (filePaths.length === 0) {
    db.prepare(
      "DELETE FROM subtitles WHERE mediaType = ? AND mediaId = ?"
    ).run(mediaType, mediaId);
    return;
  }
  const placeholders = filePaths.map(() => "?").join(", ");
  db.prepare(
    `DELETE FROM subtitles WHERE mediaType = ? AND mediaId = ? AND filePath NOT IN (${placeholders})`
  ).run(mediaType, mediaId, ...filePaths);
}

export function updateMovieSubtitlePreference(
  movieId: string,
  selectedSubtitleId: string | null,
  subtitlesEnabled: boolean
): void {
  const db = getDb();
  db.prepare(
    "UPDATE movies SET selectedSubtitleId = @selectedSubtitleId, subtitlesEnabled = @subtitlesEnabled WHERE id = @id"
  ).run({ id: movieId, selectedSubtitleId, subtitlesEnabled: subtitlesEnabled ? 1 : 0 });
}

export function updateEpisodeSubtitlePreference(
  episodeId: string,
  selectedSubtitleId: string | null,
  subtitlesEnabled: boolean
): void {
  const db = getDb();
  db.prepare(
    "UPDATE episodes SET selectedSubtitleId = @selectedSubtitleId, subtitlesEnabled = @subtitlesEnabled WHERE id = @id"
  ).run({ id: episodeId, selectedSubtitleId, subtitlesEnabled: subtitlesEnabled ? 1 : 0 });
}
