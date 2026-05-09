"use client";

import { useCallback, useState } from "react";
import type { PlaybackStrategy } from "@/components/video-player/types";
import {
  parseStoredStrategy,
  PLAYBACK_STRATEGY_STORAGE_KEY,
} from "@/components/video-player/utils";

export function usePlaybackPersistence() {
  const [playbackStrategy, setPlaybackStrategyState] =
    useState<PlaybackStrategy>(() => {
      if (typeof window === "undefined") return "auto";
      try {
        return parseStoredStrategy(
          localStorage.getItem(PLAYBACK_STRATEGY_STORAGE_KEY)
        );
      } catch {
        return "auto";
      }
    });

  const setPlaybackStrategy = useCallback((next: PlaybackStrategy) => {
    setPlaybackStrategyState(next);
    try {
      localStorage.setItem(PLAYBACK_STRATEGY_STORAGE_KEY, next);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  return {
    playbackStrategy,
    setPlaybackStrategy,
  };
}
