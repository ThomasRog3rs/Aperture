import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";

export type SeriesNotice = {
  tone: "info" | "success" | "error";
  message: string;
};

export type SeriesDetailResponse = {
  series: Series;
  seasons: SeasonWithEpisodes[];
  error?: string;
};

export type FolderImage = {
  name: string;
  url: string;
};

export type FolderImagesResponse = {
  images: FolderImage[];
  error?: string;
};

export type EpisodeResponse = {
  episode: Episode;
  error?: string;
};

export type PlaybackLaunchMode = "continue" | "random";

export type RandomSessionSummary = {
  seriesId: string;
  startedEpisodeIds: string[];
  currentEpisodeId: string | null;
  startedEpisodeCount: number;
  createdAt: number;
  updatedAt: number;
  totalEpisodeCount: number;
  remainingEpisodeCount: number;
  unwatchedRemainingEpisodeCount: number;
  watchedRemainingEpisodeCount: number;
  exhausted: boolean;
};

export type RandomSessionResponse = {
  session: RandomSessionSummary | null;
  episode?: Episode | null;
  exhausted?: boolean;
  error?: string;
};

export type RandomSessionActionPayload =
  | { action: "start_new" | "continue" | "next_random" }
  | { action: "mark_started"; episodeId: string };

export type RandomSessionAction =
  | "start_new"
  | "continue"
  | "next_random"
  | "mark_started";
