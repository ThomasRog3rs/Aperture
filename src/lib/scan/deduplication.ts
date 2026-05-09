import type { ScannedEpisode } from "./types";

export function dedupeEpisodes(episodes: ScannedEpisode[]): ScannedEpisode[] {
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
