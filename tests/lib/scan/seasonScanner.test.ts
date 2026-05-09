import { describe, it, expect } from "vitest";
import type { Dirent, Stats } from "node:fs";
import type { FolderScanStateRow } from "@/lib/storage";
import { scanSeasonFolderDeep } from "@/lib/scan/seasonScanner";
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
    parentPath: "/series/show/Season 1",
    path: "/series/show/Season 1",
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

const SEASON_PATH = "/series/show/Season 1";
const SERIES_PATH = "/series/show";

const makePreviousSeasonState = (
  overrides: Partial<FolderScanStateRow> = {}
): FolderScanStateRow => ({
  folderPath: SEASON_PATH,
  folderType: "season",
  parentFolderPath: SERIES_PATH,
  dirMtimeMs: 1700000000000,
  fingerprint: "old-fingerprint",
  lastSeenAt: 1700000000000,
  lastScannedAt: 1700000000000,
  ...overrides,
});

describe("scanSeasonFolderDeep", () => {
  it("returns hasVideos=false when folder is empty", async () => {
    const fsr = makeMockFsr({}, { [SEASON_PATH]: [] });
    const result = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 5000, undefined, fsr
    );
    expect(result.hasVideos).toBe(false);
    expect(result.season.episodes).toHaveLength(0);
    expect(result.season.errorMessage).not.toBeNull();
  });

  it("returns hasVideos=true when video files are present", async () => {
    const fsr = makeMockFsr(
      { [`${SEASON_PATH}/Show.S01E01.mkv`]: makeStats(1000, 1000) },
      { [SEASON_PATH]: [makeDirent("Show.S01E01.mkv")] }
    );
    const result = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 5000, undefined, fsr
    );
    expect(result.hasVideos).toBe(true);
  });

  it("parses episodes from parseable filenames", async () => {
    const fsr = makeMockFsr(
      {
        [`${SEASON_PATH}/Show.S01E01.mkv`]: makeStats(1000, 1000),
        [`${SEASON_PATH}/Show.S01E02.mkv`]: makeStats(1200, 1001),
      },
      {
        [SEASON_PATH]: [
          makeDirent("Show.S01E01.mkv"),
          makeDirent("Show.S01E02.mkv"),
        ],
      }
    );
    const result = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 5000, undefined, fsr
    );
    expect(result.season.episodes).toHaveLength(2);
    expect(result.season.episodes.map((e) => e.episodeNumber)).toEqual([1, 2]);
    expect(result.season.errorMessage).toBeNull();
  });

  it("marks changed=true when there is no previous state", async () => {
    const fsr = makeMockFsr(
      { [`${SEASON_PATH}/Show.S01E01.mkv`]: makeStats(1000, 1000) },
      { [SEASON_PATH]: [makeDirent("Show.S01E01.mkv")] }
    );
    const result = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 5000, undefined, fsr
    );
    expect(result.changed).toBe(true);
  });

  it("marks changed=false when fingerprint matches previous state", async () => {
    const fsr = makeMockFsr(
      { [`${SEASON_PATH}/Show.S01E01.mkv`]: makeStats(1000, 1000) },
      { [SEASON_PATH]: [makeDirent("Show.S01E01.mkv")] }
    );
    const first = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 5000, undefined, fsr
    );
    const prevState = makePreviousSeasonState({ fingerprint: first.state.fingerprint, folderType: "season" });
    const second = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 9999, prevState, fsr
    );
    expect(second.changed).toBe(false);
  });

  it("deduplicates episodes with the same episode number, keeping the largest", async () => {
    const fsr = makeMockFsr(
      {
        [`${SEASON_PATH}/Show.S01E01.720p.mkv`]: makeStats(500, 1000),
        [`${SEASON_PATH}/Show.S01E01.1080p.mkv`]: makeStats(2000, 1001),
      },
      {
        [SEASON_PATH]: [
          makeDirent("Show.S01E01.720p.mkv"),
          makeDirent("Show.S01E01.1080p.mkv"),
        ],
      }
    );
    const result = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 5000, undefined, fsr
    );
    expect(result.season.episodes).toHaveLength(1);
    expect(result.season.episodes[0].fileSizeBytes).toBe(2000);
  });

  it("sets state folderType to season with correct parentFolderPath", async () => {
    const fsr = makeMockFsr({}, { [SEASON_PATH]: [] });
    const result = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 5000, undefined, fsr
    );
    expect(result.state.folderType).toBe("season");
    expect(result.state.parentFolderPath).toBe(SERIES_PATH);
  });

  it("sets errorMessage when no parseable episodes are found even with video files", async () => {
    // Files that don't match episode pattern
    const fsr = makeMockFsr(
      { [`${SEASON_PATH}/extras.mkv`]: makeStats(1000, 1000) },
      { [SEASON_PATH]: [makeDirent("extras.mkv")] }
    );
    const result = await scanSeasonFolderDeep(
      SEASON_PATH, SERIES_PATH, 1, "Season 1", 1000, 5000, undefined, fsr
    );
    expect(result.hasVideos).toBe(true);
    expect(result.season.errorMessage).not.toBeNull();
    expect(result.season.episodes).toHaveLength(0);
  });
});
