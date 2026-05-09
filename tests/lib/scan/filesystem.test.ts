import { describe, it, expect } from "vitest";
import type { Dirent, Stats } from "node:fs";
import type { FolderScanEntryRow } from "@/lib/storage";
import { listVideoFiles, haveTrackedEntriesChanged, type FileSystemReader } from "@/lib/scan/filesystem";

function makeDirent(name: string, isFile = true): Dirent {
  return {
    name,
    isFile: () => isFile,
    isDirectory: () => !isFile,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: "/movies/film",
    path: "/movies/film",
  } as Dirent;
}

function makeStats(size: number, mtimeMs: number): Stats {
  return { size, mtimeMs } as Stats;
}

function makeMockFsr(
  statMap: Record<string, Stats | null>,
  dirMap: Record<string, Dirent[]>
): FileSystemReader {
  return {
    async stat(filePath) {
      return statMap[filePath] ?? null;
    },
    async readdir(dirPath) {
      return dirMap[dirPath] ?? [];
    },
  };
}

describe("listVideoFiles", () => {
  it("returns video files with correct metadata", async () => {
    const fsr = makeMockFsr(
      { "/movies/film/film.mkv": makeStats(1_000_000, 1700000000000) },
      { "/movies/film": [makeDirent("film.mkv")] }
    );
    const result = await listVideoFiles("/movies/film", fsr);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("film.mkv");
    expect(result[0].size).toBe(1_000_000);
    expect(result[0].mtimeMs).toBe(1700000000000);
  });

  it("filters out non-video extensions", async () => {
    const fsr = makeMockFsr(
      {},
      { "/movies/film": [makeDirent("notes.txt"), makeDirent("cover.jpg")] }
    );
    const result = await listVideoFiles("/movies/film", fsr);
    expect(result).toHaveLength(0);
  });

  it("filters out directories", async () => {
    const fsr = makeMockFsr(
      {},
      { "/movies/film": [makeDirent("extras", false)] }
    );
    const result = await listVideoFiles("/movies/film", fsr);
    expect(result).toHaveLength(0);
  });

  it("accepts all supported extensions", async () => {
    const extensions = ["mkv", "mp4", "m4v", "mov", "avi", "wmv", "mpg", "mpeg"];
    for (const ext of extensions) {
      const name = `file.${ext}`;
      const fsr = makeMockFsr(
        { [`/dir/${name}`]: makeStats(1000, 1000) },
        { "/dir": [makeDirent(name)] }
      );
      const result = await listVideoFiles("/dir", fsr);
      expect(result).toHaveLength(1);
    }
  });

  it("skips files where stat returns null", async () => {
    const fsr = makeMockFsr(
      { "/movies/film/film.mkv": null },
      { "/movies/film": [makeDirent("film.mkv")] }
    );
    const result = await listVideoFiles("/movies/film", fsr);
    expect(result).toHaveLength(0);
  });

  it("is case-insensitive for extensions", async () => {
    const fsr = makeMockFsr(
      { "/dir/FILM.MKV": makeStats(1000, 1000) },
      { "/dir": [makeDirent("FILM.MKV")] }
    );
    const result = await listVideoFiles("/dir", fsr);
    expect(result).toHaveLength(1);
  });
});

describe("haveTrackedEntriesChanged", () => {
  const makeEntry = (overrides: Partial<FolderScanEntryRow> = {}): FolderScanEntryRow => ({
    folderPath: "/movies/film",
    entryPath: "/movies/film/film.mkv",
    sizeBytes: 1_000_000,
    mtimeMs: 1700000000000,
    ...overrides,
  });

  it("returns false when all entries are unchanged", async () => {
    const entry = makeEntry();
    const fsr = makeMockFsr(
      { [entry.entryPath]: makeStats(entry.sizeBytes, entry.mtimeMs) },
      {}
    );
    expect(await haveTrackedEntriesChanged([entry], fsr)).toBe(false);
  });

  it("returns false for empty entries", async () => {
    const fsr = makeMockFsr({}, {});
    expect(await haveTrackedEntriesChanged([], fsr)).toBe(false);
  });

  it("returns true when file no longer exists (stat returns null)", async () => {
    const entry = makeEntry();
    const fsr = makeMockFsr({ [entry.entryPath]: null }, {});
    expect(await haveTrackedEntriesChanged([entry], fsr)).toBe(true);
  });

  it("returns true when file size has changed", async () => {
    const entry = makeEntry({ sizeBytes: 1_000_000 });
    const fsr = makeMockFsr(
      { [entry.entryPath]: makeStats(2_000_000, entry.mtimeMs) },
      {}
    );
    expect(await haveTrackedEntriesChanged([entry], fsr)).toBe(true);
  });

  it("returns true when file mtime has changed", async () => {
    const entry = makeEntry({ mtimeMs: 1000 });
    const fsr = makeMockFsr(
      { [entry.entryPath]: makeStats(entry.sizeBytes, 9999) },
      {}
    );
    expect(await haveTrackedEntriesChanged([entry], fsr)).toBe(true);
  });
});
