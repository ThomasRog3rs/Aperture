import { useEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { PlaybackState } from "@/components/video-player/state";

type ResetRef = { current: (() => void) | undefined } | MutableRefObject<() => void>;

export function useAutoHideCursor(
  containerRef: RefObject<HTMLElement | null>,
  playbackState: PlaybackState,
  resetHideTimerRef?: ResetRef
) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip on touch-first devices (no fine pointer)
    if (window.matchMedia && !window.matchMedia("(pointer:fine)").matches) return;

    const el = containerRef.current;
    if (!el) return;

    const showCursor = () => el.classList.remove("cursor-hidden");
    const hideCursor = () => el.classList.add("cursor-hidden");

    const scheduleShowFromPointer = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return;
      if (document.pointerLockElement) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        showCursor();
        try {
          // @ts-ignore - permissive call if provided
          resetHideTimerRef?.current?.();
        } catch {}
      });
    };

    const handlePointerDown = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return;
      showCursor();
      try {
        // @ts-ignore
        resetHideTimerRef?.current?.();
      } catch {}
    };

    const handleKeyDown = () => {
      showCursor();
      try {
        // @ts-ignore
        resetHideTimerRef?.current?.();
      } catch {}
    };

    window.addEventListener("pointermove", scheduleShowFromPointer, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    if (playbackState.isDragging) showCursor();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointermove", scheduleShowFromPointer);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef, resetHideTimerRef, playbackState.isDragging]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!playbackState.isPlaying) {
      el.classList.remove("cursor-hidden");
      return;
    }

    if (playbackState.isDragging) {
      el.classList.remove("cursor-hidden");
      return;
    }

    if (playbackState.showControls) {
      el.classList.remove("cursor-hidden");
    } else {
      hideCursorIfAllowed(el);
    }
  }, [containerRef, playbackState.showControls, playbackState.isPlaying, playbackState.isDragging]);
}

function hideCursorIfAllowed(el: HTMLElement) {
  // respect pointer lock or other conditions here if needed
  if (document.pointerLockElement) return;
  el.classList.add("cursor-hidden");
}

export default useAutoHideCursor;
