import { cleanup, renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInitialPlaybackState } from "@/components/video-player/state";
import { useAutoHideCursor } from "@/hooks/useAutoHideCursor";

type AutoHideOptions = Parameters<typeof useAutoHideCursor>;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function createOptions(overrides: Partial<AutoHideOptions[1]> = {}) {
  const container = document.createElement("div");
  const resetHideTimerRef = { current: vi.fn() };
  const playbackState = {
    ...createInitialPlaybackState(),
    ...overrides,
  };

  return {
    containerRef: { current: container },
    playbackState,
    resetHideTimerRef,
  } satisfies {
    containerRef: AutoHideOptions[0];
    playbackState: AutoHideOptions[1];
    resetHideTimerRef: NonNullable<AutoHideOptions[2]>;
  };
}

function dispatchPointerEvent(type: string, pointerType = "mouse") {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", {
    configurable: true,
    value: pointerType,
  });

  act(() => {
    window.dispatchEvent(event);
  });
}

describe("useAutoHideCursor", () => {
  it("hides the cursor only while playback is active and controls are hidden", () => {
    const { containerRef, playbackState, resetHideTimerRef } = createOptions({
      isPlaying: true,
      showControls: false,
    });

    const { rerender } = renderHook(
      ({ currentContainerRef, currentPlaybackState, currentResetHideTimerRef }) =>
        useAutoHideCursor(
          currentContainerRef,
          currentPlaybackState,
          currentResetHideTimerRef
        ),
      {
        initialProps: {
          currentContainerRef: containerRef,
          currentPlaybackState: playbackState,
          currentResetHideTimerRef: resetHideTimerRef,
        },
      }
    );

    expect(containerRef.current?.classList.contains("cursor-hidden")).toBe(true);

    rerender({
      currentContainerRef: containerRef,
      currentPlaybackState: { ...playbackState, showControls: true },
      currentResetHideTimerRef: resetHideTimerRef,
    });

    expect(containerRef.current?.classList.contains("cursor-hidden")).toBe(false);

    rerender({
      currentContainerRef: containerRef,
      currentPlaybackState: { ...playbackState, isPlaying: false, showControls: false },
      currentResetHideTimerRef: resetHideTimerRef,
    });

    expect(containerRef.current?.classList.contains("cursor-hidden")).toBe(false);
  });

  it("shows the cursor again and resets the hide timer on mouse movement", () => {
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { containerRef, playbackState, resetHideTimerRef } = createOptions({
      isPlaying: true,
      showControls: false,
    });

    renderHook(() => useAutoHideCursor(containerRef, playbackState, resetHideTimerRef));

    expect(containerRef.current?.classList.contains("cursor-hidden")).toBe(true);

    dispatchPointerEvent("pointermove");

    expect(rafSpy).toHaveBeenCalled();
    expect(containerRef.current?.classList.contains("cursor-hidden")).toBe(false);
    expect(resetHideTimerRef.current).toHaveBeenCalledTimes(1);
  });
});