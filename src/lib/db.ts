import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type DbInstance = InstanceType<typeof Database>;

const DATA_DIR = path.join(process.cwd(), "data");
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
      youtubeTrailerKey TEXT NULL,
      personalRating INTEGER NULL,
      errorMessage TEXT NULL,
      lastSyncedAt INTEGER NOT NULL,
      xxxRated INTEGER NOT NULL DEFAULT 0,
      watched INTEGER NOT NULL DEFAULT 0
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
      personalRating INTEGER NULL,
      errorMessage TEXT NULL,
      lastSyncedAt INTEGER NOT NULL,
      xxxRated INTEGER NOT NULL DEFAULT 0,
      watched INTEGER NOT NULL DEFAULT 0
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
      errorMessage TEXT NULL,
      lastSyncedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      seasonId TEXT NOT NULL,
      episodeNumber INTEGER NULL,
      titleRaw TEXT NOT NULL,
      titleClean TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSizeBytes INTEGER NOT NULL,
      lastSyncedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_seasons_tmdb_id ON seasons (tmdbId);
    CREATE INDEX IF NOT EXISTS idx_seasons_title_clean ON seasons (titleClean);
    CREATE INDEX IF NOT EXISTS idx_series_title_clean ON series (titleClean);
    CREATE INDEX IF NOT EXISTS idx_series_folder_path ON series (seriesFolderPath);
    CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes (seasonId);
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
  if (!columnNames.has("xxxRated")) {
    db.exec("ALTER TABLE movies ADD COLUMN xxxRated INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnNames.has("watched")) {
    db.exec("ALTER TABLE movies ADD COLUMN watched INTEGER NOT NULL DEFAULT 0");
  }
}

export function getDb(): DbInstance {
  if (globalForDb.__apertureDb) {
    return globalForDb.__apertureDb;
  }

  ensureDataDir();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  ensureSchema(db);

  globalForDb.__apertureDb = db;
  return db;
}

