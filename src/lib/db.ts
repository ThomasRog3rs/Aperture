import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

type DbInstance = InstanceType<typeof Database>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");
const DB_PATH = path.join(DATA_DIR, "aperture.db");

const globalForDb = globalThis as typeof globalThis & {
  __apertureDb?: DbInstance;
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureSchema(db: DbInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      folderPath TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSizeBytes INTEGER NOT NULL,
      titleRaw TEXT NOT NULL,
      titleClean TEXT NOT NULL,
      titleEditedAt INTEGER NULL,
      year INTEGER NULL,
      tmdbId INTEGER NULL,
      posterPath TEXT NULL,
      backdropPath TEXT NULL,
      runtimeMinutes INTEGER NULL,
      tmdbRating REAL NULL,
      genresJson TEXT NOT NULL DEFAULT '[]',
      userGenresJson TEXT NOT NULL DEFAULT '[]',
      directorsJson TEXT NOT NULL DEFAULT '[]',
      writersJson TEXT NOT NULL DEFAULT '[]',
      actorsJson TEXT NOT NULL DEFAULT '[]',
      youtubeTrailerKey TEXT NULL,
      personalRating INTEGER NULL,
      errorMessage TEXT NULL,
      lastSyncedAt INTEGER NOT NULL,
      xxxRated INTEGER NOT NULL DEFAULT 0,
      watched INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER NULL
    );

    CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies (tmdbId);
    CREATE INDEX IF NOT EXISTS idx_movies_personal_rating ON movies (personalRating);
    CREATE INDEX IF NOT EXISTS idx_movies_title_clean ON movies (titleClean);

    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      seriesFolderPath TEXT NOT NULL,
      seasonFolderPath TEXT NOT NULL,
      seasonNumber INTEGER NULL,
      titleRaw TEXT NOT NULL,
      titleClean TEXT NOT NULL,
      titleEditedAt INTEGER NULL,
      year INTEGER NULL,
      tmdbId INTEGER NULL,
      posterPath TEXT NULL,
      backdropPath TEXT NULL,
      tmdbRating REAL NULL,
      genresJson TEXT NOT NULL DEFAULT '[]',
      userGenresJson TEXT NOT NULL DEFAULT '[]',
      directorsJson TEXT NOT NULL DEFAULT '[]',
      writersJson TEXT NOT NULL DEFAULT '[]',
      actorsJson TEXT NOT NULL DEFAULT '[]',
      personalRating INTEGER NULL,
      errorMessage TEXT NULL,
      lastSyncedAt INTEGER NOT NULL,
      xxxRated INTEGER NOT NULL DEFAULT 0,
      watched INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER NULL
    );

    CREATE TABLE IF NOT EXISTS series (
      id TEXT PRIMARY KEY,
      seriesFolderPath TEXT NOT NULL UNIQUE,
      titleClean TEXT NOT NULL,
      titleEditedAt INTEGER NULL,
      year INTEGER NULL,
      tmdbId INTEGER NULL,
      posterPath TEXT NULL,
      tmdbRating REAL NULL,
      genresJson TEXT NOT NULL DEFAULT '[]',
      userGenresJson TEXT NOT NULL DEFAULT '[]',
      directorsJson TEXT NOT NULL DEFAULT '[]',
      writersJson TEXT NOT NULL DEFAULT '[]',
      actorsJson TEXT NOT NULL DEFAULT '[]',
      errorMessage TEXT NULL,
      lastSyncedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS series_random_sessions (
      seriesId TEXT PRIMARY KEY,
      startedEpisodeIdsJson TEXT NOT NULL DEFAULT '[]',
      currentEpisodeId TEXT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      seasonId TEXT NOT NULL,
      episodeNumber INTEGER NULL,
      titleRaw TEXT NOT NULL,
      titleClean TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSizeBytes INTEGER NOT NULL,
      lastSyncedAt INTEGER NOT NULL,
      watched INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER NULL
    );

    CREATE INDEX IF NOT EXISTS idx_seasons_tmdb_id ON seasons (tmdbId);
    CREATE INDEX IF NOT EXISTS idx_seasons_title_clean ON seasons (titleClean);
    CREATE INDEX IF NOT EXISTS idx_series_title_clean ON series (titleClean);
    CREATE INDEX IF NOT EXISTS idx_series_folder_path ON series (seriesFolderPath);
    CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes (seasonId);

    CREATE TABLE IF NOT EXISTS sync_roots (
      rootPath TEXT PRIMARY KEY,
      lastSyncedAt INTEGER NOT NULL,
      lastFullSyncedAt INTEGER NULL
    );

    CREATE TABLE IF NOT EXISTS folder_scan_state (
      folderPath TEXT PRIMARY KEY,
      folderType TEXT NOT NULL,
      parentFolderPath TEXT NULL,
      dirMtimeMs REAL NOT NULL,
      fingerprint TEXT NOT NULL,
      lastSeenAt INTEGER NOT NULL,
      lastScannedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folder_scan_entries (
      folderPath TEXT NOT NULL,
      entryPath TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      mtimeMs REAL NOT NULL,
      PRIMARY KEY (folderPath, entryPath)
    );

    CREATE INDEX IF NOT EXISTS idx_folder_scan_state_parent
      ON folder_scan_state (parentFolderPath);
    CREATE INDEX IF NOT EXISTS idx_folder_scan_state_type
      ON folder_scan_state (folderType);
    CREATE INDEX IF NOT EXISTS idx_folder_scan_entries_folder
      ON folder_scan_entries (folderPath);

    CREATE TABLE IF NOT EXISTS subtitles (
      id TEXT PRIMARY KEY,
      mediaType TEXT NOT NULL,
      mediaId TEXT NOT NULL,
      filePath TEXT NOT NULL UNIQUE,
      fileName TEXT NOT NULL,
      language TEXT NOT NULL,
      format TEXT NOT NULL,
      source TEXT NOT NULL,
      downloadedAt INTEGER NULL
    );

    CREATE INDEX IF NOT EXISTS idx_subtitles_media ON subtitles (mediaType, mediaId);
  `);

  const columns = db
    .prepare("PRAGMA table_info(movies)")
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has("titleEditedAt")) {
    db.exec("ALTER TABLE movies ADD COLUMN titleEditedAt INTEGER NULL");
  }
  if (!columnNames.has("userGenresJson")) {
    db.exec("ALTER TABLE movies ADD COLUMN userGenresJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columnNames.has("directorsJson")) {
    db.exec("ALTER TABLE movies ADD COLUMN directorsJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columnNames.has("writersJson")) {
    db.exec("ALTER TABLE movies ADD COLUMN writersJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columnNames.has("actorsJson")) {
    db.exec("ALTER TABLE movies ADD COLUMN actorsJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columnNames.has("xxxRated")) {
    db.exec("ALTER TABLE movies ADD COLUMN xxxRated INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnNames.has("watched")) {
    db.exec("ALTER TABLE movies ADD COLUMN watched INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnNames.has("deletedAt")) {
    db.exec("ALTER TABLE movies ADD COLUMN deletedAt INTEGER NULL");
  }

  const seasonCols = db
    .prepare("PRAGMA table_info(seasons)")
    .all() as Array<{ name: string }>;
  const seasonColNames = new Set(seasonCols.map((column) => column.name));
  if (!seasonColNames.has("directorsJson")) {
    db.exec("ALTER TABLE seasons ADD COLUMN directorsJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!seasonColNames.has("writersJson")) {
    db.exec("ALTER TABLE seasons ADD COLUMN writersJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!seasonColNames.has("actorsJson")) {
    db.exec("ALTER TABLE seasons ADD COLUMN actorsJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!seasonColNames.has("deletedAt")) {
    db.exec("ALTER TABLE seasons ADD COLUMN deletedAt INTEGER NULL");
  }

  const seriesCols = db
    .prepare("PRAGMA table_info(series)")
    .all() as Array<{ name: string }>;
  const seriesColNames = new Set(seriesCols.map((column) => column.name));
  if (!seriesColNames.has("directorsJson")) {
    db.exec("ALTER TABLE series ADD COLUMN directorsJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!seriesColNames.has("writersJson")) {
    db.exec("ALTER TABLE series ADD COLUMN writersJson TEXT NOT NULL DEFAULT '[]'");
  }
  if (!seriesColNames.has("actorsJson")) {
    db.exec("ALTER TABLE series ADD COLUMN actorsJson TEXT NOT NULL DEFAULT '[]'");
  }

  const seriesRandomSessionCols = db
    .prepare("PRAGMA table_info(series_random_sessions)")
    .all() as Array<{ name: string }>;
  const seriesRandomSessionColNames = new Set(
    seriesRandomSessionCols.map((column) => column.name)
  );
  if (!seriesRandomSessionColNames.has("startedEpisodeIdsJson")) {
    db.exec(
      "ALTER TABLE series_random_sessions ADD COLUMN startedEpisodeIdsJson TEXT NOT NULL DEFAULT '[]'"
    );
  }
  if (!seriesRandomSessionColNames.has("currentEpisodeId")) {
    db.exec(
      "ALTER TABLE series_random_sessions ADD COLUMN currentEpisodeId TEXT NULL"
    );
  }
  if (!seriesRandomSessionColNames.has("createdAt")) {
    db.exec(
      "ALTER TABLE series_random_sessions ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!seriesRandomSessionColNames.has("updatedAt")) {
    db.exec(
      "ALTER TABLE series_random_sessions ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0"
    );
  }

  const episodeCols = db
    .prepare("PRAGMA table_info(episodes)")
    .all() as Array<{ name: string }>;
  const episodeColNames = new Set(episodeCols.map((c) => c.name));
  if (!episodeColNames.has("watched")) {
    db.exec("ALTER TABLE episodes ADD COLUMN watched INTEGER NOT NULL DEFAULT 0");
  }
  if (!episodeColNames.has("deletedAt")) {
    db.exec("ALTER TABLE episodes ADD COLUMN deletedAt INTEGER NULL");
  }

  // ── Playback & transcoding columns ──────────────────────────
  if (!columnNames.has("transcodeStatus")) {
    db.exec("ALTER TABLE movies ADD COLUMN transcodeStatus TEXT DEFAULT 'none'");
  }
  if (!columnNames.has("transcodedPath")) {
    db.exec("ALTER TABLE movies ADD COLUMN transcodedPath TEXT");
  }
  if (!columnNames.has("hlsPath")) {
    db.exec("ALTER TABLE movies ADD COLUMN hlsPath TEXT");
  }
  if (!columnNames.has("storyboardPath")) {
    db.exec("ALTER TABLE movies ADD COLUMN storyboardPath TEXT");
  }
  if (!columnNames.has("watchProgressSeconds")) {
    db.exec("ALTER TABLE movies ADD COLUMN watchProgressSeconds INTEGER DEFAULT 0");
  }
  if (!columnNames.has("selectedSubtitleId")) {
    db.exec("ALTER TABLE movies ADD COLUMN selectedSubtitleId TEXT NULL");
  }
  if (!columnNames.has("subtitlesEnabled")) {
    db.exec("ALTER TABLE movies ADD COLUMN subtitlesEnabled INTEGER NOT NULL DEFAULT 0");
  }

  if (!episodeColNames.has("transcodeStatus")) {
    db.exec("ALTER TABLE episodes ADD COLUMN transcodeStatus TEXT DEFAULT 'none'");
  }
  if (!episodeColNames.has("transcodedPath")) {
    db.exec("ALTER TABLE episodes ADD COLUMN transcodedPath TEXT");
  }
  if (!episodeColNames.has("hlsPath")) {
    db.exec("ALTER TABLE episodes ADD COLUMN hlsPath TEXT");
  }
  if (!episodeColNames.has("storyboardPath")) {
    db.exec("ALTER TABLE episodes ADD COLUMN storyboardPath TEXT");
  }
  if (!episodeColNames.has("watchProgressSeconds")) {
    db.exec("ALTER TABLE episodes ADD COLUMN watchProgressSeconds INTEGER DEFAULT 0");
  }
  if (!episodeColNames.has("selectedSubtitleId")) {
    db.exec("ALTER TABLE episodes ADD COLUMN selectedSubtitleId TEXT NULL");
  }
  if (!episodeColNames.has("subtitlesEnabled")) {
    db.exec("ALTER TABLE episodes ADD COLUMN subtitlesEnabled INTEGER NOT NULL DEFAULT 0");
  }

  const scanStateCols = db
    .prepare("PRAGMA table_info(folder_scan_state)")
    .all() as Array<{ name: string }>;
  const scanStateColNames = new Set(scanStateCols.map((column) => column.name));
  if (!scanStateColNames.has("lastSeenAt")) {
    db.exec("ALTER TABLE folder_scan_state ADD COLUMN lastSeenAt INTEGER NOT NULL DEFAULT 0");
  }
  if (!scanStateColNames.has("lastScannedAt")) {
    db.exec(
      "ALTER TABLE folder_scan_state ADD COLUMN lastScannedAt INTEGER NOT NULL DEFAULT 0"
    );
  }

  const syncRootCols = db
    .prepare("PRAGMA table_info(sync_roots)")
    .all() as Array<{ name: string }>;
  const syncRootColNames = new Set(syncRootCols.map((column) => column.name));
  if (!syncRootColNames.has("lastFullSyncedAt")) {
    db.exec("ALTER TABLE sync_roots ADD COLUMN lastFullSyncedAt INTEGER NULL");
  }
}

export function getDb(): DbInstance {
  if (globalForDb.__apertureDb) {
    ensureSchema(globalForDb.__apertureDb);
    return globalForDb.__apertureDb;
  }

  ensureDataDir();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  ensureSchema(db);

  globalForDb.__apertureDb = db;
  return db;
}
