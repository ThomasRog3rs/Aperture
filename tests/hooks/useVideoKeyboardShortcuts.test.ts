import { cleanup, renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVideoKeyboardShortcuts } from "@/hooks/useVideoKeyboardShortcuts";

type ShortcutOptions = Parameters<typeof useVideoKeyboardShortcuts>[0];

afterEach(() => {
  cleanup();
});

function createVideoRef(): ShortcutOptions["videoRef"] {
  return { current: document.createElement("video") };
}

function createCallbacks() {
  return {
    onTogglePlay: vi.fn(),
    onSeekTo: vi.fn(),
    onVolumeDelta: vi.fn(),
    onToggleMute: vi.fn(),
    onCloseCcPanel: vi.fn(),
    onCloseEpisodeSelector: vi.fn(),
    onUserInteraction: vi.fn(),
  };
}

function createOptions(overrides: Partial<ShortcutOptions> = {}) {
  const callbacks = createCallbacks();

  const options = {
    videoRef: createVideoRef(),
    effectiveTime: 42,
    effectiveDuration: 120,
    isCcPanelOpen: false,
    isEpisodeSelectorOpen: false,
    ...callbacks,
    ...overrides,
  } satisfies ShortcutOptions;

  return { callbacks, options };
}

function renderShortcutHook(overrides: Partial<ShortcutOptions> = {}) {
  const { callbacks, options } = createOptions(overrides);

  const hook = renderHook((props: ShortcutOptions) => useVideoKeyboardShortcuts(props), {
    initialProps: options,
  });

  return {
    ...hook,
    callbacks,
    options,
  };
}

function dispatchKeyDown(key: string, target?: EventTarget | null) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });

  if (target !== undefined) {
    Object.defineProperty(event, "target", {
      configurable: true,
      enumerable: true,
      get: () => target,
    });
  }

  act(() => {
    window.dispatchEvent(event);
  });

  return event;
}

describe("useVideoKeyboardShortcuts", () => {
  it.each([" ", "K"])("toggles playback for key %s", (key) => {
    const { callbacks } = renderShortcutHook();

    const event = dispatchKeyDown(key);

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(callbacks.onUserInteraction).toHaveBeenCalledTimes(1);
  });

  it("seeks backward by 10 seconds and clamps to zero", () => {
    const { callbacks } = renderShortcutHook({ effectiveTime: 5 });

    const event = dispatchKeyDown("ArrowLeft");

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onSeekTo).toHaveBeenCalledWith(0);
    expect(callbacks.onUserInteraction).toHaveBeenCalledTimes(1);
  });

  it("seeks forward by 10 seconds and clamps to the duration", () => {
    const { callbacks } = renderShortcutHook({ effectiveTime: 115, effectiveDuration: 120 });

    const event = dispatchKeyDown("ArrowRight");

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onSeekTo).toHaveBeenCalledWith(120);
    expect(callbacks.onUserInteraction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["ArrowUp", 0.1],
    ["ArrowDown", -0.1],
  ])("adjusts volume for %s", (key, expectedDelta) => {
    const { callbacks } = renderShortcutHook();

    const event = dispatchKeyDown(key);

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onVolumeDelta).toHaveBeenCalledWith(expectedDelta);
    expect(callbacks.onUserInteraction).toHaveBeenCalledTimes(1);
  });

  it("toggles mute for m", () => {
    const { callbacks } = renderShortcutHook();

    const event = dispatchKeyDown("m");

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onToggleMute).toHaveBeenCalledTimes(1);
    expect(callbacks.onUserInteraction).toHaveBeenCalledTimes(1);
  });

  it("closes the closed captions panel before the episode selector on escape", () => {
    const { callbacks } = renderShortcutHook({ isCcPanelOpen: true, isEpisodeSelectorOpen: true });

    const event = dispatchKeyDown("Escape");

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onCloseCcPanel).toHaveBeenCalledTimes(1);
    expect(callbacks.onCloseEpisodeSelector).not.toHaveBeenCalled();
    expect(callbacks.onUserInteraction).toHaveBeenCalledTimes(1);
  });

  it("closes the episode selector on escape when closed captions are already closed", () => {
    const { callbacks } = renderShortcutHook({ isEpisodeSelectorOpen: true });

    const event = dispatchKeyDown("Escape");

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onCloseCcPanel).not.toHaveBeenCalled();
    expect(callbacks.onCloseEpisodeSelector).toHaveBeenCalledTimes(1);
    expect(callbacks.onUserInteraction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["input", () => document.createElement("input")],
    ["textarea", () => document.createElement("textarea")],
    ["select", () => document.createElement("select")],
    ["contenteditable element", () => {
      const element = document.createElement("div");
      Object.defineProperty(element, "isContentEditable", {
        configurable: true,
        value: true,
      });
      return element;
    }],
  ])("ignores shortcuts from %s", (_, createTarget) => {
    const { callbacks } = renderShortcutHook();
    const target = createTarget();

    const event = dispatchKeyDown("k", target);

    expect(event.defaultPrevented).toBe(false);
    expect(callbacks.onTogglePlay).not.toHaveBeenCalled();
    expect(callbacks.onUserInteraction).not.toHaveBeenCalled();
  });

  it("continues to use the latest props after rerendering", () => {
    const firstToggle = vi.fn();
    const secondToggle = vi.fn();
    const firstSeek = vi.fn();
    const secondSeek = vi.fn();

    const { options: initialOptions } = createOptions({
      effectiveTime: 10,
      onTogglePlay: firstToggle,
      onSeekTo: firstSeek,
    });

    const { rerender } = renderHook((props: ShortcutOptions) => useVideoKeyboardShortcuts(props), {
      initialProps: initialOptions,
    });

    rerender({
      ...initialOptions,
      effectiveTime: 25,
      onTogglePlay: secondToggle,
      onSeekTo: secondSeek,
    });

    dispatchKeyDown("k");
    dispatchKeyDown("ArrowLeft");

    expect(firstToggle).not.toHaveBeenCalled();
    expect(secondToggle).toHaveBeenCalledTimes(1);
    expect(firstSeek).not.toHaveBeenCalled();
    expect(secondSeek).toHaveBeenCalledWith(15);
  });

  it("removes the keydown listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderShortcutHook();
    const listener = addSpy.mock.calls.find(([type]) => type === "keydown")?.[1];

    expect(listener).toEqual(expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", listener);
  });
});