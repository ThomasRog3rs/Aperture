"use client";

import type { SubtitleFile, SubtitleSearchResult } from "@/lib/types";
import type { StreamInfo } from "@/components/video-player/types";

export type PlaybackState = {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  timeOffset: number;
  duration: number;
  buffered: number;
  showControls: boolean;
  isLoading: boolean;
  isDragging: boolean;
};

type PlaybackAction =
  | { type: "set-playing"; value: boolean }
  | { type: "set-muted"; value: boolean }
  | { type: "set-volume"; value: number }
  | { type: "set-current-time"; value: number }
  | { type: "set-time-offset"; value: number }
  | { type: "set-duration"; value: number }
  | { type: "set-buffered"; value: number }
  | { type: "set-show-controls"; value: boolean }
  | { type: "set-loading"; value: boolean }
  | { type: "set-dragging"; value: boolean }
  | { type: "reset-for-source" };

export function createInitialPlaybackState(): PlaybackState {
  return {
    isPlaying: false,
    isMuted: false,
    volume: 1,
    currentTime: 0,
    timeOffset: 0,
    duration: 0,
    buffered: 0,
    showControls: true,
    isLoading: true,
    isDragging: false,
  };
}

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction
): PlaybackState {
  switch (action.type) {
    case "set-playing":
      return { ...state, isPlaying: action.value };
    case "set-muted":
      return { ...state, isMuted: action.value };
    case "set-volume":
      return { ...state, volume: action.value };
    case "set-current-time":
      return { ...state, currentTime: action.value };
    case "set-time-offset":
      return { ...state, timeOffset: action.value };
    case "set-duration":
      return { ...state, duration: action.value };
    case "set-buffered":
      return { ...state, buffered: action.value };
    case "set-show-controls":
      return { ...state, showControls: action.value };
    case "set-loading":
      return { ...state, isLoading: action.value };
    case "set-dragging":
      return { ...state, isDragging: action.value };
    case "reset-for-source":
      return {
        ...state,
        isPlaying: false,
        currentTime: 0,
        timeOffset: 0,
        duration: 0,
        buffered: 0,
        showControls: true,
        isLoading: true,
        isDragging: false,
      };
    default:
      return state;
  }
}

export type UiState = {
  isCcPanelOpen: boolean;
  isEpisodeSelectorOpen: boolean;
  isOverflowMenuOpen: boolean;
};

type UiAction =
  | { type: "set-cc-open"; value: boolean }
  | { type: "set-episode-selector-open"; value: boolean }
  | { type: "set-overflow-open"; value: boolean };

export function createInitialUiState(): UiState {
  return {
    isCcPanelOpen: false,
    isEpisodeSelectorOpen: false,
    isOverflowMenuOpen: false,
  };
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "set-cc-open":
      return { ...state, isCcPanelOpen: action.value };
    case "set-episode-selector-open":
      return { ...state, isEpisodeSelectorOpen: action.value };
    case "set-overflow-open":
      return { ...state, isOverflowMenuOpen: action.value };
    default:
      return state;
  }
}

export type NoticesState = {
  playbackNotice: string | null;
  playerNotice: string | null;
};

type NoticesAction =
  | { type: "set-playback-notice"; value: string | null }
  | { type: "set-player-notice"; value: string | null };

export function createInitialNoticesState(): NoticesState {
  return {
    playbackNotice: null,
    playerNotice: null,
  };
}

export function noticesReducer(
  state: NoticesState,
  action: NoticesAction
): NoticesState {
  switch (action.type) {
    case "set-playback-notice":
      return { ...state, playbackNotice: action.value };
    case "set-player-notice":
      return { ...state, playerNotice: action.value };
    default:
      return state;
  }
}

export type EpisodeSelectionState = {
  openSeasonId: string | null;
};

type EpisodeSelectionAction =
  | { type: "set-open-season"; value: string | null }
  | { type: "reset" };

export function createInitialEpisodeSelectionState(): EpisodeSelectionState {
  return { openSeasonId: null };
}

export function episodeSelectionReducer(
  state: EpisodeSelectionState,
  action: EpisodeSelectionAction
): EpisodeSelectionState {
  switch (action.type) {
    case "set-open-season":
      return { ...state, openSeasonId: action.value };
    case "reset":
      return createInitialEpisodeSelectionState();
    default:
      return state;
  }
}

export type SubtitleState = {
  subtitles: SubtitleFile[];
  activeSubtitleId: string | null;
  subtitlesEnabled: boolean;
  subtitleSearchQuery: string;
  subtitleSearchLanguage: string;
  subtitleSearchResults: SubtitleSearchResult[];
  subtitleSearchLoading: boolean;
  subtitleSearchError: string | null;
  subtitleDownloadingId: number | null;
  subtitleDeletingId: string | null;
  subtitleError: string | null;
};

export type SubtitleAction =
  | { type: "reset" }
  | {
      type: "load-success";
      subtitles: SubtitleFile[];
      activeSubtitleId: string | null;
      subtitlesEnabled: boolean;
    }
  | { type: "set-active-subtitle"; value: string | null }
  | { type: "set-subtitles-enabled"; value: boolean }
  | { type: "set-search-query"; value: string }
  | { type: "set-search-language"; value: string }
  | { type: "search-start" }
  | { type: "search-success"; results: SubtitleSearchResult[] }
  | { type: "search-error"; value: string }
  | { type: "download-start"; value: number }
  | { type: "download-success"; subtitle: SubtitleFile }
  | { type: "download-error"; value: string }
  | { type: "delete-start"; value: string }
  | { type: "delete-success"; subtitleId: string; clearActive: boolean }
  | { type: "delete-error"; value: string };

export function createInitialSubtitleState(): SubtitleState {
  return {
    subtitles: [],
    activeSubtitleId: null,
    subtitlesEnabled: false,
    subtitleSearchQuery: "",
    subtitleSearchLanguage: "en",
    subtitleSearchResults: [],
    subtitleSearchLoading: false,
    subtitleSearchError: null,
    subtitleDownloadingId: null,
    subtitleDeletingId: null,
    subtitleError: null,
  };
}

export function subtitleReducer(
  state: SubtitleState,
  action: SubtitleAction
): SubtitleState {
  switch (action.type) {
    case "reset":
      return createInitialSubtitleState();
    case "load-success":
      return {
        ...state,
        subtitles: action.subtitles,
        activeSubtitleId: action.activeSubtitleId,
        subtitlesEnabled: action.subtitlesEnabled,
        subtitleSearchResults: [],
        subtitleSearchError: null,
        subtitleError: null,
      };
    case "set-active-subtitle":
      return { ...state, activeSubtitleId: action.value };
    case "set-subtitles-enabled":
      return { ...state, subtitlesEnabled: action.value };
    case "set-search-query":
      return { ...state, subtitleSearchQuery: action.value };
    case "set-search-language":
      return { ...state, subtitleSearchLanguage: action.value };
    case "search-start":
      return { ...state, subtitleSearchLoading: true, subtitleSearchError: null };
    case "search-success":
      return {
        ...state,
        subtitleSearchLoading: false,
        subtitleSearchError: null,
        subtitleSearchResults: action.results,
      };
    case "search-error":
      return {
        ...state,
        subtitleSearchLoading: false,
        subtitleSearchError: action.value,
      };
    case "download-start":
      return { ...state, subtitleDownloadingId: action.value, subtitleError: null };
    case "download-success": {
      const exists = state.subtitles.some((subtitle) => subtitle.id === action.subtitle.id);
      return {
        ...state,
        subtitleDownloadingId: null,
        subtitles: exists ? state.subtitles : [...state.subtitles, action.subtitle],
      };
    }
    case "download-error":
      return {
        ...state,
        subtitleDownloadingId: null,
        subtitleError: action.value,
      };
    case "delete-start":
      return { ...state, subtitleDeletingId: action.value, subtitleError: null };
    case "delete-success":
      return {
        ...state,
        subtitleDeletingId: null,
        subtitles: state.subtitles.filter((subtitle) => subtitle.id !== action.subtitleId),
        activeSubtitleId: action.clearActive ? null : state.activeSubtitleId,
        subtitlesEnabled: action.clearActive ? false : state.subtitlesEnabled,
      };
    case "delete-error":
      return {
        ...state,
        subtitleDeletingId: null,
        subtitleError: action.value,
      };
    default:
      return state;
  }
}

export const videoPlayerSelectors = {
  effectiveDuration(playback: PlaybackState, streamInfo: StreamInfo | null) {
    if (playback.duration > 0) return playback.duration;
    if (streamInfo?.duration && streamInfo.duration > 0) return streamInfo.duration;
    return 0;
  },
  effectiveTime(playback: PlaybackState, timeOffset: number) {
    return playback.currentTime + timeOffset;
  },
  progress(effectiveTime: number, effectiveDuration: number) {
    return effectiveDuration > 0 ? effectiveTime / effectiveDuration : 0;
  },
  showClickToPlay(playback: PlaybackState, timeOffset: number) {
    return (
      !playback.isPlaying &&
      playback.currentTime === 0 &&
      timeOffset === 0 &&
      !playback.isLoading
    );
  },
  subtitleIndicator(subtitles: SubtitleState) {
    return Boolean(subtitles.activeSubtitleId && subtitles.subtitlesEnabled);
  },
  panelsOpen(ui: UiState) {
    return ui.isCcPanelOpen || ui.isEpisodeSelectorOpen || ui.isOverflowMenuOpen;
  },
};
