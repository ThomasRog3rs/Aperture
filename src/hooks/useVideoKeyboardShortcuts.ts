"use client";

import { useEffect, useRef } from "react";

const SEEK_STEP_SECONDS = 10;
const VOLUME_STEP = 0.1;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

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
  const latestRef = useRef({
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
  });

  useEffect(() => {
    latestRef.current = {
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
    };
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

      if (isEditableTarget(event.target)) return;

      const latest = latestRef.current;
      const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      let handled = false;

      switch (normalizedKey) {
        case " ":
        case "k":
          event.preventDefault();
          latest.onTogglePlay();
          handled = true;
          break;
        case "ArrowLeft":
          event.preventDefault();
          latest.onSeekTo(Math.max(0, latest.effectiveTime - SEEK_STEP_SECONDS));
          handled = true;
          break;
        case "ArrowRight":
          event.preventDefault();
          latest.onSeekTo(
            Math.min(latest.effectiveDuration || Infinity, latest.effectiveTime + SEEK_STEP_SECONDS)
          );
          handled = true;
          break;
        case "ArrowUp":
          event.preventDefault();
          latest.onVolumeDelta(VOLUME_STEP);
          handled = true;
          break;
        case "ArrowDown":
          event.preventDefault();
          latest.onVolumeDelta(-VOLUME_STEP);
          handled = true;
          break;
        case "m":
          event.preventDefault();
          latest.onToggleMute();
          handled = true;
          break;
        case "Escape":
          if (latest.isCcPanelOpen) {
            event.preventDefault();
            latest.onCloseCcPanel();
            handled = true;
            break;
          }
          if (latest.isEpisodeSelectorOpen) {
            event.preventDefault();
            latest.onCloseEpisodeSelector();
            handled = true;
          }
          break;
      }

      if (handled) latest.onUserInteraction();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoRef]);
}