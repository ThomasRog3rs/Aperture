import { describe, it, expect } from "vitest";
import type { Dirent, Stats } from "node:fs";
import type { FolderScanStateRow } from "@/lib/storage";
import { scanMovieFolderDeep } from "@/lib/scan/movieScanner";
import type { FileSystemReader } from "@/lib/scan/filesystem";

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
    async stat(filePath) { return statMap[filePath] ?? null; },
    async readdir(dirPath) { return dirMap[dirPath] ?? []; },
  };
}

const makePreviousState = (overrides: Partial<FolderScanStateRow> = {}): FolderScanStateRow => ({
  folderPath: "/movies/film",
  folderType: "movie",
  parentFolderPath: null,
  dirMtimeMs: 1700000000000,
  fingerprint: "old-fingerprint",
  lastSeenAt: 1700000000000,
  lastScannedAt: 1700000000000,
  ...overrides,
});

describe("scanMovieFolderDeep", () => {
  it("selects the largest video file", async () => {
    const fsr = makeMockFsr(
      {
        "/movies/film/small.mkv": makeStats(100, 1000),
        "/movies/film/large.mkv": makeStats(9999, 2000),
      },
      {
        "/movies/film": [makeDirent("small.mkv"), makeDirent("large.mkv")],
      }
    );
    const result = await scanMovieFolderDeep("/movies/film", "film", 1000, 5000, undefined, fsr);
    expect(result.movie.filePath).toBe("/movies/film/large.mkv");
    expect(result.movie.fileSizeBytes).toBe(9999);
    expect(result.movie.errorMessage).toBeNull();
  });

  it("sets errorMessage when no video files are found", async () => {
    const fsr = makeMockFsr({}, { "/movies/film": [] });
    const result = await scanMovieFolderDeep("/movies/film", "film", 1000, 5000, undefined, fsr);
    expect(result.movie.errorMessage).toBe("No video file found in folder.");
    expect(result.movie.filePath).toBe("");
    expect(result.movie.fileSizeBytes).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  it("marks changed=true when there is no previous state", async () => {
    const fsr = makeMockFsr(
      { "/movies/film/film.mkv": makeStats(1000, 1000) },
      { "/movies/film": [makeDirent("film.mkv")] }
    );
    const result = await scanMovieFolderDeep("/movies/film", "film", 1000, 5000, undefined, fsr);
    expect(result.changed).toBe(true);
  });

  it("marks changed=false when fingerprint matches previous state", async () => {
    const fsr = makeMockFsr(
      { "/movies/film/film.mkv": makeStats(1000, 1000) },
      { "/movies/film": [makeDirent("film.mkv")] }
    );
    // Do an initial scan to get the fingerprint
    const first = await scanMovieFolderDeep("/movies/film", "film", 1000, 5000, undefined, fsr);
    const prevState = makePreviousState({
      folderType: "movie",
      fingerprint: first.state.fingerprint,
    });
    const second = await scanMovieFolderDeep("/movies/film", "film", 1000, 9999, prevState, fsr);
    expect(second.changed).toBe(false);
  });

  it("marks changed=true when file size changes", async () => {
    const fsrFirst = makeMockFsr(
      { "/movies/film/film.mkv": makeStats(1000, 1000) },
      { "/movies/film": [makeDirent("film.mkv")] }
    );
    const first = await scanMovieFolderDeep("/movies/film", "film", 1000, 5000, undefined, fsrFirst);

    const fsrSecond = makeMockFsr(
      { "/movies/film/film.mkv": makeStats(2000, 1000) },
      { "/movies/film": [makeDirent("film.mkv")] }
    );
    const prevState = makePreviousState({ fingerprint: first.state.fingerprint, folderType: "movie" });
    const second = await scanMovieFolderDeep("/movies/film", "film", 1000, 9999, prevState, fsrSecond);
    expect(second.changed).toBe(true);
  });

  it("returns one entry for the selected video", async () => {
    const fsr = makeMockFsr(
      { "/movies/film/film.mkv": makeStats(1000, 9999) },
      { "/movies/film": [makeDirent("film.mkv")] }
    );
    const result = await scanMovieFolderDeep("/movies/film", "film", 1000, 5000, undefined, fsr);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].entryPath).toBe("/movies/film/film.mkv");
    expect(result.entries[0].sizeBytes).toBe(1000);
    expect(result.entries[0].mtimeMs).toBe(9999);
  });

  it("sets state folderType to movie", async () => {
    const fsr = makeMockFsr({}, { "/movies/film": [] });
    const result = await scanMovieFolderDeep("/movies/film", "film", 1000, 5000, undefined, fsr);
    expect(result.state.folderType).toBe("movie");
    expect(result.state.parentFolderPath).toBeNull();
  });
});
