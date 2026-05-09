import { describe, it, expect } from "vitest";
import { buildMoviePayload } from "@/lib/sync/movieSyncer";
import type { MovieRow } from "@/lib/storage";
import type { ScannedMovie } from "@/lib/scan";
import type { OmdbMovie } from "@/lib/omdb";

const baseEntry: ScannedMovie = {
  folderPath: "/movies/Inception (2010)",
  titleRaw: "Inception (2010)",
  filePath: "/movies/Inception (2010)/inception.mkv",
  fileSizeBytes: 1_000_000_000,
  errorMessage: null,
};

const baseRow: MovieRow = {
  id: "abc123",
  folderPath: "/movies/Inception (2010)",
  filePath: "/movies/Inception (2010)/inception.mkv",
  fileSizeBytes: 1_000_000_000,
  titleRaw: "Inception (2010)",
  titleClean: "Inception",
  titleEditedAt: null,
  year: 2010,
  tmdbId: 27205,
  posterPath: "https://example.com/poster.jpg",
  backdropPath: "https://example.com/backdrop.jpg",
  runtimeMinutes: 148,
  tmdbRating: 8.8,
  genresJson: '["Action","Sci-Fi"]',
  userGenresJson: '["Favourite"]',
  directorsJson: '["Christopher Nolan"]',
  writersJson: '["Christopher Nolan"]',
  actorsJson: '["Leonardo DiCaprio"]',
  youtubeTrailerKey: "YoHD9XEInc0",
  personalRating: 9,
  errorMessage: null,
  lastSyncedAt: 1700000000000,
  xxxRated: 0,
  watched: 1,
};

const omdbData: OmdbMovie = {
  providerId: 27205,
  posterPath: "https://omdb.com/poster.jpg",
  backdropPath: null,
  runtimeMinutes: 148,
  tmdbRating: 8.8,
  genres: ["Action", "Adventure", "Sci-Fi"],
  directors: ["Christopher Nolan"],
  writers: ["Christopher Nolan"],
  actors: ["Leonardo DiCaprio", "Joseph Gordon-Levitt"],
  youtubeTrailerKey: null,
};

describe("buildMoviePayload", () => {
  it("uses OMDb data when available", () => {
    const payload = buildMoviePayload(baseEntry, null, omdbData, 1234567890, "id1");
    expect(payload.tmdbId).toBe(omdbData.providerId);
    expect(payload.genres).toEqual(omdbData.genres);
    expect(payload.directors).toEqual(omdbData.directors);
  });

  it("falls back to existing row data when no OMDb data", () => {
    const payload = buildMoviePayload(baseEntry, baseRow, null, 1234567890, "id1");
    expect(payload.tmdbId).toBe(baseRow.tmdbId);
    expect(payload.genres).toEqual(["Action", "Sci-Fi"]);
    expect(payload.directors).toEqual(["Christopher Nolan"]);
  });

  it("preserves existing https:// poster when OMDb has a different poster", () => {
    const payload = buildMoviePayload(baseEntry, baseRow, omdbData, 1234567890, "id1");
    expect(payload.posterPath).toBe(baseRow.posterPath);
  });

  it("uses OMDb poster when no existing poster is a kept URL", () => {
    const rowWithLocalPoster = { ...baseRow, posterPath: "/tmp/poster.jpg" };
    const payload = buildMoviePayload(baseEntry, rowWithLocalPoster, omdbData, 1234567890, "id1");
    expect(payload.posterPath).toBe(omdbData.posterPath);
  });

  it("preserves user-edited title when titleEditedAt is set", () => {
    const editedRow = { ...baseRow, titleEditedAt: 1700000000000, titleClean: "My Edit" };
    const payload = buildMoviePayload(baseEntry, editedRow, omdbData, 1234567890, "id1");
    expect(payload.titleClean).toBe("My Edit");
  });

  it("derives title from titleRaw when no edit override", () => {
    const payload = buildMoviePayload(baseEntry, null, null, 1234567890, "id1");
    expect(payload.titleClean).toBe("Inception");
    expect(payload.year).toBe(2010);
  });

  it("preserves personalRating from existing row", () => {
    const payload = buildMoviePayload(baseEntry, baseRow, omdbData, 1234567890, "id1");
    expect(payload.personalRating).toBe(9);
  });

  it("preserves userGenres from existing row", () => {
    const payload = buildMoviePayload(baseEntry, baseRow, omdbData, 1234567890, "id1");
    expect(payload.userGenres).toEqual(["Favourite"]);
  });

  it("returns empty arrays for all people fields when no data exists", () => {
    const payload = buildMoviePayload(baseEntry, null, null, 1234567890, "id1");
    expect(payload.genres).toEqual([]);
    expect(payload.directors).toEqual([]);
    expect(payload.writers).toEqual([]);
    expect(payload.actors).toEqual([]);
  });

  it("prefers OMDb genres over existing genres when OMDb returns data", () => {
    const payload = buildMoviePayload(baseEntry, baseRow, omdbData, 1234567890, "id1");
    expect(payload.genres).toEqual(["Action", "Adventure", "Sci-Fi"]);
  });

  it("uses existing genres when OMDb returns empty genres", () => {
    const omdbNoGenres = { ...omdbData, genres: [] };
    const payload = buildMoviePayload(baseEntry, baseRow, omdbNoGenres, 1234567890, "id1");
    expect(payload.genres).toEqual(["Action", "Sci-Fi"]);
  });

  it("sets errorMessage from entry", () => {
    const entryWithError = { ...baseEntry, errorMessage: "scan failed" };
    const payload = buildMoviePayload(entryWithError, null, null, 1234567890, "id1");
    expect(payload.errorMessage).toBe("scan failed");
  });

  it("sets lastSyncedAt to syncedAt", () => {
    const syncedAt = 9999999999;
    const payload = buildMoviePayload(baseEntry, null, null, syncedAt, "id1");
    expect(payload.lastSyncedAt).toBe(syncedAt);
  });
});
