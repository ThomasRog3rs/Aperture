import path from "node:path";
import { parseSeasonNumberFromFolder } from "@/lib/parseSeasonEpisode";
import type {
  FolderScanEntryRow,
  FolderScanStateRow,
  FolderScanEntryUpsert,
  FolderScanStateUpsert,
} from "@/lib/storage";
import { buildCachedState, restoreSeenState } from "./cache";
import { createSeriesFingerprint } from "./fingerprint";
import { NodeFileSystemReader, haveTrackedEntriesChanged } from "./filesystem";
import { deepScanTopLevelFolder } from "./folderClassifier";
import { scanSeasonFolderDeep } from "./seasonScanner";
import type {
  IncrementalScanResult,
  IncrementalStats,
  ScannedMovie,
  ScannedSeason,
} from "./types";

export type {
  ScannedMovie,
  ScannedEpisode,
  ScannedSeason,
  IncrementalScanResult,
} from "./types";

export async function scanLibraryIncremental(
  libraryRootPath: string,
  previousStates: FolderScanStateRow[],
  previousEntries: FolderScanEntryRow[]
): Promise<IncrementalScanResult> {
  const fsr = new NodeFileSystemReader();
  const now = Date.now();
  const cache = buildCachedState(previousStates, previousEntries);

  const topLevelDirents = await fsr.readdir(libraryRootPath);
  const folderEntries = topLevelDirents
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const movies: ScannedMovie[] = [];
  const seasons: ScannedSeason[] = [];
  const currentMovieFolderPaths: string[] = [];
  const currentSeasonFolderPaths: string[] = [];
  const scanStates: FolderScanStateUpsert[] = [];
  const scanEntries: FolderScanEntryUpsert[] = [];
  const stats: IncrementalStats = {
    rootFoldersChecked: 0,
    seasonFoldersChecked: 0,
    foldersChanged: 0,
    foldersRescanned: 0,
  };

  for (const folder of folderEntries) {
    const folderPath = path.join(libraryRootPath, folder.name);
    const previousRootState = cache.stateByPath.get(folderPath);
    const folderStat = await fsr.stat(folderPath);
    if (!folderStat) continue;
    stats.rootFoldersChecked += 1;

    if (previousRootState?.folderType === "movie") {
      const previousTrackedEntries = cache.entriesByFolderPath.get(folderPath) ?? [];
      const folderChanged =
        folderStat.mtimeMs !== previousRootState.dirMtimeMs ||
        (await haveTrackedEntriesChanged(previousTrackedEntries, fsr));

      if (!folderChanged) {
        currentMovieFolderPaths.push(folderPath);
        scanStates.push(restoreSeenState(previousRootState, now, { dirMtimeMs: folderStat.mtimeMs }));
        scanEntries.push(...previousTrackedEntries);
        continue;
      }

      stats.foldersRescanned += 1;
      const deepResult = await deepScanTopLevelFolder(
        folderPath,
        folder.name,
        folderStat.mtimeMs,
        now,
        previousRootState,
        new Map(),
        stats,
        fsr
      );
      movies.push(...deepResult.movies);
      seasons.push(...deepResult.seasons);
      currentMovieFolderPaths.push(...deepResult.currentMovieFolderPaths);
      currentSeasonFolderPaths.push(...deepResult.currentSeasonFolderPaths);
      scanStates.push(...deepResult.scanStates);
      scanEntries.push(...deepResult.scanEntries);
      continue;
    }

    if (previousRootState?.folderType === "series") {
      const previousSeasonStates = (cache.childStatesByParent.get(folderPath) ?? []).filter(
        (state) => state.folderType === "season"
      );
      const previousSeasonStateByPath = new Map(
        previousSeasonStates.map((state) => [state.folderPath, state])
      );
      const rootDirChanged = folderStat.mtimeMs !== previousRootState.dirMtimeMs;
      let currentCandidateSeasonPaths: string[] | null = null;

      if (rootDirChanged) {
        const innerDirents = await fsr.readdir(folderPath);
        currentCandidateSeasonPaths = innerDirents
          .filter((entry) => entry.isDirectory())
          .filter((entry) => parseSeasonNumberFromFolder(entry.name) !== null)
          .map((entry) => path.join(folderPath, entry.name));
      }

      const seasonPathsToCheck =
        currentCandidateSeasonPaths ?? previousSeasonStates.map((state) => state.folderPath);
      const keptSeasonPaths = new Set<string>();
      const seasonStatesForRoot: FolderScanStateUpsert[] = [];
      const seasonEntriesForRoot: FolderScanEntryUpsert[] = [];
      const changedSeasonsForRoot: ScannedSeason[] = [];

      for (const seasonFolderPath of seasonPathsToCheck.sort((a, b) => a.localeCompare(b))) {
        const previousSeasonState = previousSeasonStateByPath.get(seasonFolderPath);
        const seasonName = path.basename(seasonFolderPath);
        const seasonNumber = parseSeasonNumberFromFolder(seasonName);
        if (seasonNumber === null) continue;
        const seasonStat = await fsr.stat(seasonFolderPath);
        if (!seasonStat?.isDirectory()) continue;

        stats.seasonFoldersChecked += 1;
        const previousTrackedEntries = cache.entriesByFolderPath.get(seasonFolderPath) ?? [];
        const seasonChanged =
          !previousSeasonState ||
          seasonStat.mtimeMs !== previousSeasonState.dirMtimeMs ||
          (await haveTrackedEntriesChanged(previousTrackedEntries, fsr));

        if (!seasonChanged) {
          keptSeasonPaths.add(seasonFolderPath);
          seasonStatesForRoot.push(
            restoreSeenState(previousSeasonState, now, { dirMtimeMs: seasonStat.mtimeMs })
          );
          seasonEntriesForRoot.push(...previousTrackedEntries);
          continue;
        }

        stats.foldersRescanned += 1;
        const seasonResult = await scanSeasonFolderDeep(
          seasonFolderPath,
          folderPath,
          seasonNumber,
          seasonName,
          seasonStat.mtimeMs,
          now,
          previousSeasonState,
          fsr
        );
        if (!seasonResult.hasVideos) continue;
        keptSeasonPaths.add(seasonFolderPath);
        seasonStatesForRoot.push(seasonResult.state);
        seasonEntriesForRoot.push(...seasonResult.entries);
        if (seasonResult.changed) {
          stats.foldersChanged += 1;
          changedSeasonsForRoot.push(seasonResult.season);
        }
      }

      const activeSeasonPaths = [...keptSeasonPaths].sort();
      if (activeSeasonPaths.length === 0) {
        stats.foldersRescanned += 1;
        const deepResult = await deepScanTopLevelFolder(
          folderPath,
          folder.name,
          folderStat.mtimeMs,
          now,
          previousRootState,
          previousSeasonStateByPath,
          stats,
          fsr
        );
        movies.push(...deepResult.movies);
        seasons.push(...deepResult.seasons);
        currentMovieFolderPaths.push(...deepResult.currentMovieFolderPaths);
        currentSeasonFolderPaths.push(...deepResult.currentSeasonFolderPaths);
        scanStates.push(...deepResult.scanStates);
        scanEntries.push(...deepResult.scanEntries);
        continue;
      }

      const rootState: FolderScanStateUpsert = {
        folderPath,
        folderType: "series",
        parentFolderPath: null,
        dirMtimeMs: folderStat.mtimeMs,
        fingerprint: createSeriesFingerprint(activeSeasonPaths),
        lastSeenAt: now,
        lastScannedAt: rootDirChanged ? now : previousRootState.lastScannedAt,
      };
      if (previousRootState.fingerprint !== rootState.fingerprint) {
        stats.foldersChanged += 1;
      }

      seasons.push(...changedSeasonsForRoot);
      currentSeasonFolderPaths.push(...activeSeasonPaths);
      scanStates.push(rootState, ...seasonStatesForRoot);
      scanEntries.push(...seasonEntriesForRoot);
      continue;
    }

    stats.foldersRescanned += 1;
    const deepResult = await deepScanTopLevelFolder(
      folderPath,
      folder.name,
      folderStat.mtimeMs,
      now,
      previousRootState,
      new Map(),
      stats,
      fsr
    );
    movies.push(...deepResult.movies);
    seasons.push(...deepResult.seasons);
    currentMovieFolderPaths.push(...deepResult.currentMovieFolderPaths);
    currentSeasonFolderPaths.push(...deepResult.currentSeasonFolderPaths);
    scanStates.push(...deepResult.scanStates);
    scanEntries.push(...deepResult.scanEntries);
  }

  return {
    movies,
    seasons,
    currentMovieFolderPaths,
    currentSeasonFolderPaths,
    scanStates,
    scanEntries,
    stats,
  };
}
