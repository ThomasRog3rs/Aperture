import fs from "node:fs/promises";
import path from "node:path";
import {
  parseEpisodeFromFilename,
  parseSeasonNumberFromFolder,
} from "@/lib/parseSeasonEpisode";

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

async function listVideoFiles(folderPath: string) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const videos = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return null;
      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) return null;
      const filePath = path.join(folderPath, entry.name);
      const stat = await fs.stat(filePath);
      return { filePath, size: stat.size, name: entry.name };
    })
  );
  return videos.filter(Boolean) as Array<{
    filePath: string;
    size: number;
    name: string;
  }>;
}

export async function scanLibrary(
  libraryRootPath: string
): Promise<{ movies: ScannedMovie[]; seasons: ScannedSeason[] }> {
  const entries = await fs.readdir(libraryRootPath, { withFileTypes: true });
  const folderEntries = entries.filter((entry) => entry.isDirectory());

  const movies: ScannedMovie[] = [];
  const seasons: ScannedSeason[] = [];

  for (const folder of folderEntries) {
    const folderPath = path.join(libraryRootPath, folder.name);
    let folderEntriesInner;
    try {
      folderEntriesInner = await fs.readdir(folderPath, { withFileTypes: true });
    } catch {
      movies.push({
        folderPath,
        titleRaw: folder.name,
        filePath: "",
        fileSizeBytes: 0,
        errorMessage: "Failed to read folder.",
      });
      continue;
    }

    const subFolders = folderEntriesInner.filter((entry) => entry.isDirectory());
    const seasonCandidates = await Promise.all(
      subFolders.map(async (subFolder) => {
        const seasonNumber = parseSeasonNumberFromFolder(subFolder.name);
        if (seasonNumber === null) return null;
        const seasonFolderPath = path.join(folderPath, subFolder.name);
        const videos = await listVideoFiles(seasonFolderPath);
        if (videos.length === 0) return null;
        return {
          seasonFolderPath,
          seasonNumber,
          folderName: subFolder.name,
          videos,
        };
      })
    );
    const validSeasons = seasonCandidates.filter(Boolean) as Array<{
      seasonFolderPath: string;
      seasonNumber: number | null;
      folderName: string;
      videos: Array<{ filePath: string; size: number; name: string }>;
    }>;

    if (validSeasons.length > 0) {
      for (const season of validSeasons) {
        const parsedEpisodes = season.videos
          .map((video) => {
            const parsed = parseEpisodeFromFilename(
              video.name,
              season.seasonNumber
            );
            if (parsed.episodeNumber === null) return null;
            return {
              filePath: video.filePath,
              fileSizeBytes: video.size,
              episodeNumber: parsed.episodeNumber,
              titleRaw: video.name,
              titleClean:
                parsed.titleClean ||
                path.parse(video.name).name ||
                video.name,
            };
          })
          .filter(Boolean) as ScannedEpisode[];

        const dedupedEpisodes = dedupeEpisodes(parsedEpisodes);

        seasons.push({
          seasonFolderPath: season.seasonFolderPath,
          seriesFolderPath: folderPath,
          seasonNumber: season.seasonNumber,
          titleRaw: season.folderName,
          episodes: dedupedEpisodes,
          errorMessage:
            dedupedEpisodes.length === 0
              ? "No parseable episodes found in season."
              : null,
        });
      }
      continue;
    }

    const largest = await findLargestVideoFile(folderPath);
    if (!largest) {
      movies.push({
        folderPath,
        titleRaw: folder.name,
        filePath: "",
        fileSizeBytes: 0,
        errorMessage: "No video file found in folder.",
      });
      continue;
    }
    movies.push({
      folderPath,
      titleRaw: folder.name,
      filePath: largest.filePath,
      fileSizeBytes: largest.size,
      errorMessage: null,
    });
  }

  return { movies, seasons };
}

