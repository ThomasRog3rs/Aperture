import type { Movie } from "@/lib/types";
import {
  buildTitlePosterEditUpdates,
  formatTimestamp as formatSharedTimestamp,
  getPosterCandidate as getSharedPosterCandidate,
} from "@/features/shared/detail-primitives";

export function formatTimestamp(value: number | null) {
  return formatSharedTimestamp(value);
}

export function dedupeGenres(genres: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const genre of genres) {
    const trimmed = genre.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function getPosterCandidate(posterInput: string, movie: Movie | null) {
  return getSharedPosterCandidate(posterInput, movie?.posterPath);
}

export function hasMissingBasicMovieInfo(movie: Movie | null) {
  if (!movie) return false;
  return !movie.tmdbRating || !movie.runtimeMinutes || !movie.year;
}

export function buildMovieEditUpdates(movie: Movie, title: string, posterInput: string) {
  return buildTitlePosterEditUpdates(movie.titleClean, movie.posterPath, title, posterInput);
}
