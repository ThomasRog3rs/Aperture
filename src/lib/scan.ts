import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  parseEpisodeFromFilename,
  parseSeasonNumberFromFolder,
} from "@/lib/parseSeasonEpisode";
import type {
  FolderScanEntryRow,
  FolderScanEntryUpsert,
  FolderScanStateRow,
  FolderScanStateUpsert,
} from "@/lib/storage";

const VIDEO_EXTENSIONS = new Set([
  ".mkv",
  ".mp4",
  ".m4v",
  ".mov",
  ".avi",
  ".wmv",
  ".mpg",
  ".mpeg",
]);

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

type CachedState = {
  stateByPath: Map<string, FolderScanStateRow>;
  childStatesByParent: Map<string, FolderScanStateRow[]>;
  entriesByFolderPath: Map<string, FolderScanEntryRow[]>;
};

type VideoFile = {
  filePath: string;
  size: number;
  mtimeMs: number;
  name: string;
};

type DeepMovieScan = {
  movie: ScannedMovie;
  state: FolderScanStateUpsert;
  entries: FolderScanEntryUpsert[];
  changed: boolean;
};

type DeepSeasonScan = {
  season: ScannedSeason;
  state: FolderScanStateUpsert;
  entries: FolderScanEntryUpsert[];
  changed: boolean;
  hasVideos: boolean;
};

type IncrementalStats = {
  rootFoldersChecked: number;
  seasonFoldersChecked: number;
  foldersChanged: number;
  foldersRescanned: number;
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

function dedupeEpisodes(episodes: ScannedEpisode[]) {
  const bestByNumber = new Map<number, ScannedEpisode>();
  for (const episode of episodes) {
    if (episode.episodeNumber === null) continue;
    const existing = bestByNumber.get(episode.episodeNumber);
    if (!existing || episode.fileSizeBytes > existing.fileSizeBytes) {
      bestByNumber.set(episode.episodeNumber, episode);
    }
  }
  return Array.from(bestByNumber.values()).sort((a, b) => {
    if (a.episodeNumber === null && b.episodeNumber !== null) return 1;
    if (a.episodeNumber !== null && b.episodeNumber === null) return -1;
    if (a.episodeNumber === null || b.episodeNumber === null) return 0;
    return a.episodeNumber - b.episodeNumber;
  });
}

function hashFingerprint(value: unknown) {
  return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function buildCachedState(
  previousStates: FolderScanStateRow[],
  previousEntries: FolderScanEntryRow[]
): CachedState {
  const stateByPath = new Map(previousStates.map((state) => [state.folderPath, state]));
  const childStatesByParent = new Map<string, FolderScanStateRow[]>();
  for (const state of previousStates) {
    if (!state.parentFolderPath) continue;
    const existing = childStatesByParent.get(state.parentFolderPath) ?? [];
    existing.push(state);
    childStatesByParent.set(state.parentFolderPath, existing);
  }

  const entriesByFolderPath = new Map<string, FolderScanEntryRow[]>();
  for (const entry of previousEntries) {
    const existing = entriesByFolderPath.get(entry.folderPath) ?? [];
    existing.push(entry);
    entriesByFolderPath.set(entry.folderPath, existing);
  }

  return { stateByPath, childStatesByParent, entriesByFolderPath };
}

async function safeStat(targetPath: string) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

async function listVideoFiles(folderPath: string) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const videos = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return null;
      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) return null;
      const filePath = path.join(folderPath, entry.name);
      const stat = await fs.stat(filePath);
      return {
        filePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        name: entry.name,
      } satisfies VideoFile;
    })
  );
  return videos.filter(Boolean) as VideoFile[];
}

function createMovieFingerprint(largest: VideoFile | null, errorMessage: string | null) {
  return hashFingerprint({
    kind: "movie",
    file:
      largest === null
        ? null
        : {
            filePath: largest.filePath,
            size: largest.size,
            mtimeMs: largest.mtimeMs,
          },
    errorMessage,
  });
}

function createSeriesFingerprint(seasonFolderPaths: string[]) {
  return hashFingerprint({
    kind: "series",
    seasonFolderPaths: [...seasonFolderPaths].sort(),
  });
}

function createSeasonFingerprint(
  trackedEntries: FolderScanEntryUpsert[],
  errorMessage: string | null
) {
  return hashFingerprint({
    kind: "season",
    entries: trackedEntries.map((entry) => ({
      entryPath: entry.entryPath,
      sizeBytes: entry.sizeBytes,
      mtimeMs: entry.mtimeMs,
    })),
    errorMessage,
  });
}

function restoreSeenState(
  previousState: FolderScanStateRow,
  now: number,
  overrides?: Partial<FolderScanStateUpsert>
): FolderScanStateUpsert {
  return {
    folderPath: previousState.folderPath,
    folderType: previousState.folderType,
    parentFolderPath: previousState.parentFolderPath,
    dirMtimeMs: previousState.dirMtimeMs,
    fingerprint: previousState.fingerprint,
    lastSeenAt: now,
    lastScannedAt: previousState.lastScannedAt,
    ...overrides,
  };
}

async function haveTrackedEntriesChanged(entries: FolderScanEntryRow[]) {
  for (const entry of entries) {
    const stat = await safeStat(entry.entryPath);
    if (!stat || stat.size !== entry.sizeBytes || stat.mtimeMs !== entry.mtimeMs) {
      return true;
    }
  }
  return false;
}

async function scanMovieFolderDeep(
  folderPath: string,
  titleRaw: string,
  dirMtimeMs: number,
  now: number,
  previousState: FolderScanStateRow | undefined
): Promise<DeepMovieScan> {
  const videos = await listVideoFiles(folderPath);
  const largest = videos.reduce<VideoFile | null>((best, video) => {
    if (!best || video.size > best.size) return video;
    return best;
  }, null);

  const errorMessage = largest ? null : "No video file found in folder.";
  const movie: ScannedMovie = {
    folderPath,
    titleRaw,
    filePath: largest?.filePath ?? "",
    fileSizeBytes: largest?.size ?? 0,
    errorMessage,
  };
  const entries = largest
    ? [
        {
          folderPath,
          entryPath: largest.filePath,
          sizeBytes: largest.size,
          mtimeMs: largest.mtimeMs,
        },
      ]
    : [];
  const state: FolderScanStateUpsert = {
    folderPath,
    folderType: "movie",
    parentFolderPath: null,
    dirMtimeMs,
    fingerprint: createMovieFingerprint(largest, errorMessage),
    lastSeenAt: now,
    lastScannedAt: now,
  };

  return {
    movie,
    state,
    entries,
    changed:
      !previousState ||
      previousState.folderType !== "movie" ||
      previousState.fingerprint !== state.fingerprint,
  };
}

async function scanSeasonFolderDeep(
  seasonFolderPath: string,
  seriesFolderPath: string,
  seasonNumber: number | null,
  titleRaw: string,
  dirMtimeMs: number,
  now: number,
  previousState: FolderScanStateRow | undefined
): Promise<DeepSeasonScan> {
  const videos = await listVideoFiles(seasonFolderPath);
  if (videos.length === 0) {
    return {
      season: {
        seasonFolderPath,
        seriesFolderPath,
        seasonNumber,
        titleRaw,
        episodes: [],
        errorMessage: "No parseable episodes found in season.",
      },
      state: {
        folderPath: seasonFolderPath,
        folderType: "season",
        parentFolderPath: seriesFolderPath,
        dirMtimeMs,
        fingerprint: createSeasonFingerprint([], "No video files found in season."),
        lastSeenAt: now,
        lastScannedAt: now,
      },
      entries: [],
      changed: true,
      hasVideos: false,
    };
  }

  const videoByPath = new Map(videos.map((video) => [video.filePath, video]));
  const parsedEpisodes = videos
    .map((video) => {
      const parsed = parseEpisodeFromFilename(video.name, seasonNumber);
      if (parsed.episodeNumber === null) return null;
      return {
        filePath: video.filePath,
        fileSizeBytes: video.size,
        episodeNumber: parsed.episodeNumber,
        titleRaw: video.name,
        titleClean: parsed.titleClean || path.parse(video.name).name || video.name,
      } satisfies ScannedEpisode;
    })
    .filter(Boolean) as ScannedEpisode[];

  const dedupedEpisodes = dedupeEpisodes(parsedEpisodes);
  const errorMessage =
    dedupedEpisodes.length === 0 ? "No parseable episodes found in season." : null;
  const trackedEntriesSource =
    dedupedEpisodes.length > 0
      ? dedupedEpisodes.map((episode) => {
          const video = videoByPath.get(episode.filePath);
          return {
            folderPath: seasonFolderPath,
            entryPath: episode.filePath,
            sizeBytes: episode.fileSizeBytes,
            mtimeMs: video?.mtimeMs ?? 0,
          } satisfies FolderScanEntryUpsert;
        })
      : videos.map((video) => ({
          folderPath: seasonFolderPath,
          entryPath: video.filePath,
          sizeBytes: video.size,
          mtimeMs: video.mtimeMs,
        }));

  const entries = trackedEntriesSource.sort((a, b) => a.entryPath.localeCompare(b.entryPath));
  const state: FolderScanStateUpsert = {
    folderPath: seasonFolderPath,
    folderType: "season",
    parentFolderPath: seriesFolderPath,
    dirMtimeMs,
    fingerprint: createSeasonFingerprint(entries, errorMessage),
    lastSeenAt: now,
    lastScannedAt: now,
  };

  return {
    season: {
      seasonFolderPath,
      seriesFolderPath,
      seasonNumber,
      titleRaw,
      episodes: dedupedEpisodes,
      errorMessage,
    },
    state,
    entries,
    changed:
      !previousState ||
      previousState.folderType !== "season" ||
      previousState.fingerprint !== state.fingerprint,
    hasVideos: true,
  };
}

async function deepScanTopLevelFolder(
  folderPath: string,
  folderName: string,
  dirMtimeMs: number,
  now: number,
  previousState: FolderScanStateRow | undefined,
  previousSeasonStatesByPath: Map<string, FolderScanStateRow>,
  stats: IncrementalStats
) {
  try {
    const folderEntries = await fs.readdir(folderPath, { withFileTypes: true });
    const seasonResults: DeepSeasonScan[] = [];

    for (const entry of folderEntries) {
      if (!entry.isDirectory()) continue;
      const seasonNumber = parseSeasonNumberFromFolder(entry.name);
      if (seasonNumber === null) continue;
      const seasonFolderPath = path.join(folderPath, entry.name);
      const seasonStat = await fs.stat(seasonFolderPath);
      stats.seasonFoldersChecked += 1;
      stats.foldersRescanned += 1;
      const seasonResult = await scanSeasonFolderDeep(
        seasonFolderPath,
        folderPath,
        seasonNumber,
        entry.name,
        seasonStat.mtimeMs,
        now,
        previousSeasonStatesByPath.get(seasonFolderPath)
      );
      if (!seasonResult.hasVideos) continue;
      if (seasonResult.changed) {
        stats.foldersChanged += 1;
      }
      seasonResults.push(seasonResult);
    }

    if (seasonResults.length > 0) {
      const currentSeasonFolderPaths = seasonResults.map((season) => season.season.seasonFolderPath);
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
        kind: "series" as const,
        movies: [] as ScannedMovie[],
        seasons: seasonResults.filter((season) => season.changed).map((season) => season.season),
        currentMovieFolderPaths: [] as string[],
        currentSeasonFolderPaths,
        scanStates: [rootState, ...seasonResults.map((season) => season.state)],
        scanEntries: seasonResults.flatMap((season) => season.entries),
      };
    }

    stats.foldersRescanned += 1;
    const movieResult = await scanMovieFolderDeep(
      folderPath,
      folderName,
      dirMtimeMs,
      now,
      previousState
    );
    if (movieResult.changed) {
      stats.foldersChanged += 1;
    }
    return {
      kind: "movie" as const,
      movies: movieResult.changed ? [movieResult.movie] : [],
      seasons: [] as ScannedSeason[],
      currentMovieFolderPaths: [folderPath],
      currentSeasonFolderPaths: [] as string[],
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
      kind: "movie" as const,
      movies: changed ? [movie] : [],
      seasons: [] as ScannedSeason[],
      currentMovieFolderPaths: [folderPath],
      currentSeasonFolderPaths: [] as string[],
      scanStates: [state],
      scanEntries: [] as FolderScanEntryUpsert[],
    };
  }
}

export async function scanLibraryIncremental(
  libraryRootPath: string,
  previousStates: FolderScanStateRow[],
  previousEntries: FolderScanEntryRow[]
): Promise<IncrementalScanResult> {
  const now = Date.now();
  const cache = buildCachedState(previousStates, previousEntries);
  const entries = await fs.readdir(libraryRootPath, { withFileTypes: true });
  const folderEntries = entries
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
    const folderStat = await fs.stat(folderPath);
    stats.rootFoldersChecked += 1;

    if (previousRootState?.folderType === "movie") {
      const previousTrackedEntries = cache.entriesByFolderPath.get(folderPath) ?? [];
      const folderChanged =
        folderStat.mtimeMs !== previousRootState.dirMtimeMs ||
        (await haveTrackedEntriesChanged(previousTrackedEntries));
      if (!folderChanged) {
        currentMovieFolderPaths.push(folderPath);
        scanStates.push(
          restoreSeenState(previousRootState, now, { dirMtimeMs: folderStat.mtimeMs })
        );
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
        stats
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
      const previousSeasonStates = (
        cache.childStatesByParent.get(folderPath) ?? []
      ).filter((state) => state.folderType === "season");
      const previousSeasonStateByPath = new Map(
        previousSeasonStates.map((state) => [state.folderPath, state])
      );
      const rootDirChanged = folderStat.mtimeMs !== previousRootState.dirMtimeMs;
      let currentCandidateSeasonPaths: string[] | null = null;

      if (rootDirChanged) {
        const folderEntriesInner = await fs.readdir(folderPath, { withFileTypes: true });
        currentCandidateSeasonPaths = folderEntriesInner
          .filter((entry) => entry.isDirectory())
          .filter((entry) => parseSeasonNumberFromFolder(entry.name) !== null)
          .map((entry) => path.join(folderPath, entry.name));
      }

      const seasonPathsToCheck = currentCandidateSeasonPaths ?? previousSeasonStates.map((state) => state.folderPath);
      const keptSeasonPaths = new Set<string>();
      const seasonStatesForRoot: FolderScanStateUpsert[] = [];
      const seasonEntriesForRoot: FolderScanEntryUpsert[] = [];
      const changedSeasonsForRoot: ScannedSeason[] = [];

      for (const seasonFolderPath of seasonPathsToCheck.sort((a, b) => a.localeCompare(b))) {
        const previousSeasonState = previousSeasonStateByPath.get(seasonFolderPath);
        const seasonName = path.basename(seasonFolderPath);
        const seasonNumber = parseSeasonNumberFromFolder(seasonName);
        if (seasonNumber === null) continue;
        const seasonStat = await safeStat(seasonFolderPath);
        if (!seasonStat?.isDirectory()) {
          continue;
        }

        stats.seasonFoldersChecked += 1;
        const previousTrackedEntries = cache.entriesByFolderPath.get(seasonFolderPath) ?? [];
        const seasonChanged =
          !previousSeasonState ||
          seasonStat.mtimeMs !== previousSeasonState.dirMtimeMs ||
          (await haveTrackedEntriesChanged(previousTrackedEntries));

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
          previousSeasonState
        );
        if (!seasonResult.hasVideos) {
          continue;
        }
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
          stats
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
      stats
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
