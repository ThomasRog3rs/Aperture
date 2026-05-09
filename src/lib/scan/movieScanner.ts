import type { FolderScanStateRow, FolderScanEntryUpsert } from "@/lib/storage";
import { createMovieFingerprint } from "./fingerprint";
import { listVideoFiles, type FileSystemReader } from "./filesystem";
import type { DeepMovieScan, ScannedMovie, VideoFile } from "./types";

export async function scanMovieFolderDeep(
  folderPath: string,
  titleRaw: string,
  dirMtimeMs: number,
  now: number,
  previousState: FolderScanStateRow | undefined,
  fsr: FileSystemReader
): Promise<DeepMovieScan> {
  const videos = await listVideoFiles(folderPath, fsr);

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

  const entries: FolderScanEntryUpsert[] = largest
    ? [
        {
          folderPath,
          entryPath: largest.filePath,
          sizeBytes: largest.size,
          mtimeMs: largest.mtimeMs,
        },
      ]
    : [];

  const state = {
    folderPath,
    folderType: "movie" as const,
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
