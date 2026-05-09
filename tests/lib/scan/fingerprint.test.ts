import { describe, it, expect } from "vitest";
import {
  createMovieFingerprint,
  createSeasonFingerprint,
  createSeriesFingerprint,
} from "@/lib/scan/fingerprint";
import type { VideoFile } from "@/lib/scan/types";
import type { FolderScanEntryUpsert } from "@/lib/storage";

const makeVideo = (overrides: Partial<VideoFile> = {}): VideoFile => ({
  filePath: "/movies/film.mkv",
  size: 1_000_000,
  mtimeMs: 1700000000000,
  name: "film.mkv",
  ...overrides,
});

const makeEntry = (overrides: Partial<FolderScanEntryUpsert> = {}): FolderScanEntryUpsert => ({
  folderPath: "/seasons/s1",
  entryPath: "/seasons/s1/e01.mkv",
  sizeBytes: 500_000,
  mtimeMs: 1700000000000,
  ...overrides,
});

describe("createMovieFingerprint", () => {
  it("produces a non-empty hex string", () => {
    const fp = createMovieFingerprint(makeVideo(), null);
    expect(fp).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is deterministic for the same input", () => {
    const video = makeVideo();
    expect(createMovieFingerprint(video, null)).toBe(createMovieFingerprint(video, null));
  });

  it("differs when file path changes", () => {
    const a = createMovieFingerprint(makeVideo({ filePath: "/a.mkv" }), null);
    const b = createMovieFingerprint(makeVideo({ filePath: "/b.mkv" }), null);
    expect(a).not.toBe(b);
  });

  it("differs when size changes", () => {
    const a = createMovieFingerprint(makeVideo({ size: 1000 }), null);
    const b = createMovieFingerprint(makeVideo({ size: 2000 }), null);
    expect(a).not.toBe(b);
  });

  it("differs when mtime changes", () => {
    const a = createMovieFingerprint(makeVideo({ mtimeMs: 1000 }), null);
    const b = createMovieFingerprint(makeVideo({ mtimeMs: 9999 }), null);
    expect(a).not.toBe(b);
  });

  it("differs when errorMessage changes", () => {
    const a = createMovieFingerprint(null, null);
    const b = createMovieFingerprint(null, "No video file found in folder.");
    expect(a).not.toBe(b);
  });

  it("treats null video as a distinct state from a video", () => {
    const a = createMovieFingerprint(null, null);
    const b = createMovieFingerprint(makeVideo(), null);
    expect(a).not.toBe(b);
  });
});

describe("createSeriesFingerprint", () => {
  it("is deterministic", () => {
    const paths = ["/series/s1", "/series/s2"];
    expect(createSeriesFingerprint(paths)).toBe(createSeriesFingerprint(paths));
  });

  it("is order-independent (sorts internally)", () => {
    const a = createSeriesFingerprint(["/series/s1", "/series/s2"]);
    const b = createSeriesFingerprint(["/series/s2", "/series/s1"]);
    expect(a).toBe(b);
  });

  it("differs when a season path is added", () => {
    const a = createSeriesFingerprint(["/series/s1"]);
    const b = createSeriesFingerprint(["/series/s1", "/series/s2"]);
    expect(a).not.toBe(b);
  });

  it("produces a sha1 hex string", () => {
    expect(createSeriesFingerprint([])).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("createSeasonFingerprint", () => {
  it("is deterministic", () => {
    const entries = [makeEntry()];
    expect(createSeasonFingerprint(entries, null)).toBe(createSeasonFingerprint(entries, null));
  });

  it("differs when entry path changes", () => {
    const a = createSeasonFingerprint([makeEntry({ entryPath: "/s1/e01.mkv" })], null);
    const b = createSeasonFingerprint([makeEntry({ entryPath: "/s1/e02.mkv" })], null);
    expect(a).not.toBe(b);
  });

  it("differs when errorMessage changes", () => {
    const entries = [makeEntry()];
    const a = createSeasonFingerprint(entries, null);
    const b = createSeasonFingerprint(entries, "No parseable episodes found in season.");
    expect(a).not.toBe(b);
  });

  it("differs when entry size changes", () => {
    const a = createSeasonFingerprint([makeEntry({ sizeBytes: 1000 })], null);
    const b = createSeasonFingerprint([makeEntry({ sizeBytes: 9999 })], null);
    expect(a).not.toBe(b);
  });
});
