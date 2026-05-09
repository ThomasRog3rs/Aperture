import { describe, it, expect } from "vitest";
import { buildCachedState, restoreSeenState } from "@/lib/scan/cache";
import type { FolderScanEntryRow, FolderScanStateRow } from "@/lib/storage";

const makeStateRow = (overrides: Partial<FolderScanStateRow> = {}): FolderScanStateRow => ({
  folderPath: "/movies/film",
  folderType: "movie",
  parentFolderPath: null,
  dirMtimeMs: 1700000000000,
  fingerprint: "abc123",
  lastSeenAt: 1700000000000,
  lastScannedAt: 1700000000000,
  ...overrides,
});

const makeEntryRow = (overrides: Partial<FolderScanEntryRow> = {}): FolderScanEntryRow => ({
  folderPath: "/movies/film",
  entryPath: "/movies/film/film.mkv",
  sizeBytes: 1_000_000,
  mtimeMs: 1700000000000,
  ...overrides,
});

describe("buildCachedState", () => {
  it("indexes states by folderPath", () => {
    const state = makeStateRow({ folderPath: "/movies/film" });
    const cache = buildCachedState([state], []);
    expect(cache.stateByPath.get("/movies/film")).toBe(state);
  });

  it("groups child states by parentFolderPath", () => {
    const parent = makeStateRow({ folderPath: "/series/show", folderType: "series" });
    const child = makeStateRow({
      folderPath: "/series/show/s1",
      folderType: "season",
      parentFolderPath: "/series/show",
    });
    const cache = buildCachedState([parent, child], []);
    const children = cache.childStatesByParent.get("/series/show") ?? [];
    expect(children).toHaveLength(1);
    expect(children[0]).toBe(child);
  });

  it("excludes root states (null parentFolderPath) from childStatesByParent", () => {
    const root = makeStateRow({ parentFolderPath: null });
    const cache = buildCachedState([root], []);
    expect(cache.childStatesByParent.size).toBe(0);
  });

  it("indexes entries by folderPath", () => {
    const entry = makeEntryRow({ folderPath: "/movies/film" });
    const cache = buildCachedState([], [entry]);
    const entries = cache.entriesByFolderPath.get("/movies/film") ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toBe(entry);
  });

  it("groups multiple entries under the same folderPath", () => {
    const e1 = makeEntryRow({ entryPath: "/movies/film/a.mkv" });
    const e2 = makeEntryRow({ entryPath: "/movies/film/b.mkv" });
    const cache = buildCachedState([], [e1, e2]);
    expect(cache.entriesByFolderPath.get("/movies/film")).toHaveLength(2);
  });

  it("returns empty maps for empty inputs", () => {
    const cache = buildCachedState([], []);
    expect(cache.stateByPath.size).toBe(0);
    expect(cache.childStatesByParent.size).toBe(0);
    expect(cache.entriesByFolderPath.size).toBe(0);
  });
});

describe("restoreSeenState", () => {
  it("copies all fields from previousState", () => {
    const prev = makeStateRow();
    const result = restoreSeenState(prev, 9999);
    expect(result.folderPath).toBe(prev.folderPath);
    expect(result.folderType).toBe(prev.folderType);
    expect(result.fingerprint).toBe(prev.fingerprint);
    expect(result.lastScannedAt).toBe(prev.lastScannedAt);
  });

  it("updates lastSeenAt to the provided now value", () => {
    const prev = makeStateRow({ lastSeenAt: 1000 });
    const result = restoreSeenState(prev, 9999);
    expect(result.lastSeenAt).toBe(9999);
  });

  it("applies overrides over the copied state", () => {
    const prev = makeStateRow({ dirMtimeMs: 1000 });
    const result = restoreSeenState(prev, 9999, { dirMtimeMs: 5000 });
    expect(result.dirMtimeMs).toBe(5000);
  });

  it("does not mutate the previousState object", () => {
    const prev = makeStateRow({ lastSeenAt: 1000 });
    restoreSeenState(prev, 9999);
    expect(prev.lastSeenAt).toBe(1000);
  });
});
