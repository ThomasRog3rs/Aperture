import path from "node:path";
import { parseSeasonNumberFromFolder } from "@/lib/parseSeasonEpisode";
import type { FolderScanStateRow } from "@/lib/storage";
import { createMovieFingerprint, createSeriesFingerprint } from "./fingerprint";
import { type FileSystemReader } from "./filesystem";
import { scanMovieFolderDeep } from "./movieScanner";
import { scanSeasonFolderDeep } from "./seasonScanner";
import type {
  DeepSeasonScan,
  IncrementalStats,
  ScannedMovie,
  ScannedSeason,
} from "./types";
import type { FolderScanStateUpsert, FolderScanEntryUpsert } from "@/lib/storage";

type FolderScanResult = {
  kind: "movie" | "series";
  movies: ScannedMovie[];
  seasons: ScannedSeason[];
  currentMovieFolderPaths: string[];
  currentSeasonFolderPaths: string[];
  scanStates: FolderScanStateUpsert[];
  scanEntries: FolderScanEntryUpsert[];
};

export async function deepScanTopLevelFolder(
  folderPath: string,
  folderName: string,
  dirMtimeMs: number,
  now: number,
  previousState: FolderScanStateRow | undefined,
  previousSeasonStatesByPath: Map<string, FolderScanStateRow>,
  stats: IncrementalStats,
  fsr: FileSystemReader
): Promise<FolderScanResult> {
  try {
    const folderEntries = await fsr.readdir(folderPath);
    const seasonResults: DeepSeasonScan[] = [];

    for (const entry of folderEntries) {
      if (!entry.isDirectory()) continue;
      const seasonNumber = parseSeasonNumberFromFolder(entry.name);
      if (seasonNumber === null) continue;
      const seasonFolderPath = path.join(folderPath, entry.name);
      const seasonStat = await fsr.stat(seasonFolderPath);
      if (!seasonStat) continue;
      stats.seasonFoldersChecked += 1;
      stats.foldersRescanned += 1;
      const seasonResult = await scanSeasonFolderDeep(
        seasonFolderPath,
        folderPath,
        seasonNumber,
        entry.name,
        seasonStat.mtimeMs,
        now,
        previousSeasonStatesByPath.get(seasonFolderPath),
        fsr
      );
      if (!seasonResult.hasVideos) continue;
      if (seasonResult.changed) {
        stats.foldersChanged += 1;
      }
      seasonResults.push(seasonResult);
    }

    if (seasonResults.length > 0) {
      const currentSeasonFolderPaths = seasonResults.map(
        (season) => season.season.seasonFolderPath
      );
      const rootState: FolderScanStateUpsert = {
        folderPath,
        folderType: "series",
        parentFolderPath: null,
        dirMtimeMs,
        fingerprint: createSeriesFingerprint(currentSeasonFolderPaths),
        lastSeenAt: now,
        lastScannedAt: now,
      };
      const rootChanged =
        !previousState ||
        previousState.folderType !== "series" ||
        previousState.fingerprint !== rootState.fingerprint;
      if (rootChanged) {
        stats.foldersChanged += 1;
      }

      return {
        kind: "series",
        movies: [],
        seasons: seasonResults.filter((s) => s.changed).map((s) => s.season),
        currentMovieFolderPaths: [],
        currentSeasonFolderPaths,
        scanStates: [rootState, ...seasonResults.map((s) => s.state)],
        scanEntries: seasonResults.flatMap((s) => s.entries),
      };
    }

    stats.foldersRescanned += 1;
    const movieResult = await scanMovieFolderDeep(
      folderPath,
      folderName,
      dirMtimeMs,
      now,
      previousState,
      fsr
    );
    if (movieResult.changed) {
      stats.foldersChanged += 1;
    }
    return {
      kind: "movie",
      movies: movieResult.changed ? [movieResult.movie] : [],
      seasons: [],
      currentMovieFolderPaths: [folderPath],
      currentSeasonFolderPaths: [],
      scanStates: [movieResult.state],
      scanEntries: movieResult.entries,
    };
  } catch {
    stats.foldersRescanned += 1;
    const movie: ScannedMovie = {
      folderPath,
      titleRaw: folderName,
      filePath: "",
      fileSizeBytes: 0,
      errorMessage: "Failed to read folder.",
    };
    const state: FolderScanStateUpsert = {
      folderPath,
      folderType: "movie",
      parentFolderPath: null,
      dirMtimeMs,
      fingerprint: createMovieFingerprint(null, movie.errorMessage),
      lastSeenAt: now,
      lastScannedAt: now,
    };
    const changed =
      !previousState ||
      previousState.folderType !== "movie" ||
      previousState.fingerprint !== state.fingerprint;
    if (changed) {
      stats.foldersChanged += 1;
    }
    return {
      kind: "movie",
      movies: changed ? [movie] : [],
      seasons: [],
      currentMovieFolderPaths: [folderPath],
      currentSeasonFolderPaths: [],
      scanStates: [state],
      scanEntries: [],
    };
  }
}
