import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb, getDb } from "@/lib/db";
import { getDbPath } from "@/lib/runtimeDataPaths";
import {
  countDeletedItems,
  deleteSubtitleById,
  deleteSubtitlesByMediaId,
  getEpisodeById,
  getEpisodesBySeasonId,
  getMovieById,
  getSeasonById,
  getSeriesByFolderPath,
  getSeriesById,
  getSeriesRandomSession,
  getSubtitleById,
  listAllFolderScanEntries,
  listAllFolderScanStates,
  listDeletedMovies,
  listDeletedSeasons,
  listGenres,
  listMovies,
  listPeople,
  listSeasons,
  listSubtitlesByMedia,
  markEpisodesDeletedNotInSeason,
  markMoviesDeleted,
  markSeasonsDeleted,
  markSeriesRandomSessionEpisodeStarted,
  purgeDeletedItems,
  replaceSeriesRandomSession,
  restoreMoviesByIds,
  restoreSeasonsByIds,
  saveFolderScanSnapshot,
  updateEpisode,
  updateMovie,
  updateSeason,
  updateSeries,
  upsertEpisode,
  upsertMovie,
  upsertSeason,
  upsertSeries,
  upsertSubtitle,
} from "@/lib/storage";

const TEST_DATA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "aperture-storage-"));
const DATA_DIR = path.join(TEST_DATA_ROOT, "data");

function resetStorageDb() {
  closeDb();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}

function movieFixture(id: string, overrides: Partial<Parameters<typeof upsertMovie>[0]> = {}) {
  return {
    id,
    folderPath: `/library/movies/${id}`,
    filePath: `/library/movies/${id}/movie.mkv`,
    fileSizeBytes: 1_000,
    titleRaw: `${id} Raw`,
    titleClean: `${id} Clean`,
    titleEditedAt: null,
    year: 2020,
    tmdbId: 100,
    posterPath: null,
    backdropPath: null,
    runtimeMinutes: 120,
    tmdbRating: 8.1,
    genres: ["Drama"],
    userGenres: [],
    directors: ["Jane Doe"],
    writers: ["Writer One"],
    actors: ["Actor One"],
    youtubeTrailerKey: null,
    personalRating: null,
    errorMessage: null,
    lastSyncedAt: 1,
    ...overrides,
  };
}

function seasonFixture(id: string, overrides: Partial<Parameters<typeof upsertSeason>[0]> = {}) {
  return {
    id,
    seriesFolderPath: "/library/series/show-a",
    seasonFolderPath: `/library/series/show-a/${id}`,
    seasonNumber: 1,
    titleRaw: `${id} Raw`,
    titleClean: `${id} Clean`,
    titleEditedAt: null,
    year: 2020,
    tmdbId: 200,
    posterPath: null,
    backdropPath: null,
    tmdbRating: 7.5,
    genres: ["Drama"],
    userGenres: [],
    directors: ["Jane Doe"],
    writers: ["Writer One"],
    actors: ["Actor One"],
    personalRating: null,
    errorMessage: null,
    lastSyncedAt: 1,
    xxxRated: 0,
    watched: 0,
    ...overrides,
  };
}

function episodeFixture(id: string, seasonId: string, overrides: Partial<Parameters<typeof upsertEpisode>[0]> = {}) {
  return {
    id,
    seasonId,
    episodeNumber: 1,
    titleRaw: `${id} Raw`,
    titleClean: `${id} Clean`,
    filePath: `/library/series/show-a/${seasonId}/${id}.mkv`,
    fileSizeBytes: 500,
    lastSyncedAt: 1,
    ...overrides,
  };
}

function seriesFixture(id: string, overrides: Partial<Parameters<typeof upsertSeries>[0]> = {}) {
  return {
    id,
    seriesFolderPath: "/library/series/show-a",
    titleClean: "Show A",
    titleEditedAt: null,
    year: 2020,
    tmdbId: 300,
    posterPath: null,
    tmdbRating: 8.5,
    genres: ["Drama"],
    userGenres: [],
    directors: ["Jane Doe"],
    writers: ["Writer One"],
    actors: ["Actor One"],
    errorMessage: null,
    lastSyncedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.APERTURE_DATA_DIR = DATA_DIR;
  resetStorageDb();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.closeSync(fs.openSync(getDbPath(), "w"));
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  resetStorageDb();
  delete process.env.APERTURE_DATA_DIR;
  fs.rmSync(TEST_DATA_ROOT, { recursive: true, force: true });
});

describe("storage characterization", () => {
  it("covers movie/season/episode/series core upsert/list/update/get flows", () => {
    upsertMovie(movieFixture("movie-1", { titleClean: "Bravo" }));
    upsertMovie(movieFixture("movie-2", { titleClean: "Alpha" }));

    expect(listMovies({}).map((movie) => movie.id)).toEqual(["movie-2", "movie-1"]);
    updateMovie("movie-1", { watched: 1, titleClean: "Charlie" });
    expect(getMovieById("movie-1")?.watched).toBe(1);
    expect(getMovieById("movie-1")?.titleClean).toBe("Charlie");

    upsertSeries(seriesFixture("series-1"));
    updateSeries("series-1", { titleClean: "Show A Edited" });
    expect(getSeriesById("series-1")?.titleClean).toBe("Show A Edited");
    expect(getSeriesByFolderPath("/library/series/show-a")?.id).toBe("series-1");

    upsertSeason(seasonFixture("season-1", { titleClean: "Season Bravo", seasonNumber: 2 }));
    upsertSeason(seasonFixture("season-2", { titleClean: "Season Alpha", seasonNumber: 1 }));

    expect(listSeasons({}).map((season) => season.id)).toEqual(["season-2", "season-1"]);
    updateSeason("season-1", { watched: 1, titleClean: "Season Charlie" });
    expect(getSeasonById("season-1")?.watched).toBe(1);
    expect(getSeasonById("season-1")?.titleClean).toBe("Season Charlie");

    upsertEpisode(episodeFixture("episode-1", "season-1", { episodeNumber: null, titleClean: "ZZZ" }));
    upsertEpisode(episodeFixture("episode-2", "season-1", { episodeNumber: 2, titleClean: "BBB" }));
    upsertEpisode(episodeFixture("episode-3", "season-1", { episodeNumber: 1, titleClean: "AAA" }));

    expect(getEpisodesBySeasonId("season-1").map((episode) => episode.id)).toEqual([
      "episode-3",
      "episode-2",
      "episode-1",
    ]);

    updateEpisode("episode-1", { watched: 1, watchProgressSeconds: 42 });
    expect(getEpisodeById("episode-1")?.watched).toBe(1);
    expect(getEpisodeById("episode-1")?.watchProgressSeconds).toBe(42);
  });

  it("persists folder scan snapshots and preserves series entries not tracked for replacement", () => {
    saveFolderScanSnapshot(
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

    saveFolderScanSnapshot(
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

    expect(listAllFolderScanStates().map((state) => state.folderPath).sort()).toEqual([
      "/library/series/show-a",
      "/library/series/show-a/season-1",
    ]);

    const entriesByFolder = listAllFolderScanEntries().reduce<Record<string, string[]>>((acc, row) => {
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

  it("captures series random session replace/parse/mark-started semantics", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    replaceSeriesRandomSession("series-1", ["ep-1", "ep-2"], null);
    const parsedFallback = getSeriesRandomSession("series-1");
    expect(parsedFallback?.currentEpisodeId).toBe("ep-2");

    vi.setSystemTime(new Date("2024-01-01T00:00:01.000Z"));
    const duplicateMark = markSeriesRandomSessionEpisodeStarted("series-1", "ep-2");
    expect(duplicateMark.startedEpisodeIds).toEqual(["ep-1", "ep-2"]);

    vi.setSystemTime(new Date("2024-01-01T00:00:02.000Z"));
    const nextMark = markSeriesRandomSessionEpisodeStarted("series-1", "ep-3");
    expect(nextMark.startedEpisodeIds).toEqual(["ep-1", "ep-2", "ep-3"]);
    expect(nextMark.currentEpisodeId).toBe("ep-3");
    expect(nextMark.createdAt).toBe(1704067200000);

    const db = getDb();
    db.prepare(
      "UPDATE series_random_sessions SET startedEpisodeIdsJson = ?, currentEpisodeId = ? WHERE seriesId = ?"
    ).run('["ep-x", "ep-x", "", 123, "ep-y"]', "   ", "series-1");

    expect(getSeriesRandomSession("series-1")).toMatchObject({
      seriesId: "series-1",
      startedEpisodeIds: ["ep-x", "ep-y"],
      currentEpisodeId: "ep-y",
    });

    db.prepare(
      "UPDATE series_random_sessions SET startedEpisodeIdsJson = ?, currentEpisodeId = ? WHERE seriesId = ?"
    ).run("not-json", "", "series-1");

    expect(getSeriesRandomSession("series-1")).toMatchObject({
      seriesId: "series-1",
      startedEpisodeIds: [],
      currentEpisodeId: null,
    });
  });

  it("covers deleted items list/count/restore/purge behavior including related episodes", () => {
    upsertMovie(movieFixture("movie-1"));
    upsertMovie(movieFixture("movie-2"));

    upsertSeason(seasonFixture("season-1"));
    upsertSeason(seasonFixture("season-2", { seasonFolderPath: "/library/series/show-a/season-2" }));

    upsertEpisode(episodeFixture("episode-1", "season-1"));
    upsertEpisode(episodeFixture("episode-2", "season-1", { episodeNumber: 2 }));
    upsertEpisode(
      episodeFixture("episode-3", "season-2", {
        filePath: "/library/series/show-a/season-2/episode-3.mkv",
      })
    );

    markMoviesDeleted(["/library/movies/movie-1"]);
    markSeasonsDeleted(["/library/series/show-a/season-1"]);
    markEpisodesDeletedNotInSeason("season-1", []);

    expect(listDeletedMovies().map((movie) => movie.id)).toEqual(["movie-1"]);
    expect(listDeletedSeasons().map((season) => ({ id: season.id, deletedEpisodeCount: season.deletedEpisodeCount }))).toEqual([
      { id: "season-1", deletedEpisodeCount: 2 },
    ]);
    expect(countDeletedItems()).toEqual({ movies: 1, seasons: 1, episodes: 2, total: 4 });

    restoreMoviesByIds(["movie-1"]);
    restoreSeasonsByIds(["season-1"]);
    expect(countDeletedItems()).toEqual({ movies: 0, seasons: 0, episodes: 0, total: 0 });

    markMoviesDeleted(["/library/movies/movie-1"]);
    markSeasonsDeleted(["/library/series/show-a/season-2"]);

    expect(purgeDeletedItems()).toBe(2);
    expect(getMovieById("movie-1")).toBeNull();
    expect(getSeasonById("season-2")).toBeNull();
    expect(getEpisodeById("episode-3")).toBeNull();
    expect(getMovieById("movie-2")).not.toBeNull();
    expect(getSeasonById("season-1")).not.toBeNull();
  });

  it("covers subtitle upsert/list/get/delete semantics", () => {
    upsertSubtitle({
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

    upsertSubtitle({
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

    expect(getSubtitleById("sub-1")).toMatchObject({
      fileName: "english-edited.srt",
      source: "opensubtitles",
      downloadedAt: 123,
    });
    expect(getSubtitleById("sub-2")).toBeNull();

    upsertSubtitle({
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
    upsertSubtitle({
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
    upsertSubtitle({
      id: "sub-5",
      mediaType: "episode",
      mediaId: "episode-1",
      filePath: "/subs/episode-1/en.srt",
      fileName: "en.srt",
      language: "English",
      format: "srt",
      source: "local",
      downloadedAt: null,
    });

    expect(listSubtitlesByMedia("movie", "movie-1").map((sub) => sub.id)).toEqual([
      "sub-1",
      "sub-4",
      "sub-3",
    ]);

    deleteSubtitlesByMediaId("movie", "movie-1", ["/subs/movie-1/fr.srt"]);
    expect(listSubtitlesByMedia("movie", "movie-1").map((sub) => sub.id)).toEqual(["sub-3"]);

    deleteSubtitleById("sub-3");
    expect(getSubtitleById("sub-3")).toBeNull();

    deleteSubtitlesByMediaId("episode", "episode-1", []);
    expect(listSubtitlesByMedia("episode", "episode-1")).toEqual([]);
  });

  it("aggregates filter options with JSON parse resilience and case-insensitive de-duplication", () => {
    upsertMovie(
      movieFixture("movie-1", {
        genres: [" Drama ", "Action"],
        userGenres: ["Drama", "Comedy"],
        directors: [" Jane Doe ", "John Smith"],
        writers: ["Amy"],
        actors: ["Actor A", " "],
      })
    );

    upsertSeason(
      seasonFixture("season-1", {
        genres: ["action", "Thriller"],
        userGenres: [""],
        directors: ["john smith", "Zed"],
        writers: ["Beta"],
        actors: ["actor a", "Actor B"],
      })
    );

    upsertMovie(movieFixture("movie-2", { genres: ["Horror"], userGenres: ["Indie"] }));

    const db = getDb();
    db.prepare("UPDATE movies SET genresJson = ?, userGenresJson = ? WHERE id = ?").run(
      "not-json",
      "still-not-json",
      "movie-2"
    );
    db.prepare("UPDATE seasons SET writersJson = ? WHERE id = ?").run("{ bad", "season-1");

    expect(listGenres()).toEqual(["Action", "Comedy", "Drama", "Thriller"]);
    expect(listPeople()).toEqual({
      directors: ["Jane Doe", "John Smith", "Zed"],
      writers: ["Amy", "Writer One"],
      actors: ["Actor A", "Actor B", "Actor One"],
    });
  });
});
