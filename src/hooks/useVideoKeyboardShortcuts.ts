"use client";

import { useEffect, useRef } from "react";

type UseVideoKeyboardShortcutsOptions = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  effectiveTime: number;
  effectiveDuration: number;
  isCcPanelOpen: boolean;
  isEpisodeSelectorOpen: boolean;
  onTogglePlay: () => void;
  onSeekTo: (targetTime: number) => void;
  onVolumeDelta: (delta: number) => void;
  onToggleMute: () => void;
  onCloseCcPanel: () => void;
  onCloseEpisodeSelector: () => void;
  onUserInteraction: () => void;
};

export function useVideoKeyboardShortcuts({
  videoRef,
  effectiveTime,
  effectiveDuration,
  isCcPanelOpen,
  isEpisodeSelectorOpen,
  onTogglePlay,
  onSeekTo,
  onVolumeDelta,
  onToggleMute,
  onCloseCcPanel,
  onCloseEpisodeSelector,
  onUserInteraction,
}: UseVideoKeyboardShortcutsOptions) {
  const effectiveTimeRef = useRef(effectiveTime);
  const effectiveDurationRef = useRef(effectiveDuration);
  const isCcPanelOpenRef = useRef(isCcPanelOpen);
  const isEpisodeSelectorOpenRef = useRef(isEpisodeSelectorOpen);

  const onTogglePlayRef = useRef(onTogglePlay);
  const onSeekToRef = useRef(onSeekTo);
  const onVolumeDeltaRef = useRef(onVolumeDelta);
  const onToggleMuteRef = useRef(onToggleMute);
  const onCloseCcPanelRef = useRef(onCloseCcPanel);
  const onCloseEpisodeSelectorRef = useRef(onCloseEpisodeSelector);
  const onUserInteractionRef = useRef(onUserInteraction);

  useEffect(() => {
    effectiveTimeRef.current = effectiveTime;
    effectiveDurationRef.current = effectiveDuration;
    isCcPanelOpenRef.current = isCcPanelOpen;
    isEpisodeSelectorOpenRef.current = isEpisodeSelectorOpen;

    onTogglePlayRef.current = onTogglePlay;
    onSeekToRef.current = onSeekTo;
    onVolumeDeltaRef.current = onVolumeDelta;
    onToggleMuteRef.current = onToggleMute;
    onCloseCcPanelRef.current = onCloseCcPanel;
    onCloseEpisodeSelectorRef.current = onCloseEpisodeSelector;
    onUserInteractionRef.current = onUserInteraction;
  }, [
    effectiveDuration,
    effectiveTime,
    isCcPanelOpen,
    isEpisodeSelectorOpen,
    onCloseCcPanel,
    onCloseEpisodeSelector,
    onSeekTo,
    onToggleMute,
    onTogglePlay,
    onUserInteraction,
    onVolumeDelta,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          onTogglePlayRef.current();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onSeekToRef.current(Math.max(0, effectiveTimeRef.current - 10));
          break;
        case "ArrowRight":
          event.preventDefault();
          onSeekToRef.current(
            Math.min(effectiveDurationRef.current || Infinity, effectiveTimeRef.current + 10)
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          onVolumeDeltaRef.current(0.1);
          break;
        case "ArrowDown":
          event.preventDefault();
          onVolumeDeltaRef.current(-0.1);
          break;
        case "m":
          event.preventDefault();
          onToggleMuteRef.current();
          break;
        case "Escape":
          if (isCcPanelOpenRef.current) {
            event.preventDefault();
            onCloseCcPanelRef.current();
            break;
          }
          if (isEpisodeSelectorOpenRef.current) {
            event.preventDefault();
            onCloseEpisodeSelectorRef.current();
          }
          break;
      }

      onUserInteractionRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoRef]);
}