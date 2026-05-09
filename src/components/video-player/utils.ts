"use client";

import type {
  ClientDevice,
  PlaybackStrategy,
  WebkitVideoElement,
} from "@/components/video-player/types";

const PLAYBACK_MODE_LABELS: Record<PlaybackStrategy, string> = {
  auto: "Auto",
  classic: "Classic",
  hls: "HLS",
};

export const PLAYBACK_STRATEGY_STORAGE_KEY = "aperture.playback.strategy.v1";

export const SUBTITLE_SEARCH_LANGUAGE_OPTIONS = [
  "en",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "ru",
  "zh",
  "ja",
  "ko",
  "ar",
  "nl",
  "pl",
  "sv",
  "tr",
] as const;

export function detectClientDevice(): ClientDevice {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("android") ||
    ua.includes("mobile")
  ) {
    return "mobile";
  }
  return "desktop";
}

export function parseStoredStrategy(value: string | null): PlaybackStrategy {
  if (value === "classic" || value === "hls") return value;
  return "auto";
}

export function playbackModeLabel(mode: PlaybackStrategy) {
  return PLAYBACK_MODE_LABELS[mode];
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function safelyHandlePromise(result: Promise<void> | void) {
  if (!result || typeof result.catch !== "function") return;
  void result.catch(() => {});
}

export function safePlay(video: HTMLVideoElement) {
  try {
    safelyHandlePromise(video.play());
  } catch {}
}

export function supportsNativeHlsPlayback() {
  if (typeof document === "undefined") return false;
  const video = document.createElement("video");
  return (
    video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
    video.canPlayType("application/x-mpegURL") !== ""
  );
}

export function supportsElementFullscreen(
  element: HTMLDivElement | null
): element is HTMLDivElement & {
  requestFullscreen: () => Promise<void>;
} {
  return Boolean(element && typeof element.requestFullscreen === "function");
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function detectStandaloneWebApp() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as NavigatorWithStandalone).standalone === true;
}

export function supportsPictureInPicture(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const webkitVideo = video as WebkitVideoElement;
  if (typeof document !== "undefined" && "pictureInPictureEnabled" in document) {
    return document.pictureInPictureEnabled && !video.disablePictureInPicture;
  }
  return (
    typeof webkitVideo.webkitSupportsPresentationMode === "function" &&
    webkitVideo.webkitSupportsPresentationMode("picture-in-picture")
  );
}

export function mapPlayerError(
  error: unknown,
  { isStandaloneWebApp }: { isStandaloneWebApp: boolean }
) {
  const name = error instanceof DOMException ? error.name : null;

  if (name === "NotAllowedError") {
    return "Picture-in-picture was blocked by iOS. Try again while the video is playing and the player stays on screen.";
  }

  if (name === "InvalidStateError") {
    return "Picture-in-picture is not ready yet. Let playback start, then try again.";
  }

  if (name === "NotSupportedError" && isStandaloneWebApp) {
    return "Picture-in-picture is not available in the installed iPhone app. Open Aperture in Safari or use the external player instead.";
  }

  if (name === "NotSupportedError") {
    return "Picture-in-picture is not available for this video in the current browser.";
  }

  return isStandaloneWebApp
    ? "Picture-in-picture failed in the installed iPhone app. Try Safari or the external player while we finish the standalone fix."
    : "Picture-in-picture failed in this browser session.";
}

export function getPlaybackModeBadge(mode?: "direct" | "remux" | "transcode") {
  if (!mode || mode === "direct") return null;
  return mode === "remux" ? "remux" : "transcode";
}
