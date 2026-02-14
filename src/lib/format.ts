export function formatRuntime(minutes: number | null) {
  if (!minutes || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function formatRating(rating: number | null) {
  if (rating === null || Number.isNaN(rating)) return "—";
  return rating.toFixed(1);
}

export function tmdbImageUrl(
  path: string | null | undefined,
  size: "w342" | "w780" | "original" = "w342"
) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

