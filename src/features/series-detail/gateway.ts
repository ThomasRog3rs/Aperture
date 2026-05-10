import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";
import type {
  EpisodeResponse,
  FolderImage,
  FolderImagesResponse,
  PlayResponse,
  RandomSessionActionPayload,
  RandomSessionResponse,
  SeriesResponse,
  UpdateEpisodePayload,
  UpdateSeriesPayload,
} from "@/features/series-detail/types";

type FetchFn = typeof fetch;

async function readJson<T>(response: Response, context: string): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Received invalid JSON while ${context}.`);
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

function toSeasonWithEpisodes(
  seasons?: SeasonWithEpisodes[] | Series["seasons"]
): SeasonWithEpisodes[] {
  if (!seasons) return [];
  return seasons.map((season) => ({
    ...season,
    episodes: "episodes" in season && Array.isArray(season.episodes) ? season.episodes : [],
  }));
}

export interface SeriesDetailGateway {
  getSeries(id: string): Promise<{ series: Series; seasons: SeasonWithEpisodes[] }>;
  getFolderImages(id: string): Promise<FolderImage[]>;
  updateSeries(id: string, updates: UpdateSeriesPayload): Promise<{ series: Series; seasons: SeasonWithEpisodes[] }>;
  refreshSeriesMetadata(id: string): Promise<Series>;
  deleteSeries(id: string): Promise<void>;
  launchExternalPlayer(filePath: string): Promise<void>;
  updateEpisode(id: string, updates: UpdateEpisodePayload): Promise<Episode>;
  saveEpisodeWatchProgress(id: string, currentTime: number, duration: number): Promise<void>;
  getRandomSession(id: string): Promise<RandomSessionResponse>;
  requestRandomSessionAction(
    id: string,
    payload: RandomSessionActionPayload
  ): Promise<RandomSessionResponse>;
}

class FetchSeriesDetailGateway implements SeriesDetailGateway {
  constructor(private readonly fetchFn: FetchFn) {}

  private request(input: RequestInfo | URL, init?: RequestInit) {
    return this.fetchFn.call(globalThis, input, init);
  }

  async getSeries(id: string) {
    const response = await this.request(`/api/series/${id}`);
    const data = await readJson<SeriesResponse>(response, "loading series details");
    if (!response.ok || !data?.series) {
      throw new Error(getResponseError(data, "Series not found."));
    }
    return {
      series: data.series,
      seasons: toSeasonWithEpisodes(data.seasons ?? data.series.seasons),
    };
  }

  async getFolderImages(id: string) {
    const response = await this.request(`/api/series/${id}/folder-images`);
    const data = await readJson<FolderImagesResponse>(response, "loading series folder images");
    if (!response.ok || !Array.isArray(data?.images)) {
      throw new Error(getResponseError(data, "Failed to load folder images."));
    }
    return data.images;
  }

  async updateSeries(id: string, updates: UpdateSeriesPayload) {
    const response = await this.request(`/api/series/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await readJson<SeriesResponse>(response, "updating series details");
    if (!response.ok || !data?.series) {
      throw new Error(getResponseError(data, "Failed to update series."));
    }
    return {
      series: data.series,
      seasons: toSeasonWithEpisodes(data.seasons ?? data.series.seasons),
    };
  }

  async refreshSeriesMetadata(id: string) {
    const response = await this.request(`/api/series/${id}/refresh-poster`, {
      method: "POST",
    });
    const data = await readJson<{ series?: Series; error?: string }>(
      response,
      "refreshing series metadata"
    );
    if (!response.ok || !data?.series) {
      throw new Error(getResponseError(data, "Failed to refresh metadata."));
    }
    return data.series;
  }

  async deleteSeries(id: string) {
    const response = await this.request(`/api/series/${id}`, {
      method: "DELETE",
    });
    if (response.ok) return;
    const data = await readJson<{ error?: string }>(response, "deleting series");
    throw new Error(getResponseError(data, "Failed to remove series."));
  }

  async launchExternalPlayer(filePath: string) {
    const response = await this.request("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });
    if (response.ok) return;
    const data = await readJson<PlayResponse>(response, "launching external player");
    throw new Error(getResponseError(data, "Failed to launch player."));
  }

  async updateEpisode(id: string, updates: UpdateEpisodePayload) {
    const response = await this.request(`/api/episodes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await readJson<EpisodeResponse>(response, "updating episode");
    if (!response.ok || !data?.episode) {
      throw new Error(getResponseError(data, "Failed to update episode."));
    }
    return data.episode;
  }

  async saveEpisodeWatchProgress(id: string, currentTime: number, duration: number) {
    const response = await this.request(`/api/episodes/${id}/watch-progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentTime, duration }),
    });
    if (response.ok) return;
    const data = await readJson<{ error?: string }>(
      response,
      "saving episode watch progress"
    );
    throw new Error(getResponseError(data, "Failed to save watch progress."));
  }

  async getRandomSession(id: string) {
    const response = await this.request(`/api/series/${id}/random-session`);
    const data = await readJson<RandomSessionResponse>(response, "loading random session");
    if (!response.ok) {
      throw new Error(getResponseError(data, "Failed to load random session."));
    }
    return data ?? {};
  }

  async requestRandomSessionAction(id: string, payload: RandomSessionActionPayload) {
    const response = await this.request(`/api/series/${id}/random-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJson<RandomSessionResponse>(response, "updating random session");
    if (!response.ok) {
      throw new Error(getResponseError(data, "Failed to update random session."));
    }
    return data ?? {};
  }
}

const defaultGateway = new FetchSeriesDetailGateway(fetch);

export function createFetchSeriesDetailGateway(fetchFn?: FetchFn): SeriesDetailGateway {
  if (!fetchFn) return defaultGateway;
  return new FetchSeriesDetailGateway(fetchFn);
}
