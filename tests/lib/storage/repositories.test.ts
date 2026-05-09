import Database from "better-sqlite3";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getSeriesId } from "@/lib/series";
import type { StorageDb, StorageStatement } from "@/lib/storage/context";
import { createEpisodeRepository } from "@/lib/storage/repositories/episodeRepository";
import { createFolderScanRepository } from "@/lib/storage/repositories/folderScanRepository";
import { createMovieRepository } from "@/lib/storage/repositories/movieRepository";
import { createSeasonRepository } from "@/lib/storage/repositories/seasonRepository";
import { createSeriesRandomSessionRepository } from "@/lib/storage/repositories/seriesRandomSessionRepository";
import { createSeriesRepository } from "@/lib/storage/repositories/seriesRepository";
import { createSettingsRepository } from "@/lib/storage/repositories/settingsRepository";
import { createSubtitleRepository } from "@/lib/storage/repositories/subtitleRepository";

const openDatabases: Array<InstanceType<typeof Database>> = [];

function createInMemoryStorageDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE sync_roots (
      rootPath TEXT PRIMARY KEY,
      lastSyncedAt INTEGER NOT NULL,
      lastFullSyncedAt INTEGER NULL
    );

    CREATE TABLE folder_scan_state (
      folderPath TEXT PRIMARY KEY,
      folderType TEXT NOT NULL,
      parentFolderPath TEXT NULL,
      dirMtimeMs REAL NOT NULL,
      fingerprint TEXT NOT NULL,
      lastSeenAt INTEGER NOT NULL,
      lastScannedAt INTEGER NOT NULL
    );

    CREATE TABLE folder_scan_entries (
      folderPath TEXT NOT NULL,
      entryPath TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      mtimeMs REAL NOT NULL,
      PRIMARY KEY (folderPath, entryPath)
    );

    CREATE TABLE movies (
      id TEXT PRIMARY KEY,
      folderPath TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSizeBytes INTEGER NOT NULL,
      titleRaw TEXT NOT NULL,
      titleClean TEXT NOT NULL,
      titleEditedAt INTEGER,
      year INTEGER,
      tmdbId INTEGER,
      posterPath TEXT,
      backdropPath TEXT,
      runtimeMinutes INTEGER,
      tmdbRating REAL,
      genresJson TEXT,
      userGenresJson TEXT,
      directorsJson TEXT,
      writersJson TEXT,
      actorsJson TEXT,
      youtubeTrailerKey TEXT,
      personalRating REAL,
      errorMessage TEXT,
      lastSyncedAt INTEGER NOT NULL,
      xxxRated INTEGER NOT NULL DEFAULT 0,
      watched INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER,
      selectedSubtitleId TEXT,
      subtitlesEnabled INTEGER,
      watchProgressSeconds INTEGER
    );

    CREATE TABLE seasons (
      id TEXT PRIMARY KEY,
      seriesFolderPath TEXT NOT NULL,
      seasonFolderPath TEXT NOT NULL,
      seasonNumber INTEGER,
      titleRaw TEXT NOT NULL,
      titleClean TEXT NOT NULL,
      titleEditedAt INTEGER,
      year INTEGER,
      tmdbId INTEGER,
      posterPath TEXT,
      backdropPath TEXT,
      tmdbRating REAL,
      genresJson TEXT,
      userGenresJson TEXT,
      directorsJson TEXT,
      writersJson TEXT,
      actorsJson TEXT,
      personalRating REAL,
      errorMessage TEXT,
      lastSyncedAt INTEGER NOT NULL,
      xxxRated INTEGER NOT NULL DEFAULT 0,
      watched INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER
    );

    CREATE TABLE episodes (
      id TEXT PRIMARY KEY,
      seasonId TEXT NOT NULL,
      episodeNumber INTEGER,
      titleRaw TEXT NOT NULL,
      titleClean TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSizeBytes INTEGER NOT NULL,
      watched INTEGER NOT NULL DEFAULT 0,
      transcodeStatus TEXT,
      transcodedPath TEXT,
      hlsPath TEXT,
      storyboardPath TEXT,
      watchProgressSeconds INTEGER,
      selectedSubtitleId TEXT,
      subtitlesEnabled INTEGER,
      lastSyncedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );

    CREATE TABLE series (
      id TEXT PRIMARY KEY,
      seriesFolderPath TEXT NOT NULL,
      titleClean TEXT NOT NULL,
      titleEditedAt INTEGER,
      year INTEGER,
      tmdbId INTEGER,
      posterPath TEXT,
      tmdbRating REAL,
      genresJson TEXT,
      userGenresJson TEXT,
      directorsJson TEXT,
      writersJson TEXT,
      actorsJson TEXT,
      errorMessage TEXT,
      lastSyncedAt INTEGER NOT NULL
    );

    CREATE TABLE series_random_sessions (
      seriesId TEXT PRIMARY KEY,
      startedEpisodeIdsJson TEXT NOT NULL,
      currentEpisodeId TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE subtitles (
      id TEXT PRIMARY KEY,
      mediaType TEXT NOT NULL,
      mediaId TEXT NOT NULL,
      filePath TEXT NOT NULL UNIQUE,
      fileName TEXT NOT NULL,
      language TEXT NOT NULL,
      format TEXT NOT NULL,
      source TEXT NOT NULL,
      downloadedAt INTEGER
    );
  `);

  openDatabases.push(db);
  return db;
}

afterEach(() => {
  for (const db of openDatabases.splice(0)) {
    db.close();
  }
});

describe("storage repositories", () => {
  it("reads and writes settings through the settings repository", () => {
    const db = createInMemoryStorageDb();
    const settingsRepository = createSettingsRepository({ getDb: () => db });

    expect(settingsRepository.getSetting("playerMode")).toBeNull();

    settingsRepository.setSetting("playerMode", "browser");
    expect(settingsRepository.getSetting("playerMode")).toBe("browser");

    settingsRepository.setSetting("playerMode", "native");
    expect(settingsRepository.getSetting("playerMode")).toBe("native");
  });

  it("replaces tracked folder snapshot rows while preserving untracked series entries", () => {
    const db = createInMemoryStorageDb();
    const folderScanRepository = createFolderScanRepository({ getDb: () => db });

    folderScanRepository.saveFolderScanSnapshot(
      "/library",
      [
        {
          folderPath: "/library/movies/m1",
          folderType: "movie",
          parentFolderPath: "/library/movies",
          dirMtimeMs: 1,
          fingerprint: "m1-a",
          lastSeenAt: 1,
          lastScannedAt: 1,
        },
        {
          folderPath: "/library/series/show-a",
          folderType: "series",
          parentFolderPath: "/library/series",
          dirMtimeMs: 2,
          fingerprint: "s-a",
          lastSeenAt: 1,
          lastScannedAt: 1,
        },
        {
          folderPath: "/library/series/show-a/season-1",
          folderType: "season",
          parentFolderPath: "/library/series/show-a",
          dirMtimeMs: 3,
          fingerprint: "ss1-a",
          lastSeenAt: 1,
          lastScannedAt: 1,
        },
      ],
      [
        {
          folderPath: "/library/movies/m1",
          entryPath: "/library/movies/m1/movie.mkv",
          sizeBytes: 1,
          mtimeMs: 11,
        },
        {
          folderPath: "/library/series/show-a",
          entryPath: "/library/series/show-a/metadata.nfo",
          sizeBytes: 2,
          mtimeMs: 12,
        },
        {
          folderPath: "/library/series/show-a/season-1",
          entryPath: "/library/series/show-a/season-1/e1.mkv",
          sizeBytes: 3,
          mtimeMs: 13,
        },
      ],
      100
    );

    folderScanRepository.saveFolderScanSnapshot(
      "/library",
      [
        {
          folderPath: "/library/series/show-a",
          folderType: "series",
          parentFolderPath: "/library/series",
          dirMtimeMs: 22,
          fingerprint: "s-b",
          lastSeenAt: 2,
          lastScannedAt: 2,
        },
        {
          folderPath: "/library/series/show-a/season-1",
          folderType: "season",
          parentFolderPath: "/library/series/show-a",
          dirMtimeMs: 23,
          fingerprint: "ss1-b",
          lastSeenAt: 2,
          lastScannedAt: 2,
        },
      ],
      [
        {
          folderPath: "/library/series/show-a/season-1",
          entryPath: "/library/series/show-a/season-1/e2.mkv",
          sizeBytes: 4,
          mtimeMs: 24,
        },
      ],
      200
    );

    expect(folderScanRepository.listAllFolderScanStates().map((state) => state.folderPath).sort()).toEqual([
      "/library/series/show-a",
      "/library/series/show-a/season-1",
    ]);

    const entriesByFolder = folderScanRepository.listAllFolderScanEntries().reduce<Record<string, string[]>>((acc, row) => {
      acc[row.folderPath] ??= [];
      acc[row.folderPath].push(row.entryPath);
      return acc;
    }, {});

    expect(entriesByFolder["/library/movies/m1"]).toBeUndefined();
    expect(entriesByFolder["/library/series/show-a/season-1"]).toEqual([
      "/library/series/show-a/season-1/e2.mkv",
    ]);
    expect(entriesByFolder["/library/series/show-a"]).toEqual([
      "/library/series/show-a/metadata.nfo",
    ]);
  });

  it("executes folder scan snapshot writes inside a single transaction", () => {
    const statements = new Map<string, StorageStatement>();
    const runLog: string[] = [];
    const transactionExecute = vi.fn((fn: () => void) => fn());
    const transaction = vi.fn((fn: () => void) => () => transactionExecute(fn));

    const db = {
      prepare: vi.fn((sql: string) => {
        if (statements.has(sql)) {
          return statements.get(sql) as StorageStatement;
        }

        const statement: StorageStatement = {
          run: (...params: unknown[]) => {
            runLog.push(`${sql}::${JSON.stringify(params)}`);
            return undefined;
          },
          get: () => undefined,
          all: () => (sql === "SELECT folderPath FROM folder_scan_state" ? [{ folderPath: "/library/movies/m1" }] : []),
        };
        statements.set(sql, statement);
        return statement;
      }),
      transaction,
    } as StorageDb;

    const folderScanRepository = createFolderScanRepository({ getDb: () => db });

    folderScanRepository.saveFolderScanSnapshot(
      "/library",
      [
        {
          folderPath: "/library/series/show-a/season-1",
          folderType: "season",
          parentFolderPath: "/library/series/show-a",
          dirMtimeMs: 3,
          fingerprint: "ss1-a",
          lastSeenAt: 1,
          lastScannedAt: 1,
        },
      ],
      [],
      100
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transactionExecute).toHaveBeenCalledTimes(1);
    expect(runLog.some((entry) => entry.includes("DELETE FROM folder_scan_state WHERE folderPath = ?"))).toBe(true);
    expect(runLog.some((entry) => entry.includes("DELETE FROM folder_scan_entries WHERE folderPath = ?"))).toBe(true);
    expect(runLog.some((entry) => entry.includes("INSERT INTO sync_roots"))).toBe(true);
  });

  it("supports movie repository CRUD/list/delete helpers", () => {
    const db = createInMemoryStorageDb();
    const movieRepository = createMovieRepository({ getDb: () => db });

    movieRepository.upsertMovie({
      id: "movie-1",
      folderPath: "/library/movies/movie-1",
      filePath: "/library/movies/movie-1/movie.mkv",
      fileSizeBytes: 1_000,
      titleRaw: "Movie One Raw",
      titleClean: "Bravo",
      titleEditedAt: null,
      year: 2020,
      tmdbId: 1,
      posterPath: null,
      backdropPath: null,
      runtimeMinutes: 120,
      tmdbRating: 7.5,
      genres: ["Drama"],
      userGenres: [],
      directors: ["Person One"],
      writers: ["Writer One"],
      actors: ["Actor One"],
      youtubeTrailerKey: null,
      personalRating: null,
      errorMessage: null,
      lastSyncedAt: 100,
    });
    movieRepository.upsertMovie({
      id: "movie-2",
      folderPath: "/library/movies/movie-2",
      filePath: "/library/movies/movie-2/movie.mkv",
      fileSizeBytes: 2_000,
      titleRaw: "Movie Two Raw",
      titleClean: "Alpha",
      titleEditedAt: null,
      year: 2021,
      tmdbId: 2,
      posterPath: null,
      backdropPath: null,
      runtimeMinutes: 130,
      tmdbRating: null,
      genres: ["Comedy"],
      userGenres: ["Drama"],
      directors: ["Person Two"],
      writers: ["Writer Two"],
      actors: ["Actor Two"],
      youtubeTrailerKey: null,
      personalRating: 8,
      errorMessage: null,
      lastSyncedAt: 200,
    });

    expect(movieRepository.listMovies({}).map((movie) => movie.id)).toEqual(["movie-2", "movie-1"]);
    expect(movieRepository.listMovies({ sort: "rating" }).map((movie) => movie.id)).toEqual(["movie-1", "movie-2"]);

    movieRepository.updateMovie("movie-1", { watched: 1 });
    movieRepository.updatePersonalRating("movie-1", 9);
    expect(movieRepository.getMovieById("movie-1")).toMatchObject({ watched: 1, personalRating: 9 });

    expect(movieRepository.getAllMovieFolderPaths().sort()).toEqual([
      "/library/movies/movie-1",
      "/library/movies/movie-2",
    ]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    movieRepository.markMoviesDeleted(["/library/movies/movie-2"]);
    expect(movieRepository.listDeletedMovies().map((movie) => movie.id)).toEqual(["movie-2"]);
    expect(movieRepository.listMovies({}).map((movie) => movie.id)).toEqual(["movie-1"]);

    movieRepository.restoreMoviesByIds(["movie-2"]);
    expect(movieRepository.listMovies({}).map((movie) => movie.id)).toEqual(["movie-2", "movie-1"]);

    movieRepository.purgeMoviesByIds(["movie-2"]);
    expect(movieRepository.getMovieById("movie-2")).toBeNull();

    movieRepository.deleteMovie("movie-1");
    expect(movieRepository.getMovieById("movie-1")).toBeNull();
    vi.useRealTimers();
  });

  it("supports season repository CRUD/list/delete helpers", () => {
    const db = createInMemoryStorageDb();
    const seasonRepository = createSeasonRepository({ getDb: () => db });

    seasonRepository.upsertSeason({
      id: "season-1",
      seriesFolderPath: "/library/series/show-a",
      seasonFolderPath: "/library/series/show-a/season-1",
      seasonNumber: 2,
      titleRaw: "Season One Raw",
      titleClean: "Bravo",
      titleEditedAt: null,
      year: 2020,
      tmdbId: 10,
      posterPath: null,
      backdropPath: null,
      tmdbRating: 8,
      genres: ["Drama"],
      userGenres: [],
      directors: ["Person"],
      writers: ["Writer"],
      actors: ["Actor"],
      personalRating: null,
      errorMessage: null,
      lastSyncedAt: 100,
      xxxRated: 0,
      watched: 0,
    });
    seasonRepository.upsertSeason({
      id: "season-2",
      seriesFolderPath: "/library/series/show-a",
      seasonFolderPath: "/library/series/show-a/season-2",
      seasonNumber: 1,
      titleRaw: "Season Two Raw",
      titleClean: "Alpha",
      titleEditedAt: null,
      year: 2020,
      tmdbId: 20,
      posterPath: null,
      backdropPath: null,
      tmdbRating: 7,
      genres: ["Drama"],
      userGenres: [],
      directors: ["Person"],
      writers: ["Writer"],
      actors: ["Actor"],
      personalRating: null,
      errorMessage: null,
      lastSyncedAt: 200,
      xxxRated: 0,
      watched: 1,
    });

    expect(seasonRepository.listSeasons({}).map((season) => season.id)).toEqual(["season-2", "season-1"]);
    expect(seasonRepository.listSeasonsBySeriesFolderPath("/library/series/show-a").map((season) => season.id)).toEqual([
      "season-2",
      "season-1",
    ]);

    seasonRepository.updateSeason("season-1", { watched: 1, titleClean: "Edited" });
    expect(seasonRepository.getSeasonById("season-1")).toMatchObject({ watched: 1, titleClean: "Edited" });

    expect(seasonRepository.getAllSeasonFolderPaths().sort()).toEqual([
      "/library/series/show-a/season-1",
      "/library/series/show-a/season-2",
    ]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-02T00:00:00.000Z"));
    seasonRepository.markSeasonsDeleted(["/library/series/show-a/season-2"]);
    expect(seasonRepository.listDeletedSeasons().map((season) => season.id)).toEqual(["season-2"]);

    seasonRepository.markSeasonDeleted("season-1");
    expect(seasonRepository.listDeletedSeasons().map((season) => season.id).sort()).toEqual([
      "season-1",
      "season-2",
    ]);

    seasonRepository.restoreSeasonsByIds(["season-1", "season-2"]);
    expect(seasonRepository.listDeletedSeasons()).toEqual([]);

    seasonRepository.deleteSeasonById("season-2");
    expect(seasonRepository.getSeasonById("season-2")).toBeNull();

    seasonRepository.purgeSeasonsByIds(["season-1"]);
    expect(seasonRepository.getSeasonById("season-1")).toBeNull();
    vi.useRealTimers();
  });

  it("supports episode repository CRUD/list/count/delete helpers", () => {
    const db = createInMemoryStorageDb();
    const episodeRepository = createEpisodeRepository({ getDb: () => db });

    episodeRepository.upsertEpisode({
      id: "ep-1",
      seasonId: "season-1",
      episodeNumber: null,
      titleRaw: "Episode One Raw",
      titleClean: "ZZZ",
      filePath: "/library/series/show-a/season-1/ep-1.mkv",
      fileSizeBytes: 1,
      lastSyncedAt: 1,
    });
    episodeRepository.upsertEpisode({
      id: "ep-2",
      seasonId: "season-1",
      episodeNumber: 2,
      titleRaw: "Episode Two Raw",
      titleClean: "BBB",
      filePath: "/library/series/show-a/season-1/ep-2.mkv",
      fileSizeBytes: 1,
      lastSyncedAt: 1,
    });
    episodeRepository.upsertEpisode({
      id: "ep-3",
      seasonId: "season-1",
      episodeNumber: 1,
      titleRaw: "Episode Three Raw",
      titleClean: "AAA",
      filePath: "/library/series/show-a/season-1/ep-3.mkv",
      fileSizeBytes: 1,
      lastSyncedAt: 1,
    });

    expect(episodeRepository.getEpisodesBySeasonId("season-1").map((episode) => episode.id)).toEqual([
      "ep-3",
      "ep-2",
      "ep-1",
    ]);
    expect(episodeRepository.countEpisodesBySeasonId("season-1")).toBe(3);
    expect(episodeRepository.getEpisodeCountsBySeasonIds(["season-1", "season-2"]).get("season-1")).toBe(3);

    episodeRepository.updateEpisode("ep-1", { watched: 1, watchProgressSeconds: 30 });
    expect(episodeRepository.getEpisodeById("ep-1")).toMatchObject({ watched: 1, watchProgressSeconds: 30 });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-03T00:00:00.000Z"));
    episodeRepository.markEpisodesDeletedNotInSeason("season-1", ["/library/series/show-a/season-1/ep-1.mkv"]);
    expect(episodeRepository.getEpisodesBySeasonId("season-1").map((episode) => episode.id)).toEqual(["ep-1"]);

    episodeRepository.markEpisodesDeletedNotInSeason("season-1", []);
    expect(episodeRepository.getEpisodesBySeasonId("season-1")).toEqual([]);
    vi.useRealTimers();
  });

  it("supports series repository CRUD/query and delete-by-id semantics", () => {
    const db = createInMemoryStorageDb();
    const seasonRepository = createSeasonRepository({ getDb: () => db });
    const seriesRepository = createSeriesRepository({ getDb: () => db });

    const seriesFolderPath = "/library/series/show-a";
    const seriesId = getSeriesId(seriesFolderPath);

    seriesRepository.upsertSeries({
      id: seriesId,
      seriesFolderPath,
      titleClean: "Show A",
      titleEditedAt: null,
      year: 2020,
      tmdbId: 123,
      posterPath: null,
      tmdbRating: 9,
      genres: ["Drama"],
      userGenres: [],
      directors: [],
      writers: [],
      actors: [],
      errorMessage: null,
      lastSyncedAt: 1,
    });
    seasonRepository.upsertSeason({
      id: "season-1",
      seriesFolderPath,
      seasonFolderPath: `${seriesFolderPath}/season-1`,
      seasonNumber: 1,
      titleRaw: "Season One",
      titleClean: "Season One",
      titleEditedAt: null,
      year: 2020,
      tmdbId: null,
      posterPath: null,
      backdropPath: null,
      tmdbRating: null,
      genres: ["Drama"],
      userGenres: [],
      directors: [],
      writers: [],
      actors: [],
      personalRating: null,
      errorMessage: null,
      lastSyncedAt: 1,
      xxxRated: 0,
      watched: 0,
    });

    seriesRepository.updateSeries(seriesId, { titleClean: "Show A Edited" });
    expect(seriesRepository.getSeriesById(seriesId)?.titleClean).toBe("Show A Edited");
    expect(seriesRepository.getSeriesByFolderPath(seriesFolderPath)?.id).toBe(seriesId);
    expect(seriesRepository.listSeriesFolderPaths()).toEqual([seriesFolderPath]);
    expect(seriesRepository.getSeriesFolderPathById(seriesId)).toBe(seriesFolderPath);

    seriesRepository.deleteSeries(seriesId);

    expect(seriesRepository.getSeriesById(seriesId)).toBeNull();
  });

  it("supports series random session repository parse/fallback and mark semantics", () => {
    const db = createInMemoryStorageDb();
    const randomSessionRepository = createSeriesRandomSessionRepository({ getDb: () => db });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    randomSessionRepository.replaceSeriesRandomSession("series-1", ["ep-1", "ep-2"], null);
    expect(randomSessionRepository.getSeriesRandomSession("series-1")?.currentEpisodeId).toBe("ep-2");

    vi.setSystemTime(new Date("2024-01-01T00:00:01.000Z"));
    const duplicateMark = randomSessionRepository.markSeriesRandomSessionEpisodeStarted("series-1", "ep-2");
    expect(duplicateMark.startedEpisodeIds).toEqual(["ep-1", "ep-2"]);

    vi.setSystemTime(new Date("2024-01-01T00:00:02.000Z"));
    const nextMark = randomSessionRepository.markSeriesRandomSessionEpisodeStarted("series-1", "ep-3");
    expect(nextMark.startedEpisodeIds).toEqual(["ep-1", "ep-2", "ep-3"]);
    expect(nextMark.currentEpisodeId).toBe("ep-3");
    expect(nextMark.createdAt).toBe(1704067200000);

    db.prepare(
      "UPDATE series_random_sessions SET startedEpisodeIdsJson = ?, currentEpisodeId = ? WHERE seriesId = ?"
    ).run('["ep-x", "ep-x", "", 123, "ep-y"]', "   ", "series-1");
    expect(randomSessionRepository.getSeriesRandomSession("series-1")).toMatchObject({
      startedEpisodeIds: ["ep-x", "ep-y"],
      currentEpisodeId: "ep-y",
    });

    db.prepare(
      "UPDATE series_random_sessions SET startedEpisodeIdsJson = ?, currentEpisodeId = ? WHERE seriesId = ?"
    ).run("not-json", "", "series-1");
    expect(randomSessionRepository.getSeriesRandomSession("series-1")).toMatchObject({
      startedEpisodeIds: [],
      currentEpisodeId: null,
    });

    randomSessionRepository.deleteSeriesRandomSession("series-1");
    expect(randomSessionRepository.getSeriesRandomSession("series-1")).toBeNull();
    vi.useRealTimers();
  });

  it("supports subtitle repository CRUD, upsert conflict, and preference semantics", () => {
    const db = createInMemoryStorageDb();
    const movieRepository = createMovieRepository({ getDb: () => db });
    const episodeRepository = createEpisodeRepository({ getDb: () => db });
    const subtitleRepository = createSubtitleRepository({ getDb: () => db });

    movieRepository.upsertMovie({
      id: "movie-1",
      folderPath: "/library/movies/movie-1",
      filePath: "/library/movies/movie-1/movie.mkv",
      fileSizeBytes: 1_000,
      titleRaw: "Movie One Raw",
      titleClean: "Movie One",
      titleEditedAt: null,
      year: 2020,
      tmdbId: 1,
      posterPath: null,
      backdropPath: null,
      runtimeMinutes: 120,
      tmdbRating: 7.5,
      genres: ["Drama"],
      userGenres: [],
      directors: [],
      writers: [],
      actors: [],
      youtubeTrailerKey: null,
      personalRating: null,
      errorMessage: null,
      lastSyncedAt: 100,
    });
    episodeRepository.upsertEpisode({
      id: "ep-1",
      seasonId: "season-1",
      episodeNumber: 1,
      titleRaw: "Episode One",
      titleClean: "Episode One",
      filePath: "/library/series/show-a/season-1/ep-1.mkv",
      fileSizeBytes: 1,
      lastSyncedAt: 1,
    });

    subtitleRepository.upsertSubtitle({
      id: "sub-1",
      mediaType: "movie",
      mediaId: "movie-1",
      filePath: "/subs/movie-1/en.srt",
      fileName: "en.srt",
      language: "English",
      format: "srt",
      source: "opensubtitles",
      downloadedAt: 123,
    });
    subtitleRepository.upsertSubtitle({
      id: "sub-2",
      mediaType: "movie",
      mediaId: "movie-1",
      filePath: "/subs/movie-1/en.srt",
      fileName: "english-edited.srt",
      language: "English",
      format: "srt",
      source: "local",
      downloadedAt: null,
    });
    expect(subtitleRepository.getSubtitleById("sub-1")).toMatchObject({
      fileName: "english-edited.srt",
      source: "opensubtitles",
      downloadedAt: 123,
    });
    expect(subtitleRepository.getSubtitleById("sub-2")).toBeNull();

    subtitleRepository.upsertSubtitle({
      id: "sub-3",
      mediaType: "movie",
      mediaId: "movie-1",
      filePath: "/subs/movie-1/fr.srt",
      fileName: "fr.srt",
      language: "French",
      format: "srt",
      source: "local",
      downloadedAt: null,
    });
    subtitleRepository.upsertSubtitle({
      id: "sub-4",
      mediaType: "movie",
      mediaId: "movie-1",
      filePath: "/subs/movie-1/fr-2.srt",
      fileName: "a-fr.srt",
      language: "French",
      format: "srt",
      source: "local",
      downloadedAt: null,
    });
    subtitleRepository.upsertSubtitle({
      id: "sub-5",
      mediaType: "episode",
      mediaId: "ep-1",
      filePath: "/subs/episode-1/en.srt",
      fileName: "en.srt",
      language: "English",
      format: "srt",
      source: "local",
      downloadedAt: null,
    });
    expect(subtitleRepository.listSubtitlesByMedia("movie", "movie-1").map((sub) => sub.id)).toEqual([
      "sub-1",
      "sub-4",
      "sub-3",
    ]);

    subtitleRepository.deleteSubtitlesByMediaId("movie", "movie-1", ["/subs/movie-1/fr.srt"]);
    expect(subtitleRepository.listSubtitlesByMedia("movie", "movie-1").map((sub) => sub.id)).toEqual([
      "sub-3",
    ]);

    subtitleRepository.deleteSubtitleById("sub-3");
    expect(subtitleRepository.getSubtitleById("sub-3")).toBeNull();

    subtitleRepository.deleteSubtitlesByMediaId("episode", "ep-1", []);
    expect(subtitleRepository.listSubtitlesByMedia("episode", "ep-1")).toEqual([]);

    subtitleRepository.updateMovieSubtitlePreference("movie-1", "sub-1", true);
    subtitleRepository.updateEpisodeSubtitlePreference("ep-1", null, false);
    expect(movieRepository.getMovieById("movie-1")).toMatchObject({
      selectedSubtitleId: "sub-1",
      subtitlesEnabled: 1,
    });
    expect(episodeRepository.getEpisodeById("ep-1")).toMatchObject({
      selectedSubtitleId: null,
      subtitlesEnabled: 0,
    });
  });
});
