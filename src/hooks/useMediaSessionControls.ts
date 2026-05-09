"use client";

import { useEffect } from "react";

type UseMediaSessionControlsOptions = {
  title: string;
  posterUrl?: string;
  isPlaying: boolean;
  effectiveTime: number;
  effectiveDuration: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (delta: number) => void;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
};

export function useMediaSessionControls({
  title,
  posterUrl,
  isPlaying,
  effectiveTime,
  effectiveDuration,
  onPlay,
  onPause,
  onSeek,
  onPreviousEpisode,
  onNextEpisode,
}: UseMediaSessionControlsOptions) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "Aperture",
      artwork: posterUrl
        ? [{ src: posterUrl, sizes: "any", type: "image/jpeg" }]
        : [],
    });

    const seekOffset = 10;
    navigator.mediaSession.setActionHandler("play", onPlay);
    navigator.mediaSession.setActionHandler("pause", onPause);
    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      onSeek(-(details.seekOffset ?? seekOffset));
    });
    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      onSeek(details.seekOffset ?? seekOffset);
    });
    navigator.mediaSession.setActionHandler("previoustrack", onPreviousEpisode ?? null);
    navigator.mediaSession.setActionHandler("nexttrack", onNextEpisode ?? null);

    return () => {
      (
        [
          "play",
          "pause",
          "seekbackward",
          "seekforward",
          "previoustrack",
          "nexttrack",
        ] as MediaSessionAction[]
      ).forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      });
    };
  }, [onNextEpisode, onPause, onPlay, onPreviousEpisode, onSeek, posterUrl, title]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!effectiveDuration || effectiveDuration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: effectiveDuration,
        playbackRate: 1,
        position: Math.min(effectiveTime, effectiveDuration),
      });
    } catch {}
  }, [effectiveDuration, effectiveTime]);
}
