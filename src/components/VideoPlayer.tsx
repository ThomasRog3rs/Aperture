"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { EpisodeSelectorPanel } from "@/components/video-player/EpisodeSelectorPanel";
import { SubtitlePanel } from "@/components/video-player/SubtitlePanel";
import { VideoPlayerBottomControls } from "@/components/video-player/VideoPlayerBottomControls";
import { VideoPlayerTopBar } from "@/components/video-player/VideoPlayerTopBar";
import {
  createInitialEpisodeSelectionState,
  createInitialNoticesState,
  createInitialPlaybackState,
  createInitialUiState,
  episodeSelectionReducer,
  noticesReducer,
  playbackReducer,
  uiReducer,
  videoPlayerSelectors,
} from "@/components/video-player/state";
import type {
  MaybeScreenOrientation,
  StreamInfo,
  VideoPlayerProps,
  WebkitVideoElement,
} from "@/components/video-player/types";
import {
  mapPlayerError,
  parseStoredStrategy,
  safePlay,
  safelyHandlePromise,
  playbackModeLabel,
  supportsElementFullscreen,
} from "@/components/video-player/utils";
import { useMediaSessionControls } from "@/hooks/useMediaSessionControls";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { usePlaybackPersistence } from "@/hooks/usePlaybackPersistence";
import { usePointerDrag } from "@/hooks/usePointerDrag";
import { useSubtitleManager } from "@/hooks/useSubtitleManager";
import { useVideoKeyboardShortcuts } from "@/hooks/useVideoKeyboardShortcuts";
import { useVideoCapabilities } from "@/hooks/useVideoCapabilities";
import "@/components/video-player/video-player.css";
import { useAutoHideCursor } from "@/hooks/useAutoHideCursor";

export type {
  VideoPlayerEpisodeListItem,
  VideoPlayerEpisodeListSeason,
  VideoPlayerEpisodeTarget,
  VideoPlayerProps,
} from "@/components/video-player/types";

export function VideoPlayer({
  title,
  streamUrl,
  hlsUrl,
  posterUrl,
  onClose,
  onError,
  onTimeUpdate,
  onEnded,
  startTime,
  onExternalPlayer,
  onPreviousEpisode,
  previousEpisode,
  onNextEpisode,
  nextEpisode,
  episodeSeasons,
  onSelectEpisode,
  mediaType,
  mediaId,
  initialSubtitleId,
  initialSubtitlesEnabled,
  isRandomMode = false,
  onRandomEpisode,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const episodeSelectorButtonRef = useRef<HTMLButtonElement>(null);
  const episodeSelectorPanelRef = useRef<HTMLDivElement>(null);
  const currentEpisodeRef = useRef<HTMLButtonElement>(null);
  const ccButtonRef = useRef<HTMLButtonElement>(null);
  const ccPanelRef = useRef<HTMLDivElement>(null);
  const overflowMenuButtonRef = useRef<HTMLButtonElement>(null);
  const overflowMenuPanelRef = useRef<HTMLDivElement>(null);
  const lastReportedTime = useRef(0);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didSeekToStart = useRef(false);
  const lastFallbackRestartAt = useRef(0);
  const seekToRef = useRef<(targetTime: number) => void>(() => undefined);
  const resetHideTimerRef = useRef<() => void>(() => undefined);

  const [playbackState, dispatchPlayback] = useReducer(
    playbackReducer,
    undefined,
    createInitialPlaybackState
  );
  const [uiState, dispatchUi] = useReducer(uiReducer, undefined, createInitialUiState);
  const [noticesState, dispatchNotices] = useReducer(
    noticesReducer,
    undefined,
    createInitialNoticesState
  );
  const [episodeSelectionState, dispatchEpisodeSelection] = useReducer(
    episodeSelectionReducer,
    undefined,
    createInitialEpisodeSelectionState
  );

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isPiP, setIsPiP] = useState(false);

  const { playbackStrategy, setPlaybackStrategy } = usePlaybackPersistence();
  const {
    supportsNativeHls,
    clientDevice,
    isStandaloneWebApp,
    isPipSupported,
    setIsPipSupported,
    shouldAutoEnterFullscreen,
  } = useVideoCapabilities(videoRef);
  const { state: subtitleState, actions: subtitleActions } = useSubtitleManager({
    mediaId,
    mediaType,
    initialSubtitleId,
    initialSubtitlesEnabled,
    videoRef,
  });

  const requestedHls = streamInfo?.effectiveMode === "hls";
  const shouldUseHls = Boolean(
    hlsUrl && supportsNativeHls && requestedHls && streamInfo?.mode !== "direct"
  );
  const isSeekablePlayback = streamInfo?.mode === "direct" || shouldUseHls;
  const playbackBaseUrl = shouldUseHls && hlsUrl ? hlsUrl : streamUrl;
  const isPlaybackStrategyReady = streamInfo !== null && supportsNativeHls !== null;
  const effectiveDuration = videoPlayerSelectors.effectiveDuration(
    playbackState,
    streamInfo
  );
  const timeOffset = playbackState.timeOffset;
  const effectiveTime = videoPlayerSelectors.effectiveTime(playbackState, timeOffset);
  const progress = videoPlayerSelectors.progress(effectiveTime, effectiveDuration);
  const showClickToPlay = videoPlayerSelectors.showClickToPlay(playbackState, timeOffset);
  const hasActiveSubtitleIndicator =
    videoPlayerSelectors.subtitleIndicator(subtitleState);
  const canBrowseEpisodes = Boolean(onSelectEpisode && episodeSeasons?.length);

  const stopHideTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
      hideControlsTimer.current = null;
    }
  }, []);

  const resetHideTimer = useCallback(() => {
    dispatchPlayback({ type: "set-show-controls", value: true });
    stopHideTimer();
    if (videoPlayerSelectors.panelsOpen(uiState)) return;
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        dispatchPlayback({ type: "set-show-controls", value: false });
      }
    }, 3000);
  }, [stopHideTimer, uiState]);

  const getStreamSrc = useCallback(
    (seekTime?: number) => {
      const base = playbackBaseUrl;
      if (shouldUseHls || isSeekablePlayback || !seekTime || seekTime <= 0) return base;
      const separator = base.includes("?") ? "&" : "?";
      return `${base}${separator}start=${Math.floor(seekTime)}`;
    },
    [isSeekablePlayback, playbackBaseUrl, shouldUseHls]
  );

  const seekTo = useCallback(
    (targetTime: number) => {
      const video = videoRef.current;
      if (!video || !isPlaybackStrategyReady) return;

      if (isSeekablePlayback) {
        video.currentTime = targetTime;
        dispatchPlayback({ type: "set-current-time", value: targetTime });
        return;
      }

      let isBuffered = false;
      const adjustedTarget = targetTime - timeOffset;
      for (let index = 0; index < video.buffered.length; index += 1) {
        if (
          adjustedTarget >= video.buffered.start(index) &&
          adjustedTarget <= video.buffered.end(index)
        ) {
          isBuffered = true;
          break;
        }
      }

      if (isBuffered && adjustedTarget >= 0) {
        video.currentTime = adjustedTarget;
        dispatchPlayback({ type: "set-current-time", value: adjustedTarget });
        return;
      }

      const now = Date.now();
      if (now - lastFallbackRestartAt.current < 1000) return;
      lastFallbackRestartAt.current = now;

      dispatchPlayback({ type: "set-time-offset", value: targetTime });
      dispatchPlayback({ type: "set-current-time", value: 0 });
      dispatchPlayback({ type: "set-loading", value: true });
      video.src = getStreamSrc(targetTime);
      video.load();
      safePlay(video);
    },
    [getStreamSrc, isPlaybackStrategyReady, isSeekablePlayback, timeOffset]
  );

  const skip = useCallback(
    (seconds: number) => {
      seekTo(
        Math.max(0, Math.min(effectiveDuration || Infinity, effectiveTime + seconds))
      );
      resetHideTimer();
    },
    [effectiveDuration, effectiveTime, resetHideTimer, seekTo]
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      safePlay(video);
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    dispatchPlayback({ type: "set-muted", value: video.muted });
  }, []);

  const adjustVolumeByDelta = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(1, Math.max(0, video.volume + delta));
    dispatchPlayback({ type: "set-volume", value: video.volume });
  }, []);

  const closeCcPanel = useCallback(() => {
    dispatchUi({ type: "set-cc-open", value: false });
  }, []);

  const closeEpisodeSelector = useCallback(() => {
    dispatchUi({ type: "set-episode-selector-open", value: false });
  }, []);

  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const value = parseFloat(event.target.value);
      video.volume = value;
      video.muted = value === 0;
      dispatchPlayback({ type: "set-volume", value });
      dispatchPlayback({ type: "set-muted", value: value === 0 });
    },
    []
  );

  const seekToPosition = useCallback(
    (clientX: number) => {
      const bar = progressRef.current;
      if (!bar || !effectiveDuration) return;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      seekTo(fraction * effectiveDuration);
    },
    [effectiveDuration, seekTo]
  );

  const handleProgressPointerDown = usePointerDrag({
    onStart(clientX) {
      dispatchPlayback({ type: "set-dragging", value: true });
      seekToPosition(clientX);
    },
    onMove: seekToPosition,
    onEnd(clientX) {
      if (clientX !== null) seekToPosition(clientX);
      dispatchPlayback({ type: "set-dragging", value: false });
    },
  });

  const setControlsVisible = useCallback(() => {
    dispatchPlayback({ type: "set-show-controls", value: true });
    stopHideTimer();
  }, [stopHideTimer]);

  const getDefaultOpenEpisodeSeasonId = useCallback(() => {
    if (!episodeSeasons?.length) return null;
    return (
      episodeSeasons.find((season) =>
        season.episodes.some((episode) => episode.isCurrent)
      )?.id ??
      episodeSeasons[0]?.id ??
      null
    );
  }, [episodeSeasons]);

  const toggleCcPanel = useCallback(() => {
    setControlsVisible();
    dispatchUi({ type: "set-overflow-open", value: false });
    if (uiState.isEpisodeSelectorOpen) {
      dispatchUi({ type: "set-episode-selector-open", value: false });
    }
    dispatchUi({ type: "set-cc-open", value: !uiState.isCcPanelOpen });
  }, [setControlsVisible, uiState.isCcPanelOpen, uiState.isEpisodeSelectorOpen]);

  const toggleEpisodeSelector = useCallback(() => {
    if (!canBrowseEpisodes) return;
    setControlsVisible();
    dispatchUi({ type: "set-overflow-open", value: false });
    if (uiState.isCcPanelOpen) {
      dispatchUi({ type: "set-cc-open", value: false });
    }
    const nextIsOpen = !uiState.isEpisodeSelectorOpen;
    dispatchUi({ type: "set-episode-selector-open", value: nextIsOpen });
    if (nextIsOpen) {
      dispatchEpisodeSelection({
        type: "set-open-season",
        value: getDefaultOpenEpisodeSeasonId(),
      });
    }
  }, [
    canBrowseEpisodes,
    getDefaultOpenEpisodeSeasonId,
    setControlsVisible,
    uiState.isCcPanelOpen,
    uiState.isEpisodeSelectorOpen,
  ]);

  const handleSelectEpisode = useCallback(
    (episodeId: string) => {
      dispatchUi({ type: "set-episode-selector-open", value: false });
      onSelectEpisode?.(episodeId);
    },
    [onSelectEpisode]
  );

  const toggleEpisodeSeason = useCallback((seasonId: string) => {
    dispatchEpisodeSelection({
      type: "set-open-season",
      value: episodeSelectionState.openSeasonId === seasonId ? null : seasonId,
    });
  }, [episodeSelectionState.openSeasonId]);

  const handlePlaybackStrategyChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = parseStoredStrategy(event.target.value);
      setPlaybackStrategy(next);
      resetHideTimer();
    },
    [resetHideTimer, setPlaybackStrategy]
  );

  const toggleOverflowMenu = useCallback(() => {
    setControlsVisible();
    dispatchUi({
      type: "set-overflow-open",
      value: !uiState.isOverflowMenuOpen,
    });
  }, [setControlsVisible, uiState.isOverflowMenuOpen]);

  useEffect(() => {
    seekToRef.current = seekTo;
  }, [seekTo]);

  useEffect(() => {
    resetHideTimerRef.current = resetHideTimer;
  }, [resetHideTimer]);

  const seekToFromKeyboard = useCallback((targetTime: number) => {
    seekToRef.current(targetTime);
  }, []);

  const resetHideTimerFromKeyboard = useCallback(() => {
    resetHideTimerRef.current();
  }, []);

  useEffect(() => stopHideTimer, [stopHideTimer]);

  useOutsideClick(
    [episodeSelectorPanelRef, episodeSelectorButtonRef],
    uiState.isEpisodeSelectorOpen,
    () => dispatchUi({ type: "set-episode-selector-open", value: false })
  );
  useOutsideClick([ccPanelRef, ccButtonRef], uiState.isCcPanelOpen, () =>
    dispatchUi({ type: "set-cc-open", value: false })
  );
  useOutsideClick(
    [overflowMenuPanelRef, overflowMenuButtonRef],
    uiState.isOverflowMenuOpen,
    () => dispatchUi({ type: "set-overflow-open", value: false })
  );

  useEffect(() => {
    if (!uiState.isEpisodeSelectorOpen) return;
    const timer = setTimeout(() => {
      currentEpisodeRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [uiState.isEpisodeSelectorOpen]);

  useEffect(() => {
    dispatchUi({ type: "set-cc-open", value: false });
  }, [mediaId, mediaType]);

  useEffect(() => {
    let isCancelled = false;
    const infoUrl = streamUrl.replace(/\/stream$/, "/stream/info");
    const params = new URLSearchParams({
      strategy: playbackStrategy,
      device: clientDevice,
    });

    fetch(`${infoUrl}?${params.toString()}`)
      .then((response) => response.json())
      .then((info: StreamInfo) => {
        if (isCancelled) return;
        setStreamInfo(info);
        if (info.duration > 0) {
          dispatchPlayback({ type: "set-duration", value: info.duration });
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setStreamInfo({
          mode: "direct",
          effectiveMode: "direct",
          requestedStrategy: playbackStrategy,
          effectiveStrategy: playbackStrategy,
          duration: 0,
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [clientDevice, playbackStrategy, streamUrl]);

  useEffect(() => {
    if (!streamInfo || supportsNativeHls === null) {
      dispatchNotices({ type: "set-playback-notice", value: null });
      return;
    }

    if (
      playbackStrategy === "hls" &&
      streamInfo.mode !== "direct" &&
      streamInfo.effectiveMode === "hls" &&
      !supportsNativeHls
    ) {
      dispatchNotices({
        type: "set-playback-notice",
        value: "HLS is not supported by this browser. Using Classic fallback.",
      });
      return;
    }

    if (
      streamInfo.requestedStrategy &&
      streamInfo.effectiveStrategy &&
      streamInfo.requestedStrategy !== streamInfo.effectiveStrategy
    ) {
      dispatchNotices({
        type: "set-playback-notice",
        value: `${playbackModeLabel(streamInfo.requestedStrategy)} is not available here. Using ${playbackModeLabel(streamInfo.effectiveStrategy)}.`,
      });
      return;
    }

    dispatchNotices({ type: "set-playback-notice", value: null });
  }, [playbackStrategy, streamInfo, supportsNativeHls]);

  useEffect(() => {
    const video = videoRef.current;
    didSeekToStart.current = false;
    lastReportedTime.current = 0;
    lastFallbackRestartAt.current = 0;
    dispatchPlayback({ type: "reset-for-source" });
    dispatchUi({ type: "set-episode-selector-open", value: false });
    dispatchEpisodeSelection({ type: "reset" });

    if (!video) return;

    video.pause();
    if (!isPlaybackStrategyReady) {
      video.removeAttribute("src");
      video.load();
      return;
    }

    video.src = playbackBaseUrl;
    video.load();
    safePlay(video);
  }, [isPlaybackStrategyReady, playbackBaseUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !startTime || startTime <= 0 || !streamInfo || !isPlaybackStrategyReady) {
      return;
    }

    if (!isSeekablePlayback) {
      if (!didSeekToStart.current) {
        didSeekToStart.current = true;
        dispatchPlayback({ type: "set-time-offset", value: startTime });
        video.src = getStreamSrc(startTime);
        video.load();
        safePlay(video);
      }
      return;
    }

    const onLoaded = () => {
      if (!didSeekToStart.current) {
        didSeekToStart.current = true;
        video.currentTime = startTime;
      }
    };

    if (video.readyState >= 1) {
      onLoaded();
    } else {
      video.addEventListener("loadedmetadata", onLoaded);
      return () => video.removeEventListener("loadedmetadata", onLoaded);
    }
  }, [
    getStreamSrc,
    isPlaybackStrategyReady,
    isSeekablePlayback,
    startTime,
    streamInfo,
  ]);

  const enterFullscreen = useCallback(() => {
    const element = containerRef.current;
    if (!supportsElementFullscreen(element)) return;
    if (document.fullscreenElement === element) return;
    try {
      safelyHandlePromise(element.requestFullscreen());
    } catch {}
  }, []);

  useEffect(() => {
    if (!shouldAutoEnterFullscreen) return;
    enterFullscreen();
  }, [enterFullscreen, shouldAutoEnterFullscreen]);

  useEffect(() => {
    if (clientDevice !== "mobile") return;
    const orientation =
      (screen.orientation as MaybeScreenOrientation | undefined) ?? undefined;
    const lock = orientation?.lock;
    if (typeof lock !== "function") return;

    const lockLandscape = () => {
      safelyHandlePromise(lock.call(orientation, "landscape"));
    };

    lockLandscape();
    document.addEventListener("fullscreenchange", lockLandscape);

    return () => {
      document.removeEventListener("fullscreenchange", lockLandscape);
      const unlock = orientation?.unlock;
      try {
        if (typeof unlock === "function") {
          unlock.call(orientation);
        }
      } catch {}
    };
  }, [clientDevice]);

  useEffect(() => {
    if (!shouldAutoEnterFullscreen) return;
    const element = containerRef.current;
    if (!supportsElementFullscreen(element)) return;

    const handleFullscreenChange = () => {
      if (document.fullscreenElement !== element && !isPiP) {
        onClose();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isPiP, onClose, shouldAutoEnterFullscreen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPictureInPicture = () => {
      setIsPiP(true);
      dispatchNotices({ type: "set-player-notice", value: null });
    };
    const handleLeavePictureInPicture = () => setIsPiP(false);
    const handlePresentationModeChange = () => {
      const webkitVideo = video as WebkitVideoElement;
      const isPictureInPicture =
        webkitVideo.webkitPresentationMode === "picture-in-picture";
      setIsPiP(isPictureInPicture);
      if (isPictureInPicture) {
        dispatchNotices({ type: "set-player-notice", value: null });
      }
    };

    video.addEventListener("enterpictureinpicture", handleEnterPictureInPicture);
    video.addEventListener("leavepictureinpicture", handleLeavePictureInPicture);
    video.addEventListener(
      "webkitpresentationmodechanged",
      handlePresentationModeChange
    );

    return () => {
      video.removeEventListener(
        "enterpictureinpicture",
        handleEnterPictureInPicture
      );
      video.removeEventListener(
        "leavepictureinpicture",
        handleLeavePictureInPicture
      );
      video.removeEventListener(
        "webkitpresentationmodechanged",
        handlePresentationModeChange
      );
    };
  }, []);

  const handleTogglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const webkitVideo = video as WebkitVideoElement;
    dispatchNotices({ type: "set-player-notice", value: null });

    try {
      if (isPiP) {
        if (typeof document.exitPictureInPicture === "function") {
          await document.exitPictureInPicture();
        } else if (typeof webkitVideo.webkitSetPresentationMode === "function") {
          webkitVideo.webkitSetPresentationMode("inline");
        }
      } else if (typeof video.requestPictureInPicture === "function") {
        await video.requestPictureInPicture();
      } else if (typeof webkitVideo.webkitSetPresentationMode === "function") {
        webkitVideo.webkitSetPresentationMode("picture-in-picture");
      }
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "UnknownError";
      const message = error instanceof Error ? error.message : "Unknown failure";
      const notice = mapPlayerError(error, { isStandaloneWebApp });

      console.warn("Aperture PiP request failed", {
        name,
        message,
        isStandaloneWebApp,
        isFullscreen: document.fullscreenElement === containerRef.current,
        presentationMode: webkitVideo.webkitPresentationMode ?? "unknown",
        readyState: video.readyState,
        paused: video.paused,
      });

      if (name === "NotSupportedError") {
        setIsPipSupported(false);
      }

      dispatchNotices({ type: "set-player-notice", value: notice });
      if (!isPiP) {
        onError?.(notice);
      }
    }
  }, [isPiP, isStandaloneWebApp, onError, setIsPipSupported]);

  useMediaSessionControls({
    title,
    posterUrl,
    isPlaying: playbackState.isPlaying,
    effectiveTime,
    effectiveDuration,
    onPlay: () => {
      const video = videoRef.current;
      if (video) safePlay(video);
    },
    onPause: () => {
      const video = videoRef.current;
      if (video) video.pause();
    },
    onSeek: skip,
    onPreviousEpisode,
    onNextEpisode,
  });

  useVideoKeyboardShortcuts({
    videoRef,
    effectiveTime,
    effectiveDuration,
    isCcPanelOpen: uiState.isCcPanelOpen,
    isEpisodeSelectorOpen: uiState.isEpisodeSelectorOpen,
    onTogglePlay: togglePlay,
    onSeekTo: seekToFromKeyboard,
    onVolumeDelta: adjustVolumeByDelta,
    onToggleMute: toggleMute,
    onCloseCcPanel: closeCcPanel,
    onCloseEpisodeSelector: closeEpisodeSelector,
    onUserInteraction: resetHideTimerFromKeyboard,
  });

  useAutoHideCursor(containerRef, playbackState, resetHideTimerRef);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || playbackState.isDragging) return;
    dispatchPlayback({ type: "set-current-time", value: video.currentTime });

    const reportedTime = video.currentTime + timeOffset;
    if (onTimeUpdate && Math.abs(reportedTime - lastReportedTime.current) >= 5) {
      lastReportedTime.current = reportedTime;
      onTimeUpdate(reportedTime, effectiveDuration);
    }
  }, [effectiveDuration, onTimeUpdate, playbackState.isDragging, timeOffset]);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return;
    const end = video.buffered.end(video.buffered.length - 1);
    if (isSeekablePlayback) {
      dispatchPlayback({
        type: "set-buffered",
        value: video.duration > 0 ? end / video.duration : 0,
      });
      return;
    }
    dispatchPlayback({
      type: "set-buffered",
      value: effectiveDuration > 0 ? (end + timeOffset) / effectiveDuration : 0,
    });
  }, [effectiveDuration, isSeekablePlayback, timeOffset]);

  return (
    <div
      ref={containerRef}
      className="group fixed inset-0 z-50 w-full overflow-hidden rounded-none border-none bg-black shadow-2xl transition-all select-none"
      onMouseMove={resetHideTimer}
      onPointerDown={resetHideTimer}
      onMouseLeave={() => {
        if (
          !videoRef.current?.paused &&
          !uiState.isEpisodeSelectorOpen &&
          !uiState.isCcPanelOpen
        ) {
          dispatchPlayback({ type: "set-show-controls", value: false });
        }
      }}
    >
      <video
        ref={videoRef}
        className="h-full w-full cursor-pointer bg-black object-contain"
        poster={posterUrl}
        playsInline
        autoPlay
        onClick={togglePlay}
        onPlay={() => {
          dispatchPlayback({ type: "set-playing", value: true });
          resetHideTimer();
        }}
        onPause={() => {
          dispatchPlayback({ type: "set-playing", value: false });
          dispatchPlayback({ type: "set-show-controls", value: true });
        }}
        onEnded={() => {
          const video = videoRef.current;
          const endedTime = video ? video.currentTime + timeOffset : effectiveTime;
          const endedDuration =
            effectiveDuration > 0
              ? effectiveDuration
              : video?.duration && isFinite(video.duration)
                ? video.duration + timeOffset
                : 0;
          dispatchPlayback({ type: "set-playing", value: false });
          dispatchPlayback({ type: "set-show-controls", value: true });
          onEnded?.(endedTime, endedDuration);
        }}
        onTimeUpdate={handleVideoTimeUpdate}
        onDurationChange={() => {
          const duration = videoRef.current?.duration;
          if (duration && isFinite(duration) && duration > 0 && isSeekablePlayback) {
            dispatchPlayback({ type: "set-duration", value: duration });
          }
        }}
        onProgress={handleProgress}
        onWaiting={() => dispatchPlayback({ type: "set-loading", value: true })}
        onCanPlay={() => dispatchPlayback({ type: "set-loading", value: false })}
        onSeeking={() => dispatchPlayback({ type: "set-loading", value: true })}
        onSeeked={() => dispatchPlayback({ type: "set-loading", value: false })}
        onError={() => {
          onError?.("Browser cannot play this file format. Try the external player.");
        }}
      />

      {playbackState.isLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-white/80" />
        </div>
      ) : null}

      {noticesState.playbackNotice || noticesState.playerNotice ? (
        <div className="absolute left-1/2 top-4 z-30 flex w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2">
          {noticesState.playbackNotice ? (
            <div className="rounded-xl border border-amber-300/35 bg-black/75 px-4 py-2 text-center text-xs text-amber-100 backdrop-blur">
              {noticesState.playbackNotice}
            </div>
          ) : null}
          {noticesState.playerNotice ? (
            <div className="rounded-xl border border-red-300/35 bg-black/80 px-4 py-2 text-center text-xs text-red-100 backdrop-blur">
              {noticesState.playerNotice}
            </div>
          ) : null}
        </div>
      ) : null}

      {showClickToPlay ? (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Play className="ml-1 h-8 w-8 fill-white text-white" />
          </div>
        </button>
      ) : null}

      {uiState.isCcPanelOpen && mediaId ? (
        <SubtitlePanel
          panelRef={ccPanelRef}
          subtitleState={subtitleState}
          onClose={() => dispatchUi({ type: "set-cc-open", value: false })}
          onToggleCc={subtitleActions.toggleSubtitles}
          onSelectSubtitle={subtitleActions.selectSubtitle}
          onDeleteSubtitle={(subtitleId) => void subtitleActions.deleteSubtitle(subtitleId)}
          onSearchQueryChange={subtitleActions.setSubtitleSearchQuery}
          onSearchLanguageChange={subtitleActions.setSubtitleSearchLanguage}
          onSearch={() => void subtitleActions.searchSubtitles()}
          onDownloadSubtitle={(result) => void subtitleActions.downloadSubtitle(result)}
        />
      ) : null}

      {uiState.isEpisodeSelectorOpen && canBrowseEpisodes ? (
        <EpisodeSelectorPanel
          panelRef={episodeSelectorPanelRef}
          currentEpisodeRef={currentEpisodeRef}
          episodeSeasons={episodeSeasons}
          openEpisodeSeasonId={episodeSelectionState.openSeasonId}
          onClose={() =>
            dispatchUi({ type: "set-episode-selector-open", value: false })
          }
          onToggleSeason={toggleEpisodeSeason}
          onSelectEpisode={handleSelectEpisode}
        />
      ) : null}

      <VideoPlayerTopBar
        title={title}
        showControls={playbackState.showControls}
        onExternalPlayer={onExternalPlayer}
        isPipSupported={isPipSupported}
        isPiP={isPiP}
        onTogglePiP={() => void handleTogglePiP()}
      />

      <VideoPlayerBottomControls
        showControls={playbackState.showControls}
        progressRef={progressRef}
        overflowMenuButtonRef={overflowMenuButtonRef}
        overflowMenuPanelRef={overflowMenuPanelRef}
        ccButtonRef={ccButtonRef}
        episodeSelectorButtonRef={episodeSelectorButtonRef}
        buffered={playbackState.buffered}
        progress={progress}
        isPlaying={playbackState.isPlaying}
        isMuted={playbackState.isMuted}
        volume={playbackState.volume}
        effectiveTime={effectiveTime}
        effectiveDuration={effectiveDuration}
        clientDevice={clientDevice}
        playbackStrategy={playbackStrategy}
        streamInfo={streamInfo}
        mediaId={mediaId}
        isCcPanelOpen={uiState.isCcPanelOpen}
        isEpisodeSelectorOpen={uiState.isEpisodeSelectorOpen}
        isOverflowMenuOpen={uiState.isOverflowMenuOpen}
        hasActiveSubtitleIndicator={hasActiveSubtitleIndicator}
        canBrowseEpisodes={canBrowseEpisodes}
        isRandomMode={isRandomMode}
        previousEpisode={previousEpisode}
        nextEpisode={nextEpisode}
        onProgressPointerDown={handleProgressPointerDown}
        onTogglePlay={togglePlay}
        onSkip={skip}
        onToggleMute={toggleMute}
        onVolumeChange={handleVolumeChange}
        onPlaybackStrategyChange={handlePlaybackStrategyChange}
        onToggleCcPanel={toggleCcPanel}
        onToggleEpisodeSelector={toggleEpisodeSelector}
        onToggleOverflowMenu={toggleOverflowMenu}
        onPreviousEpisode={onPreviousEpisode}
        onNextEpisode={onNextEpisode}
        onRandomEpisode={onRandomEpisode}
        onClose={onClose}
      />
    </div>
  );
}
