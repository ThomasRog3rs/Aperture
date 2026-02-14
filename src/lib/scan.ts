import fs from "node:fs/promises";
import path from "node:path";

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

async function findLargestVideoFile(
  folderPath: string
): Promise<{ filePath: string; size: number } | null> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  let best: { filePath: string; size: number } | null = null;

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return;
      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) return;
      const filePath = path.join(folderPath, entry.name);
      const stat = await fs.stat(filePath);
      if (!best || stat.size > best.size) {
        best = { filePath, size: stat.size };
      }
    })
  );

  return best;
}

export async function scanLibrary(libraryRootPath: string): Promise<ScannedMovie[]> {
  const entries = await fs.readdir(libraryRootPath, { withFileTypes: true });
  const folderEntries = entries.filter((entry) => entry.isDirectory());

  const movies = await Promise.all(
    folderEntries.map(async (folder) => {
      const folderPath = path.join(libraryRootPath, folder.name);
      const largest = await findLargestVideoFile(folderPath);

      if (!largest) {
        return {
          folderPath,
          titleRaw: folder.name,
          filePath: "",
          fileSizeBytes: 0,
          errorMessage: "No video file found in folder.",
        };
      }

      return {
        folderPath,
        titleRaw: folder.name,
        filePath: largest.filePath,
        fileSizeBytes: largest.size,
        errorMessage: null,
      };
    })
  );

  return movies;
}

