import type {
  Episode,
  SeasonWithEpisodes,
  Series,
} from "@/lib/types";
import {
  buildTitlePosterEditUpdates,
  formatTimestamp as formatSharedTimestamp,
  getPosterCandidate as getSharedPosterCandidate,
} from "@/features/shared/detail-primitives";

export type EpisodeNavigationTarget = {
  id: string;
  title: string;
  subtitle: string;
};

export type OrderedEpisode = {
  season: SeasonWithEpisodes;
  episode: Episode;
  target: EpisodeNavigationTarget;
};

type CastCrew = {
  directors: string[];
  writers: string[];
  actors: string[];
};

export function formatTimestamp(value: number | null) {
  return formatSharedTimestamp(value);
}

export function buildSeriesEditUpdates(
  series: Series,
  title: string,
  posterInput: string
) {
  return buildTitlePosterEditUpdates(series.titleClean, series.posterPath, title, posterInput);
}

export function getPosterCandidate(posterInput: string, series: Series | null) {
  return getSharedPosterCandidate(posterInput, series?.posterPath);
}

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
): EpisodeNavigationTarget {
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

export function getContinueEpisode(orderedEpisodes: OrderedEpisode[]) {
  const firstUnwatched = orderedEpisodes.find(({ episode }) => !episode.watched);
  return (firstUnwatched ?? orderedEpisodes[0])?.episode ?? null;
}

export function areAllEpisodesWatched(orderedEpisodes: OrderedEpisode[]) {
  return (
    orderedEpisodes.length > 0 &&
    orderedEpisodes.every(({ episode }) => episode.watched)
  );
}

export function getSeasonSummary(series: Series | null) {
  if (!series) return "";
  return `${series.seasonCount} ${series.seasonCount === 1 ? "season" : "seasons"}`;
}

export function getSeriesRating(seasons: SeasonWithEpisodes[]) {
  if (seasons.length === 0) return null;
  const ratings = seasons
    .map((season) => season.tmdbRating)
    .filter((value): value is number => typeof value === "number");
  if (ratings.length === 0) return null;
  return Math.max(...ratings);
}

function dedupeNames(names: string[]) {
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

export function getSeriesCastCrew(seasons: SeasonWithEpisodes[]): CastCrew {
  return {
    directors: dedupeNames(seasons.flatMap((season) => season.directors ?? [])),
    writers: dedupeNames(seasons.flatMap((season) => season.writers ?? [])),
    actors: dedupeNames(seasons.flatMap((season) => season.actors ?? [])),
  };
}

export function hasMissingBasicSeriesInfo(series: Series | null, seasons: SeasonWithEpisodes[]) {
  if (!series) return false;
  if (seasons.length === 0) return true;
  const hasRating = seasons.some((season) => typeof season.tmdbRating === "number");
  const hasYear = seasons.some((season) => typeof season.year === "number");
  return !hasRating || !hasYear;
}
