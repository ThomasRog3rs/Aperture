import path from "node:path";
import { parseEpisodeFromFilename } from "@/lib/parseSeasonEpisode";
import type { FolderScanStateRow, FolderScanEntryUpsert } from "@/lib/storage";
import { createSeasonFingerprint } from "./fingerprint";
import { dedupeEpisodes } from "./deduplication";
import { listVideoFiles, type FileSystemReader } from "./filesystem";
import type { DeepSeasonScan, ScannedEpisode } from "./types";

export async function scanSeasonFolderDeep(
  seasonFolderPath: string,
  seriesFolderPath: string,
  seasonNumber: number | null,
  titleRaw: string,
  dirMtimeMs: number,
  now: number,
  previousState: FolderScanStateRow | undefined,
  fsr: FileSystemReader
): Promise<DeepSeasonScan> {
  const videos = await listVideoFiles(seasonFolderPath, fsr);

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

  const trackedEntriesSource: FolderScanEntryUpsert[] =
    dedupedEpisodes.length > 0
      ? dedupedEpisodes.map((episode) => {
          const video = videoByPath.get(episode.filePath);
          return {
            folderPath: seasonFolderPath,
            entryPath: episode.filePath,
            sizeBytes: episode.fileSizeBytes,
            mtimeMs: video?.mtimeMs ?? 0,
          };
        })
      : videos.map((video) => ({
          folderPath: seasonFolderPath,
          entryPath: video.filePath,
          sizeBytes: video.size,
          mtimeMs: video.mtimeMs,
        }));

  const entries = trackedEntriesSource.sort((a, b) => a.entryPath.localeCompare(b.entryPath));
  const state = {
    folderPath: seasonFolderPath,
    folderType: "season" as const,
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
