import type { Episode, Series } from "@/lib/types";
import type {
  EpisodeResponse,
  FolderImagesResponse,
  RandomSessionActionPayload,
  RandomSessionResponse,
  SeriesDetailResponse,
} from "./series-detail.types";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

async function expectOk<T extends { error?: string }>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const data = await readJson<T>(response);
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}

export async function fetchSeriesDetail(id: string): Promise<SeriesDetailResponse> {
  const response = await fetch(`/api/series/${id}`);
  const data = await expectOk<SeriesDetailResponse>(response, "Failed to load series.");
  if (!data.series) {
    throw new Error(data.error || "Series not found.");
  }
  return data;
}

export async function fetchFolderImages(id: string): Promise<FolderImagesResponse> {
  const response = await fetch(`/api/series/${id}/folder-images`);
  const data = await expectOk<FolderImagesResponse>(
    response,
    "Failed to load folder images."
  );
  if (!Array.isArray(data.images)) {
    throw new Error(data.error || "Failed to load folder images.");
  }
  return data;
}

export async function fetchRandomSession(id: string): Promise<RandomSessionResponse> {
  const response = await fetch(`/api/series/${id}/random-session`);
  return expectOk<RandomSessionResponse>(response, "Failed to load random session.");
}

export async function runRandomSessionAction(
  id: string,
  payload: RandomSessionActionPayload
): Promise<RandomSessionResponse> {
  const response = await fetch(`/api/series/${id}/random-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return expectOk<RandomSessionResponse>(response, "Failed to update random session.");
}

export async function updateSeriesDetail(
  id: string,
  updates: { titleClean?: string; posterPath?: string | null }
): Promise<SeriesDetailResponse> {
  const response = await fetch(`/api/series/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await expectOk<SeriesDetailResponse>(response, "Failed to update series.");
  if (!data.series) {
    throw new Error(data.error || "Failed to update series.");
  }
  return data;
}

export async function refreshSeriesPoster(id: string): Promise<Series> {
  const response = await fetch(`/api/series/${id}/refresh-poster`, {
    method: "POST",
  });
  const data = await expectOk<{ series?: Series; error?: string }>(
    response,
    "Failed to refresh metadata."
  );
  if (!data.series) {
    throw new Error(data.error || "Failed to refresh metadata.");
  }
  return data.series;
}

export async function deleteSeriesDetail(id: string): Promise<void> {
  const response = await fetch(`/api/series/${id}`, {
    method: "DELETE",
  });
  await expectOk<{ ok?: boolean; error?: string }>(response, "Failed to remove series.");
}

export async function updateEpisodeWatched(
  episodeId: string,
  watched: boolean
): Promise<Episode> {
  const response = await fetch(`/api/episodes/${episodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watched }),
  });
  const data = await expectOk<EpisodeResponse>(response, "Failed to update episode.");
  if (!data.episode) {
    throw new Error(data.error || "Failed to update episode.");
  }
  return data.episode;
}

export async function persistEpisodeWatchProgress(
  episodeId: string,
  currentTime: number,
  duration: number
): Promise<void> {
  const response = await fetch(`/api/episodes/${episodeId}/watch-progress`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentTime, duration }),
  });
  await expectOk<{ ok?: boolean; error?: string }>(
    response,
    "Failed to update watch progress."
  );
}

export async function launchExternalPlayback(filePath: string): Promise<void> {
  const response = await fetch("/api/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath }),
  });
  await expectOk<{ status?: string; error?: string }>(
    response,
    "Failed to launch player."
  );
}
