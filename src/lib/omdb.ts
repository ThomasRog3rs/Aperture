const OMDB_BASE_URL = "http://www.omdbapi.com/";

type OmdbSearchResult = {
  imdbID: string;
  Title: string;
  Year: string;
};

type OmdbSearchResponse = {
  Search?: OmdbSearchResult[];
  Response: "True" | "False";
  Error?: string;
};

type OmdbDetailsResponse = {
  imdbID: string;
  Title: string;
  Year: string;
  Runtime: string;
  Genre: string;
  Poster: string;
  imdbRating: string;
  Response: "True" | "False";
  Error?: string;
};

function getOmdbApiKey() {
  const apiKey = process.env.OMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OMDb API key missing. Set OMDB_API_KEY.");
  }
  return apiKey;
}

async function omdbFetch(params: Record<string, string>) {
  const apiKey = getOmdbApiKey();
  const url = new URL(OMDB_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (key.toLowerCase() === "apikey") return;
    url.searchParams.set(key, value);
  });
  // Always append the API key, matching OMDb's required query param.
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OMDb request failed: ${response.status} ${body}`);
  }

  return response.json();
}

function parseRuntime(runtime: string) {
  const match = runtime.match(/(\d+)\s*min/i);
  return match ? Number(match[1]) : null;
}

function parseRating(rating: string) {
  const value = Number(rating);
  return Number.isFinite(value) ? value : null;
}

function parseGenres(genres: string) {
  if (!genres || genres === "N/A") return [];
  return genres.split(",").map((genre) => genre.trim()).filter(Boolean);
}

function parsePosterUrl(poster: string) {
  if (!poster || poster === "N/A") return null;
  if (poster.startsWith("http://")) {
    return `https://${poster.slice("http://".length)}`;
  }
  return poster;
}

function imdbIdToNumber(imdbId: string | undefined) {
  if (!imdbId) return null;
  const digits = imdbId.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

export type OmdbMovie = {
  providerId: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  runtimeMinutes: number | null;
  tmdbRating: number | null;
  genres: string[];
  youtubeTrailerKey: string | null;
};

export async function resolveOmdbMovie(
  title: string,
  year?: number | null
): Promise<OmdbMovie | null> {
  const search = (await omdbFetch({
    s: title,
    type: "movie",
    ...(year ? { y: String(year) } : {}),
  })) as OmdbSearchResponse;

  if (search.Response === "False" || !search.Search?.length) {
    return null;
  }

  const firstResult = search.Search[0];
  const details = (await omdbFetch({
    i: firstResult.imdbID,
    plot: "short",
  })) as OmdbDetailsResponse;

  if (details.Response === "False") {
    return null;
  }

  return {
    providerId: imdbIdToNumber(details.imdbID),
    posterPath: parsePosterUrl(details.Poster),
    backdropPath: null,
    runtimeMinutes: parseRuntime(details.Runtime),
    tmdbRating: parseRating(details.imdbRating),
    genres: parseGenres(details.Genre),
    youtubeTrailerKey: null,
  };
}

