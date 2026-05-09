import type { Movie } from "@/lib/types";
import type {
  FolderImage,
  FolderImagesResponse,
  MovieResponse,
  PlayResponse,
  UpdateMoviePayload,
} from "@/features/movie-detail/types";

type FetchFn = typeof fetch;

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getResponseError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data) {
    const maybeError = (data as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim().length > 0) {
      return maybeError;
    }
  }
  return fallback;
}

export interface MovieDetailGateway {
  getMovie(id: string): Promise<Movie>;
  getFolderImages(id: string): Promise<FolderImage[]>;
  updateMovie(id: string, updates: UpdateMoviePayload): Promise<Movie>;
  refreshMovieMetadata(id: string): Promise<Movie>;
  deleteMovie(id: string): Promise<void>;
  launchExternalPlayer(filePath: string): Promise<void>;
  saveWatchProgress(id: string, currentTime: number, duration: number): Promise<void>;
}

class FetchMovieDetailGateway implements MovieDetailGateway {
  constructor(private readonly fetchFn: FetchFn) {}

  private request(input: RequestInfo | URL, init?: RequestInit) {
    return this.fetchFn.call(globalThis, input, init);
  }

  async getMovie(id: string) {
    const response = await this.request(`/api/movies/${id}`);
    const data = await readJson<MovieResponse>(response);
    if (!response.ok || !data?.movie) {
      throw new Error(getResponseError(data, "Movie not found."));
    }
    return data.movie;
  }

  async getFolderImages(id: string) {
    const response = await this.request(`/api/movies/${id}/folder-images`);
    const data = await readJson<FolderImagesResponse>(response);
    if (!response.ok || !Array.isArray(data?.images)) {
      throw new Error(getResponseError(data, "Failed to load folder images."));
    }
    return data.images;
  }

  async updateMovie(id: string, updates: UpdateMoviePayload) {
    const response = await this.request(`/api/movies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await readJson<MovieResponse>(response);
    if (!response.ok || !data?.movie) {
      throw new Error(getResponseError(data, "Failed to update movie."));
    }
    return data.movie;
  }

  async refreshMovieMetadata(id: string) {
    const response = await this.request(`/api/movies/${id}/refresh-poster`, {
      method: "POST",
    });
    const data = await readJson<MovieResponse>(response);
    if (!response.ok || !data?.movie) {
      throw new Error(getResponseError(data, "Failed to refresh poster."));
    }
    return data.movie;
  }

  async deleteMovie(id: string) {
    const response = await this.request(`/api/movies/${id}`, {
      method: "DELETE",
    });
    if (response.ok) return;
    const data = await readJson<{ error?: string }>(response);
    throw new Error(getResponseError(data, "Failed to remove movie."));
  }

  async launchExternalPlayer(filePath: string) {
    const response = await this.request("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });
    if (response.ok) return;
    const data = await readJson<PlayResponse>(response);
    throw new Error(getResponseError(data, "Failed to launch player."));
  }

  async saveWatchProgress(id: string, currentTime: number, duration: number) {
    const response = await this.request(`/api/movies/${id}/watch-progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentTime, duration }),
    });
    if (response.ok) return;
    const data = await readJson<{ error?: string }>(response);
    throw new Error(getResponseError(data, "Failed to save watch progress."));
  }
}

const defaultGateway = new FetchMovieDetailGateway(fetch);

export function createFetchMovieDetailGateway(fetchFn?: FetchFn): MovieDetailGateway {
  if (!fetchFn) return defaultGateway;
  return new FetchMovieDetailGateway(fetchFn);
}
