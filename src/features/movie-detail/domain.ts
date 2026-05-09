import type { Movie } from "@/lib/types";

export function formatTimestamp(value: number | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
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
  const trimmed = posterInput.trim();
  return trimmed || movie?.posterPath || null;
}

export function hasMissingBasicMovieInfo(movie: Movie | null) {
  if (!movie) return false;
  return !movie.tmdbRating || !movie.runtimeMinutes || !movie.year;
}

export function buildMovieEditUpdates(movie: Movie, title: string, posterInput: string) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return {
      error: "Title cannot be empty.",
      updates: {},
    };
  }

  const trimmedPoster = posterInput.trim();
  const nextPoster = trimmedPoster.length === 0 ? null : trimmedPoster;
  const updates: { titleClean?: string; posterPath?: string | null } = {};

  if (trimmedTitle !== movie.titleClean) {
    updates.titleClean = trimmedTitle;
  }
  if (nextPoster !== (movie.posterPath ?? null)) {
    updates.posterPath = nextPoster;
  }

  return {
    updates,
  };
}

