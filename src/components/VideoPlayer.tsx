"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Monitor,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Loader2,
  SkipBack,
  SkipForward,
  ListVideo,
  Check,
  ChevronDown,
  Captions,
  Search,
  Download,
  Trash2,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import type { SubtitleFile, SubtitleSearchResult } from "@/lib/types";

export type VideoPlayerEpisodeTarget = {
  id: string;
  title: string;
  subtitle: string;
};

export type VideoPlayerEpisodeListItem = VideoPlayerEpisodeTarget & {
  numberLabel: string;
  watched: boolean;
  isCurrent: boolean;
};

export type VideoPlayerEpisodeListSeason = {
  id: string;
  title: string;
  subtitle?: string;
  episodes: VideoPlayerEpisodeListItem[];
};

export type VideoPlayerProps = {
  title: string;
  streamUrl: string;
  hlsUrl?: string;
  posterUrl?: string;
  thumbnailsVttUrl?: string;
  onClose: () => void;
  onError?: (message: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: (currentTime: number, duration: number) => void;
  startTime?: number;
  onExternalPlayer?: () => void;
  onPreviousEpisode?: () => void;
  previousEpisode?: VideoPlayerEpisodeTarget;
  onNextEpisode?: () => void;
  nextEpisode?: VideoPlayerEpisodeTarget;
  episodeSeasons?: VideoPlayerEpisodeListSeason[];
  onSelectEpisode?: (episodeId: string) => void;
  mediaType?: "movie" | "episode";
  mediaId?: string;
  initialSubtitleId?: string | null;
  initialSubtitlesEnabled?: boolean;
};

type StreamInfo = {
  mode: "direct" | "remux" | "transcode";
  requestedStrategy?: "auto" | "classic" | "hls";
  effectiveStrategy?: "auto" | "classic" | "hls";
  effectiveMode?: "direct" | "hls" | "live";
  fallbackReason?: string;
  duration: number;
};

type PlaybackStrategy = "auto" | "classic" | "hls";
type ClientDevice = "desktop" | "mobile";
type OrientationLock = "any" | "natural" | "landscape" | "portrait";
type MaybeScreenOrientation = {
  lock?: (orientation: OrientationLock) => Promise<void>;
  unlock?: () => void;
};

const PLAYBACK_STRATEGY_STORAGE_KEY = "aperture.playback.strategy.v1";

function detectClientDevice(): ClientDevice {
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

function parseStoredStrategy(value: string | null): PlaybackStrategy {
  if (value === "classic" || value === "hls") return value;
  return "auto";
}

function playbackModeLabel(mode: PlaybackStrategy) {
  if (mode === "classic") return "Classic";
  if (mode === "hls") return "HLS";
  return "Auto";
}

type PromiseLikeResult = Promise<void> | void;

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function safelyHandlePromise(result: PromiseLikeResult) {
  if (!result || typeof result.catch !== "function") return;
  void result.catch(() => {});
}

function safePlay(video: HTMLVideoElement) {
  try {
    safelyHandlePromise(video.play());
  } catch {}
}

function supportsNativeHlsPlayback() {
  if (typeof document === "undefined") return false;
  const video = document.createElement("video");
  return (
    video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
    video.canPlayType("application/x-mpegURL") !== ""
  );
}

function supportsElementFullscreen(
  element: HTMLDivElement | null
): element is HTMLDivElement & {
  requestFullscreen: () => Promise<void>;
} {
  return Boolean(element && typeof element.requestFullscreen === "function");
}

type PlayerHoverCardProps = {
  label: string;
  target?: VideoPlayerEpisodeTarget;
  align?: "left" | "right";
};

function PlayerHoverCard({
  label,
  target,
  align = "right",
}: PlayerHoverCardProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-full z-30 mb-3 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface/95 p-4 text-left shadow-2xl backdrop-blur-xl transition-all duration-200 ${
        align === "left" ? "left-0" : "right-0"
      } translate-y-2 opacity-0 peer-hover:translate-y-0 peer-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100`}
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-faint">{label}</p>
      {target ? (
        <div className="mt-2 space-y-1">
          <p className="text-base font-semibold text-foreground">{target.title}</p>
          <p className="text-sm text-muted">{target.subtitle}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No episode available.</p>
      )}
    </div>
  );
}

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
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const episodeSelectorButtonRef = useRef<HTMLButtonElement>(null);
  const episodeSelectorPanelRef = useRef<HTMLDivElement>(null);
  const currentEpisodeRef = useRef<HTMLButtonElement>(null);
  const ccButtonRef = useRef<HTMLButtonElement>(null);
  const ccPanelRef = useRef<HTMLDivElement>(null);
  const lastReportedTime = useRef(0);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didSeekToStart = useRef(false);
  const lastFallbackRestartAt = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
  const [openEpisodeSeasonId, setOpenEpisodeSeasonId] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  // Subtitle state
  const [subtitles, setSubtitles] = useState<SubtitleFile[]>([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [isCcPanelOpen, setIsCcPanelOpen] = useState(false);
  const [subtitleSearchQuery, setSubtitleSearchQuery] = useState("");
  const [subtitleSearchLanguage, setSubtitleSearchLanguage] = useState("en");
  const [subtitleSearchResults, setSubtitleSearchResults] = useState<SubtitleSearchResult[]>([]);
  const [subtitleSearchLoading, setSubtitleSearchLoading] = useState(false);
  const [subtitleSearchError, setSubtitleSearchError] = useState<string | null>(null);
  const [subtitleDownloadingId, setSubtitleDownloadingId] = useState<number | null>(null);
  const [subtitleDeletingId, setSubtitleDeletingId] = useState<string | null>(null);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);

  // Stream mode describes the server-side transport. Some browsers can play the
  // transcoded fallback through native HLS, which is seekable like direct play.
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [supportsNativeHls, setSupportsNativeHls] = useState<boolean | null>(null);
  const [clientDevice, setClientDevice] = useState<ClientDevice>("desktop");
  const [playbackStrategy, setPlaybackStrategy] = useState<PlaybackStrategy>("auto");
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  // Time offset when we restart a transcoded stream at a non-zero position
  const [timeOffset, setTimeOffset] = useState(0);

  const requestedHls = streamInfo?.effectiveMode === "hls";
  const shouldUseHls = Boolean(
    hlsUrl && supportsNativeHls && requestedHls && streamInfo?.mode !== "direct"
  );
  const isSeekablePlayback = streamInfo?.mode === "direct" || shouldUseHls;
  const playbackBaseUrl = shouldUseHls && hlsUrl ? hlsUrl : streamUrl;
  const isPlaybackStrategyReady = streamInfo !== null && supportsNativeHls !== null;

  useEffect(() => {
    setSupportsNativeHls(supportsNativeHlsPlayback());
    setClientDevice(detectClientDevice());
    try {
      setPlaybackStrategy(parseStoredStrategy(localStorage.getItem(PLAYBACK_STRATEGY_STORAGE_KEY)));
    } catch {
      setPlaybackStrategy("auto");
    }
  }, []);

  // Fetch stream info on mount to determine playback mode
  useEffect(() => {
    let isCancelled = false;
    const infoUrl = streamUrl.replace(/\/stream$/, "/stream/info");
    const params = new URLSearchParams({
      strategy: playbackStrategy,
      device: clientDevice,
    });
    fetch(`${infoUrl}?${params.toString()}`)
      .then((r) => r.json())
      .then((info: StreamInfo) => {
        if (isCancelled) return;
        setStreamInfo(info);
        if (info.duration > 0) setDuration(info.duration);
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
  }, [streamUrl, playbackStrategy, clientDevice]);

  useEffect(() => {
    if (!streamInfo || supportsNativeHls === null) {
      setPlaybackNotice(null);
      return;
    }

    if (
      playbackStrategy === "hls" &&
      streamInfo.mode !== "direct" &&
      streamInfo.effectiveMode === "hls" &&
      !supportsNativeHls
    ) {
      setPlaybackNotice("HLS is not supported by this browser. Using Classic fallback.");
      return;
    }

    if (
      streamInfo.requestedStrategy &&
      streamInfo.effectiveStrategy &&
      streamInfo.requestedStrategy !== streamInfo.effectiveStrategy
    ) {
      setPlaybackNotice(
        `${playbackModeLabel(streamInfo.requestedStrategy)} is not available here. Using ${playbackModeLabel(streamInfo.effectiveStrategy)}.`
      );
      return;
    }

    setPlaybackNotice(null);
  }, [streamInfo, supportsNativeHls, playbackStrategy]);

  // Build the effective video src (with ?start= only for the live fragmented MP4 path)
  const getStreamSrc = useCallback(
    (seekTime?: number) => {
      const base = playbackBaseUrl;
      if (shouldUseHls || isSeekablePlayback || !seekTime || seekTime <= 0) return base;
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}start=${Math.floor(seekTime)}`;
    },
    [playbackBaseUrl, shouldUseHls, isSeekablePlayback]
  );

  // Effective time for display = video.currentTime + timeOffset
  const effectiveTime = currentTime + timeOffset;
  const effectiveDuration =
    duration > 0
      ? duration
      : streamInfo?.duration && streamInfo.duration > 0
        ? streamInfo.duration
        : 0;
  const progress =
    effectiveDuration > 0 ? effectiveTime / effectiveDuration : 0;

  // Auto-hide controls after 3s of inactivity during playback
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isEpisodeSelectorOpen || isCcPanelOpen) return;
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, [isEpisodeSelectorOpen, isCcPanelOpen]);

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isEpisodeSelectorOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (episodeSelectorPanelRef.current?.contains(target)) return;
      if (episodeSelectorButtonRef.current?.contains(target)) return;
      setIsEpisodeSelectorOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isEpisodeSelectorOpen]);

  useEffect(() => {
    if (!isEpisodeSelectorOpen) return;
    const timer = setTimeout(() => {
      currentEpisodeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 250);
    return () => clearTimeout(timer);
  }, [isEpisodeSelectorOpen]);

  useEffect(() => {
    if (!isCcPanelOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ccPanelRef.current?.contains(target)) return;
      if (ccButtonRef.current?.contains(target)) return;
      setIsCcPanelOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isCcPanelOpen]);

  // Load and reconcile subtitle list when mediaId changes
  useEffect(() => {
    setSubtitles([]);
    setActiveSubtitleId(null);
    setSubtitlesEnabled(false);
    setIsCcPanelOpen(false);
    setSubtitleSearchResults([]);
    setSubtitleSearchError(null);
    setSubtitleError(null);

    if (!mediaId || !mediaType) return;

    let cancelled = false;
    const endpoint = mediaType === "movie" ? "movies" : "episodes";

    fetch(`/api/${endpoint}/${mediaId}/subtitles`)
      .then((r) => r.json())
      .then((data: { subtitles?: SubtitleFile[] }) => {
        if (cancelled) return;
        const list = data.subtitles ?? [];
        setSubtitles(list);

        if (initialSubtitleId) {
          const found = list.find((s) => s.id === initialSubtitleId);
          if (found) {
            setActiveSubtitleId(initialSubtitleId);
            setSubtitlesEnabled(initialSubtitlesEnabled ?? false);
            return;
          }
        }

        // Auto-select English subtitle (but keep disabled by default)
        const englishSub = list.find((s) => s.language === "en");
        if (englishSub) {
          setActiveSubtitleId(englishSub.id);
          setSubtitlesEnabled(false);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [mediaId, mediaType, initialSubtitleId, initialSubtitlesEnabled]);

  // Manage <track> element on the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!activeSubtitleId || !subtitlesEnabled) {
      // Disable any existing text tracks
      Array.from(video.textTracks).forEach((t) => {
        t.mode = "disabled";
      });
      return;
    }

    // Remove any existing track elements we previously added
    const existingTracks = Array.from(video.querySelectorAll("track[data-aperture-subtitle]"));
    existingTracks.forEach((t) => t.remove());

    const trackEl = document.createElement("track");
    trackEl.setAttribute("data-aperture-subtitle", "1");
    trackEl.kind = "subtitles";
    trackEl.src = `/api/subtitles/${activeSubtitleId}/track`;
    trackEl.default = true;
    video.appendChild(trackEl);

    const enableTrack = () => {
      if (trackEl.track) trackEl.track.mode = "showing";
    };
    trackEl.addEventListener("load", enableTrack);
    // Also try immediately
    enableTrack();

    return () => {
      trackEl.removeEventListener("load", enableTrack);
      if (video.contains(trackEl)) {
        video.removeChild(trackEl);
      }
      Array.from(video.textTracks).forEach((t) => {
        t.mode = "disabled";
      });
    };
  }, [activeSubtitleId, subtitlesEnabled]);

  // Persist subtitle preference to server
  const saveSubtitlePreference = useCallback(
    (subId: string | null, enabled: boolean) => {
      if (!mediaId || !mediaType) return;
      const endpoint = mediaType === "movie" ? "movies" : "episodes";
      fetch(`/api/${endpoint}/${mediaId}/subtitles/preference`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedSubtitleId: subId, enabled }),
      }).catch(() => {});
    },
    [mediaId, mediaType]
  );
  // We reset per-episode playback state here so switching episodes keeps the
  // fullscreen container mounted while clearing stale timing/loading values.
  useEffect(() => {
    const video = videoRef.current;
    didSeekToStart.current = false;
    lastReportedTime.current = 0;
    setIsEpisodeSelectorOpen(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setTimeOffset(0);
    lastFallbackRestartAt.current = 0;
    setShowControls(true);
    setIsLoading(true);
    setIsSeeking(false);
    setIsDragging(false);
    setIsPlaying(false);

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
  }, [playbackBaseUrl, isPlaybackStrategyReady]);
  // Seek to startTime once metadata is loaded for direct play/native HLS.
  // The live fragmented MP4 fallback still requires ?start= reloads.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !startTime || startTime <= 0 || !streamInfo || !isPlaybackStrategyReady)
      return;

    if (!isSeekablePlayback) {
      if (!didSeekToStart.current) {
        didSeekToStart.current = true;
        setTimeOffset(startTime);
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
  }, [startTime, streamInfo, isSeekablePlayback, getStreamSrc, isPlaybackStrategyReady]);
  // Unified seek function for both seekable playback and the live MP4 fallback
  const seekTo = useCallback(
    (targetTime: number) => {
      const video = videoRef.current;
      if (!video || !isPlaybackStrategyReady) return;

      if (isSeekablePlayback) {
        video.currentTime = targetTime;
        setCurrentTime(targetTime);
        return;
      }

      // For transcoded streams, check if target is in the buffered range
      let isBuffered = false;
      const adjustedTarget = targetTime - timeOffset;
      for (let i = 0; i < video.buffered.length; i++) {
        if (
          adjustedTarget >= video.buffered.start(i) &&
          adjustedTarget <= video.buffered.end(i)
        ) {
          isBuffered = true;
          break;
        }
      }

      if (isBuffered && adjustedTarget >= 0) {
        video.currentTime = adjustedTarget;
        setCurrentTime(adjustedTarget);
      } else {
        const now = Date.now();
        // Guard against rapid scrub restarts while ffmpeg spins up a new stream.
        if (now - lastFallbackRestartAt.current < 1000) return;
        lastFallbackRestartAt.current = now;

        // Reload with new start position
        setTimeOffset(targetTime);
        setCurrentTime(0);
        setIsLoading(true);
        video.src = getStreamSrc(targetTime);
        video.load();
        safePlay(video);
      }
    },
    [isPlaybackStrategyReady, isSeekablePlayback, timeOffset, getStreamSrc]
  );

  const enterFullscreen = useCallback(() => {
    const el = containerRef.current;
    // requestFullscreen on a <div> is not supported on iOS Safari — skip silently.
    // The player uses viewport-fit=cover + fixed inset-0 for edge-to-edge display instead.
    if (!supportsElementFullscreen(el)) return;
    if (document.fullscreenElement === el) return;
    try {
      safelyHandlePromise(el.requestFullscreen());
    } catch {}
  }, []);

  useEffect(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  // Prevent iOS Safari rubber-band scroll while the player is open
  useEffect(() => {
    document.body.classList.add("no-overscroll");
    return () => document.body.classList.remove("no-overscroll");
  }, []);

  // Detect portrait orientation on mobile. screen.orientation.lock() is not
  // supported on iOS Safari, so we show a prompt instead.
  useEffect(() => {
    if (clientDevice !== "mobile") return;
    const mq = window.matchMedia("(orientation: portrait)");
    setIsPortrait(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsPortrait(e.matches);
      // Re-show the prompt if user rotates back to portrait
      if (!e.matches) setPortraitDismissed(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [clientDevice]);

  useEffect(() => {
    if (clientDevice !== "mobile") return;
    const orientation = (screen.orientation as MaybeScreenOrientation | undefined) ??
      undefined;
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
    const el = containerRef.current;
    if (!supportsElementFullscreen(el)) return;

    const handleFullscreenChange = () => {
      if (document.fullscreenElement !== el) {
        onClose();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (video.paused) {
            safePlay(video);
          } else {
            video.pause();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekTo(Math.max(0, effectiveTime - 10));
          break;
        case "ArrowRight":
          e.preventDefault();
          seekTo(Math.min(effectiveDuration || Infinity, effectiveTime + 10));
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
        case "m":
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case "Escape":
          if (isCcPanelOpen) {
            e.preventDefault();
            setIsCcPanelOpen(false);
            break;
          }
          if (isEpisodeSelectorOpen) {
            e.preventDefault();
            setIsEpisodeSelectorOpen(false);
            break;
          }
          break;
      }
      resetHideTimer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isEpisodeSelectorOpen,
    isCcPanelOpen,
    resetHideTimer,
    effectiveTime,
    effectiveDuration,
    seekTo,
  ]);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || isDragging) return;
    setCurrentTime(video.currentTime);

    const effective = video.currentTime + timeOffset;
    if (onTimeUpdate && Math.abs(effective - lastReportedTime.current) >= 5) {
      lastReportedTime.current = effective;
      onTimeUpdate(effective, effectiveDuration);
    }
  }, [onTimeUpdate, isDragging, timeOffset, effectiveDuration]);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return;
    const end = video.buffered.end(video.buffered.length - 1);
    if (isSeekablePlayback) {
      setBuffered(video.duration > 0 ? end / video.duration : 0);
    } else {
      setBuffered(
        effectiveDuration > 0 ? (end + timeOffset) / effectiveDuration : 0
      );
    }
  }, [isSeekablePlayback, effectiveDuration, timeOffset]);

  // Scrub bar: click / drag to seek
  const seekToPosition = useCallback(
    (clientX: number) => {
      const bar = progressRef.current;
      if (!bar || !effectiveDuration) return;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      const newTime = fraction * effectiveDuration;
      seekTo(newTime);
    },
    [effectiveDuration, seekTo]
  );

  const handleProgressPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      setIsDragging(true);
      seekToPosition(e.clientX);

      const handlePointerMove = (ev: PointerEvent) => seekToPosition(ev.clientX);
      const stopDragging = () => {
        setIsDragging(false);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
      };
      const handlePointerUp = (ev: PointerEvent) => {
        seekToPosition(ev.clientX);
        stopDragging();
      };
      const handlePointerCancel = () => {
        stopDragging();
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [seekToPosition]
  );

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const val = parseFloat(e.target.value);
      video.volume = val;
      video.muted = val === 0;
      setVolume(val);
      setIsMuted(val === 0);
    },
    []
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

  const skip = useCallback(
    (seconds: number) => {
      seekTo(
        Math.max(
          0,
          Math.min(effectiveDuration || Infinity, effectiveTime + seconds)
        )
      );
      resetHideTimer();
    },
    [seekTo, effectiveTime, effectiveDuration, resetHideTimer]
  );

  const canBrowseEpisodes = Boolean(onSelectEpisode && episodeSeasons?.length);

  // Subtitle action handlers
  const handleSelectSubtitle = useCallback(
    (subtitleId: string) => {
      setActiveSubtitleId(subtitleId);
      setSubtitlesEnabled(true);
      saveSubtitlePreference(subtitleId, true);
    },
    [saveSubtitlePreference]
  );

  const handleToggleCc = useCallback(() => {
    if (!activeSubtitleId) return;
    const newEnabled = !subtitlesEnabled;
    setSubtitlesEnabled(newEnabled);
    saveSubtitlePreference(activeSubtitleId, newEnabled);
  }, [subtitlesEnabled, activeSubtitleId, saveSubtitlePreference]);

  const handleSubtitleSearch = useCallback(async () => {
    if (!mediaId || !mediaType) return;
    setSubtitleSearchLoading(true);
    setSubtitleSearchError(null);
    const endpoint = mediaType === "movie" ? "movies" : "episodes";
    try {
      const response = await fetch(`/api/${endpoint}/${mediaId}/subtitles/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: subtitleSearchQuery || undefined,
          language: subtitleSearchLanguage,
        }),
      });
      const data = (await response.json()) as {
        results?: SubtitleSearchResult[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Search failed.");
      setSubtitleSearchResults(data.results ?? []);
    } catch (error) {
      setSubtitleSearchError(
        error instanceof Error ? error.message : "Search failed."
      );
    } finally {
      setSubtitleSearchLoading(false);
    }
  }, [mediaId, mediaType, subtitleSearchQuery, subtitleSearchLanguage]);

  const handleDownloadSubtitle = useCallback(
    async (result: SubtitleSearchResult) => {
      if (!mediaId || !mediaType) return;
      setSubtitleDownloadingId(result.fileId);
      setSubtitleError(null);
      const endpoint = mediaType === "movie" ? "movies" : "episodes";
      try {
        const response = await fetch(
          `/api/${endpoint}/${mediaId}/subtitles/download`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_id: result.fileId,
              file_name: result.fileName,
              language: result.language,
            }),
          }
        );
        const data = (await response.json()) as {
          subtitle?: SubtitleFile;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Download failed.");
        if (data.subtitle) {
          setSubtitles((prev) => {
            const exists = prev.some((s) => s.id === data.subtitle!.id);
            return exists ? prev : [...prev, data.subtitle!];
          });
          handleSelectSubtitle(data.subtitle.id);
        }
      } catch (error) {
        setSubtitleError(
          error instanceof Error ? error.message : "Download failed."
        );
      } finally {
        setSubtitleDownloadingId(null);
      }
    },
    [mediaId, mediaType, handleSelectSubtitle]
  );

  const handleDeleteSubtitle = useCallback(
    async (subtitleId: string) => {
      if (!mediaId || !mediaType) return;
      setSubtitleDeletingId(subtitleId);
      setSubtitleError(null);
      const endpoint = mediaType === "movie" ? "movies" : "episodes";
      try {
        const response = await fetch(
          `/api/${endpoint}/${mediaId}/subtitles/${subtitleId}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Delete failed.");
        }
        setSubtitles((prev) => prev.filter((s) => s.id !== subtitleId));
        if (activeSubtitleId === subtitleId) {
          setActiveSubtitleId(null);
          setSubtitlesEnabled(false);
          saveSubtitlePreference(null, false);
        }
      } catch (error) {
        setSubtitleError(
          error instanceof Error ? error.message : "Delete failed."
        );
      } finally {
        setSubtitleDeletingId(null);
      }
    },
    [mediaId, mediaType, activeSubtitleId, saveSubtitlePreference]
  );

  const toggleCcPanel = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setIsCcPanelOpen((prev) => !prev);
    if (isEpisodeSelectorOpen) setIsEpisodeSelectorOpen(false);
  }, [isEpisodeSelectorOpen]);

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

  const toggleEpisodeSelector = useCallback(() => {
    if (!canBrowseEpisodes) return;
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isCcPanelOpen) setIsCcPanelOpen(false);
    setIsEpisodeSelectorOpen((prev) => {
      const nextIsOpen = !prev;
      if (nextIsOpen) {
        setOpenEpisodeSeasonId(getDefaultOpenEpisodeSeasonId());
      }
      return nextIsOpen;
    });
  }, [canBrowseEpisodes, getDefaultOpenEpisodeSeasonId, isCcPanelOpen]);

  const handleSelectEpisode = useCallback(
    (episodeId: string) => {
      if (!onSelectEpisode) return;
      setIsEpisodeSelectorOpen(false);
      onSelectEpisode(episodeId);
    },
    [onSelectEpisode]
  );

  const toggleEpisodeSeason = useCallback((seasonId: string) => {
    setOpenEpisodeSeasonId((prev) => (prev === seasonId ? null : seasonId));
  }, []);

  const handlePlaybackStrategyChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = parseStoredStrategy(event.target.value);
      setPlaybackStrategy(next);
      try {
        localStorage.setItem(PLAYBACK_STRATEGY_STORAGE_KEY, next);
      } catch {
        // Ignore storage failures and keep in-memory preference.
      }
      resetHideTimer();
    },
    [resetHideTimer]
  );

  return (
    <div
      ref={containerRef}
      className="group fixed inset-0 z-50 w-full overflow-hidden rounded-none border-none bg-black shadow-2xl transition-all select-none"
      onMouseMove={resetHideTimer}
      onPointerDown={resetHideTimer}
      onMouseLeave={() => {
        if (!videoRef.current?.paused && !isEpisodeSelectorOpen && !isCcPanelOpen) setShowControls(false);
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="h-full w-full cursor-pointer bg-black object-contain"
        poster={posterUrl}
        playsInline
        autoPlay
        onClick={togglePlay}
        onPlay={() => {
          setIsPlaying(true);
          resetHideTimer();
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
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
          setIsPlaying(false);
          setShowControls(true);
          onEnded?.(endedTime, endedDuration);
        }}
        onTimeUpdate={handleVideoTimeUpdate}
        onDurationChange={() => {
          const d = videoRef.current?.duration;
          if (d && isFinite(d) && d > 0) {
            if (isSeekablePlayback) setDuration(d);
          }
        }}
        onProgress={handleProgress}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onSeeking={() => {
          setIsSeeking(true);
          setIsLoading(true);
        }}
        onSeeked={() => {
          setIsSeeking(false);
          setIsLoading(false);
        }}
        onError={() => {
          onError?.(
            "Browser cannot play this file format. Try the external player."
          );
        }}
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-12 w-12 animate-spin text-white/80" />
        </div>
      )}

      {playbackNotice ? (
        <div className="absolute left-1/2 top-4 z-30 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-amber-300/35 bg-black/75 px-4 py-2 text-center text-xs text-amber-100 backdrop-blur">
          {playbackNotice}
        </div>
      ) : null}

      {/* Click-to-play overlay when paused and not started */}
      {!isPlaying && currentTime === 0 && timeOffset === 0 && !isLoading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Play className="h-8 w-8 text-white fill-white ml-1" />
          </div>
        </button>
      )}

      {/* CC / Subtitle panel */}
      {isCcPanelOpen && mediaId ? (
        <div
          ref={ccPanelRef}
          className="absolute bottom-20 right-4 z-30 flex w-[min(30rem,calc(100%-2rem))] max-w-full flex-col overflow-hidden rounded-3xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl"
        >
          {/* Panel header */}
          <div className="flex items-start justify-between gap-4 border-b border-border bg-surface/90 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-faint">
                Subtitles
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                Subtitle settings
              </p>
            </div>
            <button
              onClick={() => setIsCcPanelOpen(false)}
              className="rounded-full p-2 text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
              aria-label="Close subtitle panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[min(70vh,36rem)] overflow-y-auto bg-background/90">
            {/* Error display */}
            {subtitleError ? (
              <div className="flex items-center gap-2 px-5 py-3 text-sm text-red-400 bg-red-400/10 border-b border-border">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{subtitleError}</span>
              </div>
            ) : null}

            {/* CC toggle */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border/60">
              <span className="text-sm font-medium text-foreground">
                Subtitles {subtitlesEnabled ? "On" : "Off"}
              </span>
              <button
                onClick={handleToggleCc}
                disabled={!activeSubtitleId}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
                  subtitlesEnabled && activeSubtitleId ? "bg-accent" : "bg-white/20"
                }`}
                aria-label={subtitlesEnabled ? "Disable subtitles" : "Enable subtitles"}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    subtitlesEnabled && activeSubtitleId ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Local subtitles */}
            <div className="border-b border-border/60">
              <p className="px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-faint bg-surface/60">
                Available subtitles
              </p>
              {subtitles.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">
                  No subtitle files found.
                </p>
              ) : (
                <div className="divide-y divide-border/40">
                  {subtitles.map((sub) => (
                    <div
                      key={sub.id}
                      className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                        activeSubtitleId === sub.id ? "bg-accent/10" : ""
                      }`}
                    >
                      <button
                        onClick={() => handleSelectSubtitle(sub.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={`h-2 w-2 flex-shrink-0 rounded-full ${
                            activeSubtitleId === sub.id && subtitlesEnabled
                              ? "bg-accent"
                              : activeSubtitleId === sub.id
                                ? "bg-white/40"
                                : "bg-white/10"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">
                            {sub.fileName}
                          </p>
                          <p className="text-xs text-muted">
                            {sub.language.toUpperCase()} · {sub.format.toUpperCase()}
                            {sub.source === "opensubtitles" ? " · OpenSubtitles" : ""}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteSubtitle(sub.id)}
                        disabled={subtitleDeletingId === sub.id}
                        className="flex-shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-strong hover:text-red-400 disabled:opacity-40"
                        aria-label="Delete subtitle"
                      >
                        {subtitleDeletingId === sub.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search section */}
            <div>
              <p className="px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-faint bg-surface/60">
                Search OpenSubtitles
              </p>
              <div className="px-5 py-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subtitleSearchQuery}
                    onChange={(e) => setSubtitleSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSubtitleSearch();
                    }}
                    placeholder="Search title…"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint outline-none focus:border-accent/60"
                  />
                  <select
                    value={subtitleSearchLanguage}
                    onChange={(e) => setSubtitleSearchLanguage(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:border-accent/60"
                  >
                    <option value="en">EN</option>
                    <option value="fr">FR</option>
                    <option value="de">DE</option>
                    <option value="es">ES</option>
                    <option value="it">IT</option>
                    <option value="pt">PT</option>
                    <option value="ru">RU</option>
                    <option value="zh">ZH</option>
                    <option value="ja">JA</option>
                    <option value="ko">KO</option>
                    <option value="ar">AR</option>
                    <option value="nl">NL</option>
                    <option value="pl">PL</option>
                    <option value="sv">SV</option>
                    <option value="tr">TR</option>
                  </select>
                  <button
                    onClick={() => void handleSubtitleSearch()}
                    disabled={subtitleSearchLoading}
                    className="flex-shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-strong disabled:opacity-40"
                    aria-label="Search"
                  >
                    {subtitleSearchLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {subtitleSearchError ? (
                  <p className="text-xs text-red-400">{subtitleSearchError}</p>
                ) : null}

                {subtitleSearchResults.length > 0 ? (
                  <div className="divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
                    {subtitleSearchResults.slice(0, 20).map((result) => (
                      <div
                        key={result.fileId}
                        className="flex items-center gap-3 px-4 py-3 bg-surface/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">
                            {result.fileName}
                          </p>
                          <p className="text-xs text-muted">
                            {result.language.toUpperCase()} · {result.format.toUpperCase()}
                            {result.downloadCount != null
                              ? ` · ${result.downloadCount.toLocaleString()} downloads`
                              : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleDownloadSubtitle(result)}
                          disabled={subtitleDownloadingId === result.fileId}
                          className="flex-shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-strong disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {subtitleDownloadingId === result.fileId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Get
                        </button>
                      </div>
                    ))}
                  </div>
                ) : subtitleSearchLoading ? null : subtitleSearchResults.length === 0 &&
                  subtitleSearchError === null &&
                  subtitleSearchQuery === "" ? (
                  <p className="text-xs text-muted">
                    Search to find subtitles from OpenSubtitles.
                  </p>
                ) : subtitleSearchResults.length === 0 ? (
                  <p className="text-xs text-muted">No results found.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isEpisodeSelectorOpen && canBrowseEpisodes ? (
        <div
          ref={episodeSelectorPanelRef}
          className="absolute bottom-20 right-4 z-30 flex w-[min(30rem,calc(100%-2rem))] max-w-full flex-col overflow-hidden rounded-3xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border bg-surface/90 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-faint">
                Episode selector
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                Browse all seasons
              </p>
            </div>
            <button
              onClick={() => setIsEpisodeSelectorOpen(false)}
              className="rounded-full p-2 text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
              aria-label="Close episode selector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[min(60vh,34rem)] overflow-y-auto bg-background/90">
            {episodeSeasons?.map((season) => {
              const isSeasonOpen = season.id === openEpisodeSeasonId;
              const seasonPanelId = `episode-selector-season-${season.id.replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
              )}`;

              return (
                <section
                  key={season.id}
                  className="border-t border-border/60 first:border-t-0"
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => toggleEpisodeSeason(season.id)}
                      aria-expanded={isSeasonOpen}
                      aria-controls={seasonPanelId}
                      className="flex w-full items-center justify-between gap-4 bg-surface/95 px-5 py-4 text-left transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {season.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          {season.subtitle ? <span>{season.subtitle}</span> : null}
                          <span>{season.episodes.length} episodes</span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 flex-shrink-0 text-muted transition-transform ${
                          isSeasonOpen ? "rotate-180 text-foreground" : ""
                        }`}
                      />
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isSeasonOpen ? (
                      <motion.div
                        key={seasonPanelId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div id={seasonPanelId} className="divide-y divide-border/40">
                          {season.episodes.map((episode) => (
                            <button
                              key={episode.id}
                              ref={episode.isCurrent ? currentEpisodeRef : undefined}
                              onClick={() => handleSelectEpisode(episode.id)}
                              className={`flex w-full items-center gap-4 px-5 py-3 text-left transition-colors ${
                                episode.isCurrent
                                  ? "bg-accent/10"
                                  : "hover:bg-surface-strong/60"
                              }`}
                            >
                              <span className="w-8 flex-shrink-0 text-sm font-semibold text-faint">
                                {episode.numberLabel}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p
                                    className={`truncate text-sm font-medium ${
                                      episode.isCurrent ? "text-foreground" : "text-white/90"
                                    }`}
                                  >
                                    {episode.title}
                                  </p>
                                  {episode.isCurrent ? (
                                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                                      Playing
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs text-muted">
                                  {episode.subtitle}
                                </p>
                              </div>
                              <div className="flex flex-shrink-0 items-center gap-2">
                                {episode.watched ? (
                                  <span className="rounded-full border border-border/80 bg-surface/80 p-1.5 text-muted">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                ) : null}
                                <span className="rounded-full border border-white/20 bg-white/5 p-2 text-white/80 transition-colors">
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Top bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          paddingBottom: "0.75rem",
          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 1rem)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 1rem)",
        }}
      >
        <span className="text-sm font-medium text-white truncate mr-4">
          {title}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onExternalPlayer && (
            <button
              onClick={onExternalPlayer}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              title="Open in external player"
            >
              <Monitor className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-10 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 1rem)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 1rem)",
        }}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="group/progress relative mb-3 h-1.5 w-full cursor-pointer touch-none rounded-full bg-white/20 transition-all hover:h-2.5"
          onPointerDown={handleProgressPointerDown}
        >
          {/* Buffered */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/30 pointer-events-none"
            style={{ width: `${buffered * 100}%` }}
          />
          {/* Played */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent pointer-events-none"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Scrub handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-accent shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="rounded-lg p-1.5 text-white hover:bg-white/10 transition-colors"
            title={isPlaying ? "Pause (K)" : "Play (K)"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </button>

          <button
            onClick={() => skip(-10)}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            title="Back 10s (←)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => skip(10)}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            title="Forward 10s (→)"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 group/vol">
            <button
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = !video.muted;
                setIsMuted(video.muted);
              }}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              title="Mute (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-accent cursor-pointer opacity-0 group-hover/vol:opacity-100"
            />
          </div>

          <span className="text-xs text-white/70 tabular-nums ml-1">
            {formatTime(effectiveTime)} / {formatTime(effectiveDuration)}
          </span>

          <div className="flex-1" />

          {streamInfo?.mode && streamInfo.mode !== "direct" && (
            <span className="text-[10px] text-white/40 uppercase tracking-wider mr-1">
              {streamInfo?.mode === "remux" ? "remux" : "transcode"}
            </span>
          )}

          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-white/70">
            Mode
            <select
              value={playbackStrategy}
              onChange={handlePlaybackStrategyChange}
              className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-white outline-none"
              aria-label="Playback mode"
            >
              <option value="auto">Auto</option>
              <option value="classic">Classic</option>
              <option value="hls">HLS</option>
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2">
            {mediaId ? (
              <div className="relative">
                <button
                  ref={ccButtonRef}
                  onClick={toggleCcPanel}
                  className={`relative rounded-xl border px-3 py-2 text-white/80 transition-colors ${
                    isCcPanelOpen
                      ? "border-accent/50 bg-accent/20 text-white"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white"
                  }`}
                  aria-label="Subtitle options"
                  title="Subtitles"
                >
                  <Captions className="h-4 w-4" />
                  {activeSubtitleId && subtitlesEnabled ? (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent" />
                  ) : null}
                </button>
              </div>
            ) : null}
            {canBrowseEpisodes ? (
              <div className="group relative">
                <button
                  ref={episodeSelectorButtonRef}
                  onClick={toggleEpisodeSelector}
                  className={`peer rounded-xl border px-3 py-2 text-white/80 transition-colors ${
                    isEpisodeSelectorOpen
                      ? "border-accent/50 bg-accent/20 text-white"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white"
                  }`}
                  aria-label="Browse episodes"
                >
                  <ListVideo className="h-4 w-4" />
                </button>
                <PlayerHoverCard
                  label="Episode selector"
                  target={{
                    id: "episodes",
                    title: "Browse all seasons",
                    subtitle: "Open the in-player episode list.",
                  }}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              <div className="group relative">
                <button
                  onClick={onPreviousEpisode}
                  disabled={!onPreviousEpisode}
                  className="peer rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={
                    previousEpisode
                      ? `Previous episode: ${previousEpisode.title}`
                      : "No previous episode"
                  }
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <PlayerHoverCard label="Previous episode" target={previousEpisode} />
              </div>
              <div className="group relative">
                <button
                  onClick={onNextEpisode}
                  disabled={!onNextEpisode}
                  className="peer rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={
                    nextEpisode ? `Next episode: ${nextEpisode.title}` : "No next episode"
                  }
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <PlayerHoverCard label="Next episode" target={nextEpisode} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              title="Exit player"
              aria-label="Exit player"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Portrait-mode rotation prompt for mobile.
          screen.orientation.lock() is unsupported on iOS Safari, so we prompt instead. */}
      {clientDevice === "mobile" && isPortrait && !portraitDismissed && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <div className="relative">
              <Smartphone className="h-14 w-14 rotate-90 text-white/80" />
            </div>
            <p className="text-lg font-semibold text-white">Rotate to landscape</p>
            <p className="text-sm text-white/60">For the best viewing experience, turn your device sideways.</p>
            <button
              onClick={() => setPortraitDismissed(true)}
              className="mt-2 rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm text-white transition-colors hover:bg-white/20 active:bg-white/25"
            >
              Continue in portrait
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
