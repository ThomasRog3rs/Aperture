import fs from "node:fs/promises";
import path from "node:path";
import type { Stats, Dirent } from "node:fs";
import type { FolderScanEntryRow } from "@/lib/storage";
import type { VideoFile } from "./types";

export const VIDEO_EXTENSIONS = new Set([
  ".mkv",
  ".mp4",
  ".m4v",
  ".mov",
  ".avi",
  ".wmv",
  ".mpg",
  ".mpeg",
  ".ts",
]);

export interface FileSystemReader {
  stat(filePath: string): Promise<Stats | null>;
  readdir(dirPath: string): Promise<Dirent[]>;
}

export class NodeFileSystemReader implements FileSystemReader {
  async stat(filePath: string): Promise<Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  async readdir(dirPath: string): Promise<Dirent[]> {
    return fs.readdir(dirPath, { withFileTypes: true });
  }
}

export async function listVideoFiles(
  folderPath: string,
  fsr: FileSystemReader
): Promise<VideoFile[]> {
  const entries = await fsr.readdir(folderPath);
  const videos = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return null;
      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) return null;
      const filePath = path.join(folderPath, entry.name);
      const stat = await fsr.stat(filePath);
      if (!stat) return null;
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

export async function haveTrackedEntriesChanged(
  entries: FolderScanEntryRow[],
  fsr: FileSystemReader
): Promise<boolean> {
  for (const entry of entries) {
    const stat = await fsr.stat(entry.entryPath);
    if (!stat || stat.size !== entry.sizeBytes || stat.mtimeMs !== entry.mtimeMs) {
      return true;
    }
  }
  return false;
}
