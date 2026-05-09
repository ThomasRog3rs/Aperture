import type {
  VideoPlayerEpisodeListSeason,
  VideoPlayerEpisodeTarget,
} from "@/components/VideoPlayer";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";
import type {
  FolderImage,
  RandomSessionAction,
  SeriesNotice,
} from "./series-detail.types";

export type OrderedEpisode = {
  season: SeasonWithEpisodes;
  episode: Episode;
  target: VideoPlayerEpisodeTarget;
};

export type ActiveEpisodeState = {
  activeEpisodeIndex: number;
  activeEpisodeItem: OrderedEpisode | null;
  activeEpisode: Episode | null;
  previousEpisodeItem: OrderedEpisode | null;
  nextEpisodeItem: OrderedEpisode | null;
};

export type SeriesCastCrew = {
  directors: string[];
  writers: string[];
  actors: string[];
};

export function getEpisodeDisplayTitle(episode: Episode): string {
  return episode.titleClean || episode.titleRaw;
}

export function getEpisodePlayerTitle(episode: Episode): string {
  return (
    (episode.episodeNumber != null ? `Episode ${episode.episodeNumber} — ` : "") +
    getEpisodeDisplayTitle(episode)
  );
}

export function getSeasonLabel(season: SeasonWithEpisodes): string {
  return season.seasonNumber != null ? `Season ${season.seasonNumber}` : "Season";
}

export function getEpisodeNumberLabel(episode: Episode): string {
  return episode.episodeNumber != null ? String(episode.episodeNumber) : "—";
}

export function getEpisodeNavigationTarget(
  season: SeasonWithEpisodes,
  episode: Episode
): VideoPlayerEpisodeTarget {
  const episodeLabel =
    episode.episodeNumber != null ? `Episode ${episode.episodeNumber}` : "Episode";

  return {
    id: episode.id,
    title: getEpisodeDisplayTitle(episode),
    subtitle: `${getSeasonLabel(season)} • ${episodeLabel}`,
  };
}

export function buildOrderedEpisodes(seasons: SeasonWithEpisodes[]): OrderedEpisode[] {
  return seasons.flatMap((season) =>
    season.episodes.map((episode) => ({
      season,
      episode,
      target: getEpisodeNavigationTarget(season, episode),
    }))
  );
}

export function findActiveEpisodeState(
  orderedEpisodes: OrderedEpisode[],
  activeEpisodeId: string | null
): ActiveEpisodeState {
  const activeEpisodeIndex = activeEpisodeId
    ? orderedEpisodes.findIndex(({ episode }) => episode.id === activeEpisodeId)
    : -1;
  const activeEpisodeItem =
    activeEpisodeIndex >= 0 ? orderedEpisodes[activeEpisodeIndex] : null;

  return {
    activeEpisodeIndex,
    activeEpisodeItem,
    activeEpisode: activeEpisodeItem?.episode ?? null,
    previousEpisodeItem:
      activeEpisodeIndex > 0 ? orderedEpisodes[activeEpisodeIndex - 1] : null,
    nextEpisodeItem:
      activeEpisodeIndex >= 0 && activeEpisodeIndex < orderedEpisodes.length - 1
        ? orderedEpisodes[activeEpisodeIndex + 1]
        : null,
  };
}

export function buildEpisodeSelectorSeasons(
  seasons: SeasonWithEpisodes[],
  activeEpisodeId: string | null
): VideoPlayerEpisodeListSeason[] {
  return seasons.map((season) => {
    const sectionTitle = getSeasonLabel(season);

    return {
      id: season.id,
      title: sectionTitle,
      subtitle:
        season.titleClean && season.titleClean !== sectionTitle
          ? season.titleClean
          : undefined,
      episodes: season.episodes.map((episode) => {
        const target = getEpisodeNavigationTarget(season, episode);

        return {
          ...target,
          numberLabel: getEpisodeNumberLabel(episode),
          watched: episode.watched,
          isCurrent: episode.id === activeEpisodeId,
        };
      }),
    };
  });
}

export function getContinueEpisode(orderedEpisodes: OrderedEpisode[]): Episode | null {
  const firstUnwatched = orderedEpisodes.find(({ episode }) => !episode.watched);
  return (firstUnwatched ?? orderedEpisodes[0])?.episode ?? null;
}

export function getAllWatched(orderedEpisodes: OrderedEpisode[]): boolean {
  return (
    orderedEpisodes.length > 0 && orderedEpisodes.every(({ episode }) => episode.watched)
  );
}

export function getSeasonSummary(series: Series | null): string {
  if (!series) return "";
  return `${series.seasonCount} ${series.seasonCount === 1 ? "season" : "seasons"}`;
}

export function getSeriesRating(seasons: SeasonWithEpisodes[]): number | null {
  if (seasons.length === 0) return null;

  const ratings = seasons
    .map((season) => season.tmdbRating)
    .filter((value): value is number => typeof value === "number");

  if (ratings.length === 0) return null;
  return Math.max(...ratings);
}

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, string>();

  names.forEach((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.set(key, trimmed);
  });

  return Array.from(seen.values());
}

export function getCastCrew(seasons: SeasonWithEpisodes[]): SeriesCastCrew {
  return {
    directors: uniqueNames(seasons.flatMap((season) => season.directors ?? [])),
    writers: uniqueNames(seasons.flatMap((season) => season.writers ?? [])),
    actors: uniqueNames(seasons.flatMap((season) => season.actors ?? [])),
  };
}

export function getPosterPreview(
  posterInput: string,
  series: Series | null
): string | null {
  const trimmedPoster = posterInput.trim();
  return trimmedPoster.length > 0 ? trimmedPoster : series?.posterPath ?? null;
}

export function getHasMissingBasicInfo(
  series: Series | null,
  seriesRating: number | null
): boolean {
  return Boolean(series && (!seriesRating || !series.seasons?.[0]?.year));
}

export function getInitialSelectedFolderImage(
  folderImages: FolderImage[],
  currentPoster: string | null
): string {
  const matched = folderImages.find((image) => image.url === (currentPoster ?? ""));
  return matched?.url ?? folderImages[0]?.url ?? "";
}

export function getMatchingFolderImageUrl(
  folderImages: FolderImage[],
  posterInput: string
): string | null {
  const trimmed = posterInput.trim();
  if (!trimmed) return null;

  return folderImages.find((image) => image.url === trimmed)?.url ?? null;
}

export function updateEpisodeInSeasons(
  seasons: SeasonWithEpisodes[],
  episodeId: string,
  updates: Partial<Episode>
): SeasonWithEpisodes[] {
  return seasons.map((season) => {
    let didUpdate = false;

    const episodes = season.episodes.map((episode) => {
      if (episode.id !== episodeId) return episode;
      didUpdate = true;
      return { ...episode, ...updates };
    });

    return didUpdate ? { ...season, episodes } : season;
  });
}

export function buildEpisodeProgressUpdate(
  currentTime: number,
  duration: number
): Partial<Episode> {
  const roundedTime = Math.round(currentTime);
  const isWatched = duration > 0 && currentTime / duration >= 0.9;

  return {
    watchProgressSeconds: roundedTime,
    ...(isWatched ? { watched: true } : {}),
  };
}

export function buildEpisodeEndedUpdate(
  currentTime: number,
  duration: number
): { completedTime: number; updates: Partial<Episode> } {
  const completedTime = duration > 0 ? duration : currentTime;

  return {
    completedTime,
    updates: {
      watchProgressSeconds: Math.round(completedTime),
      watched: true,
    },
  };
}

export function getRandomSessionExhaustedNotice(
  action: Extract<RandomSessionAction, "start_new" | "continue" | "next_random">
): SeriesNotice {
  return {
    tone: "info",
    message:
      action === "start_new"
        ? "This series has no remaining episodes for a random session."
        : "This random session is complete. Start a new one to keep going.",
  };
}
