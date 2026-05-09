"use client";

export type VideoPlayerEpisodeTarget = {
  id: string;
  title: string;
  subtitle: string;
};

export type VideoPlayerEpisodeListItem = VideoPlayerEpisodeTarget & {
  numberLabel: string;
  watched: boolean;
  isCurrent: boolean;
};

export type VideoPlayerEpisodeListSeason = {
  id: string;
  title: string;
  subtitle?: string;
  episodes: VideoPlayerEpisodeListItem[];
};

export type VideoPlayerProps = {
  title: string;
  streamUrl: string;
  hlsUrl?: string;
  posterUrl?: string;
  thumbnailsVttUrl?: string;
  onClose: () => void;
  onError?: (message: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: (currentTime: number, duration: number) => void;
  startTime?: number;
  onExternalPlayer?: () => void;
  onPreviousEpisode?: () => void;
  previousEpisode?: VideoPlayerEpisodeTarget;
  onNextEpisode?: () => void;
  nextEpisode?: VideoPlayerEpisodeTarget;
  episodeSeasons?: VideoPlayerEpisodeListSeason[];
  onSelectEpisode?: (episodeId: string) => void;
  mediaType?: "movie" | "episode";
  mediaId?: string;
  initialSubtitleId?: string | null;
  initialSubtitlesEnabled?: boolean;
  isRandomMode?: boolean;
  onRandomEpisode?: () => void;
};

export type StreamInfo = {
  mode: "direct" | "remux" | "transcode";
  requestedStrategy?: "auto" | "classic" | "hls";
  effectiveStrategy?: "auto" | "classic" | "hls";
  effectiveMode?: "direct" | "hls" | "live";
  fallbackReason?: string;
  duration: number;
};

export type PlaybackStrategy = "auto" | "classic" | "hls";
export type ClientDevice = "desktop" | "mobile";
export type OrientationLock = "any" | "natural" | "landscape" | "portrait";

export type MaybeScreenOrientation = {
  lock?: (orientation: OrientationLock) => Promise<void>;
  unlock?: () => void;
};

export interface WebkitVideoElement extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}
