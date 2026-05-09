import { describe, it, expect } from "vitest";
import { buildSeasonPayload } from "@/lib/sync/seasonSyncer";
import type { SeasonRow } from "@/lib/storage";
import type { ScannedSeason } from "@/lib/scan";
import type { OmdbMovie } from "@/lib/omdb";

const baseSeason: ScannedSeason = {
  seasonFolderPath: "/series/Breaking Bad (2008)/Season 1",
  seriesFolderPath: "/series/Breaking Bad (2008)",
  seasonNumber: 1,
  titleRaw: "Season 1",
  episodes: [],
  errorMessage: null,
};

const baseRow: SeasonRow = {
  id: "def456",
  seriesFolderPath: "/series/Breaking Bad (2008)",
  seasonFolderPath: "/series/Breaking Bad (2008)/Season 1",
  seasonNumber: 1,
  titleRaw: "Season 1",
  titleClean: "Breaking Bad - Season 1",
  titleEditedAt: null,
  year: 2008,
  tmdbId: 1396,
  posterPath: "https://example.com/bb-poster.jpg",
  backdropPath: "https://example.com/bb-backdrop.jpg",
  tmdbRating: 9.5,
  genresJson: '["Crime","Drama"]',
  userGenresJson: '["Favourite"]',
  directorsJson: '["Vince Gilligan"]',
  writersJson: '["Vince Gilligan"]',
  actorsJson: '["Bryan Cranston","Aaron Paul"]',
  personalRating: 10,
  errorMessage: null,
  lastSyncedAt: 1700000000000,
  xxxRated: 0,
  watched: 0,
};

const omdbData: OmdbMovie = {
  providerId: 1396,
  posterPath: "https://omdb.com/bb-poster.jpg",
  backdropPath: null,
  runtimeMinutes: null,
  tmdbRating: 9.5,
  genres: ["Crime", "Drama", "Thriller"],
  directors: ["Vince Gilligan"],
  writers: ["Vince Gilligan", "Thomas Schnauz"],
  actors: ["Bryan Cranston", "Aaron Paul", "Anna Gunn"],
  youtubeTrailerKey: null,
};

const FIXED_ID = "abc000";
const SYNCED_AT = 1234567890;

describe("buildSeasonPayload", () => {
  it("uses OMDb data when available", () => {
    const payload = buildSeasonPayload(baseSeason, null, omdbData, SYNCED_AT, FIXED_ID);
    expect(payload.tmdbId).toBe(omdbData.providerId);
    expect(payload.genres).toEqual(omdbData.genres);
    expect(payload.directors).toEqual(omdbData.directors);
  });

  it("falls back to existing row data when no OMDb data", () => {
    const payload = buildSeasonPayload(baseSeason, baseRow, null, SYNCED_AT, FIXED_ID);
    expect(payload.tmdbId).toBe(baseRow.tmdbId);
    expect(payload.genres).toEqual(["Crime", "Drama"]);
  });

  it("derives title as 'Series - Season N' when seasonNumber is set", () => {
    const payload = buildSeasonPayload(baseSeason, null, null, SYNCED_AT, FIXED_ID);
    expect(payload.titleClean).toBe("Breaking Bad - Season 1");
  });

  it("derives title as 'Series - titleRaw' when seasonNumber is null", () => {
    const noNumberSeason = { ...baseSeason, seasonNumber: null, titleRaw: "Specials" };
    const payload = buildSeasonPayload(noNumberSeason, null, null, SYNCED_AT, FIXED_ID);
    expect(payload.titleClean).toBe("Breaking Bad - Specials");
  });

  it("preserves existing https:// poster", () => {
    const payload = buildSeasonPayload(baseSeason, baseRow, omdbData, SYNCED_AT, FIXED_ID);
    expect(payload.posterPath).toBe(baseRow.posterPath);
  });

  it("uses OMDb poster when existing poster is not a kept URL", () => {
    const rowWithLocalPoster = { ...baseRow, posterPath: "/tmp/bb.jpg" };
    const payload = buildSeasonPayload(baseSeason, rowWithLocalPoster, omdbData, SYNCED_AT, FIXED_ID);
    expect(payload.posterPath).toBe(omdbData.posterPath);
  });

  it("preserves user-edited title when titleEditedAt is set", () => {
    const editedRow = { ...baseRow, titleEditedAt: 1700000000, titleClean: "My Custom Title" };
    const payload = buildSeasonPayload(baseSeason, editedRow, omdbData, SYNCED_AT, FIXED_ID);
    expect(payload.titleClean).toBe("My Custom Title");
  });

  it("preserves personalRating and userGenres from existing row", () => {
    const payload = buildSeasonPayload(baseSeason, baseRow, omdbData, SYNCED_AT, FIXED_ID);
    expect(payload.personalRating).toBe(10);
    expect(payload.userGenres).toEqual(["Favourite"]);
  });

  it("preserves xxxRated and watched flags from existing row", () => {
    const xxxRow = { ...baseRow, xxxRated: 1, watched: 1 };
    const payload = buildSeasonPayload(baseSeason, xxxRow, omdbData, SYNCED_AT, FIXED_ID);
    expect(payload.xxxRated).toBe(1);
    expect(payload.watched).toBe(1);
  });

  it("defaults xxxRated and watched to 0 when no existing row", () => {
    const payload = buildSeasonPayload(baseSeason, null, null, SYNCED_AT, FIXED_ID);
    expect(payload.xxxRated).toBe(0);
    expect(payload.watched).toBe(0);
  });

  it("returns empty arrays for all people fields when no data exists", () => {
    const payload = buildSeasonPayload(baseSeason, null, null, SYNCED_AT, FIXED_ID);
    expect(payload.genres).toEqual([]);
    expect(payload.directors).toEqual([]);
    expect(payload.writers).toEqual([]);
    expect(payload.actors).toEqual([]);
  });

  it("prefers OMDb genres over existing when OMDb returns non-empty genres", () => {
    const payload = buildSeasonPayload(baseSeason, baseRow, omdbData, SYNCED_AT, FIXED_ID);
    expect(payload.genres).toEqual(["Crime", "Drama", "Thriller"]);
  });

  it("uses existing genres when OMDb returns empty genres", () => {
    const omdbNoGenres = { ...omdbData, genres: [] };
    const payload = buildSeasonPayload(baseSeason, baseRow, omdbNoGenres, SYNCED_AT, FIXED_ID);
    expect(payload.genres).toEqual(["Crime", "Drama"]);
  });

  it("sets lastSyncedAt to syncedAt", () => {
    const payload = buildSeasonPayload(baseSeason, null, null, SYNCED_AT, FIXED_ID);
    expect(payload.lastSyncedAt).toBe(SYNCED_AT);
  });

  it("sets id to the supplied id argument", () => {
    const payload = buildSeasonPayload(baseSeason, null, null, SYNCED_AT, FIXED_ID);
    expect(payload.id).toBe(FIXED_ID);
  });
});
