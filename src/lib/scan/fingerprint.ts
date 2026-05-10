import crypto from "node:crypto";
import type { FolderScanEntryUpsert } from "@/lib/storage";
import type { VideoFile } from "./types";

function hashFingerprint(value: unknown): string {
  return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

export function createMovieFingerprint(
  largest: VideoFile | null,
  errorMessage: string | null
): string {
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

export function createSeriesFingerprint(seasonFolderPaths: string[]): string {
  return hashFingerprint({
    kind: "series",
    seasonFolderPaths: [...seasonFolderPaths].sort(),
  });
}

export function createSeasonFingerprint(
  trackedEntries: FolderScanEntryUpsert[],
  errorMessage: string | null
): string {
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
