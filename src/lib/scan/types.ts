import type { FolderScanEntryUpsert, FolderScanStateUpsert } from "@/lib/storage";

export type ScannedMovie = {
  folderPath: string;
  titleRaw: string;
  filePath: string;
  fileSizeBytes: number;
  errorMessage: string | null;
};

export type ScannedEpisode = {
  filePath: string;
  fileSizeBytes: number;
  episodeNumber: number | null;
  titleRaw: string;
  titleClean: string;
};

export type ScannedSeason = {
  seasonFolderPath: string;
  seriesFolderPath: string;
  seasonNumber: number | null;
  titleRaw: string;
  episodes: ScannedEpisode[];
  errorMessage: string | null;
};

export type IncrementalScanResult = {
  movies: ScannedMovie[];
  seasons: ScannedSeason[];
  currentMovieFolderPaths: string[];
  currentSeasonFolderPaths: string[];
  scanStates: FolderScanStateUpsert[];
  scanEntries: FolderScanEntryUpsert[];
  stats: IncrementalStats;
};

export type VideoFile = {
  filePath: string;
  size: number;
  mtimeMs: number;
  name: string;
};

export type DeepMovieScan = {
  movie: ScannedMovie;
  state: FolderScanStateUpsert;
  entries: FolderScanEntryUpsert[];
  changed: boolean;
};

export type DeepSeasonScan = {
  season: ScannedSeason;
  state: FolderScanStateUpsert;
  entries: FolderScanEntryUpsert[];
  changed: boolean;
  hasVideos: boolean;
};

export type IncrementalStats = {
  rootFoldersChecked: number;
  seasonFoldersChecked: number;
  foldersChanged: number;
  foldersRescanned: number;
};

export type CachedState = {
  stateByPath: Map<string, import("@/lib/storage").FolderScanStateRow>;
  childStatesByParent: Map<string, import("@/lib/storage").FolderScanStateRow[]>;
  entriesByFolderPath: Map<string, import("@/lib/storage").FolderScanEntryRow[]>;
};
