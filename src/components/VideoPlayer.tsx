"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Monitor,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Loader2,
  Maximize,
} from "lucide-react";

export type VideoPlayerProps = {
  title: string;
  streamUrl: string;
  hlsUrl?: string;
  posterUrl?: string;
  thumbnailsVttUrl?: string;
  onClose: () => void;
  onError?: (message: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  startTime?: number;
  onExternalPlayer?: () => void;
};

type StreamInfo = {
  mode: "direct" | "remux" | "transcode";
  duration: number;
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({
  title,
  streamUrl,
  hlsUrl,
  posterUrl,
  onClose,
  onError,
  onTimeUpdate,
  startTime,
  onExternalPlayer,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const lastReportedTime = useRef(0);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didSeekToStart = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Stream mode: "direct" supports native range-request seeking,
  // "remux"/"transcode" requires URL reload with ?start= for seeking
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  // Time offset when we restart a transcoded stream at a non-zero position
  const [timeOffset, setTimeOffset] = useState(0);

  const isDirectPlay = !streamInfo || streamInfo.mode === "direct";

  // Fetch stream info on mount to determine playback mode
  useEffect(() => {
    const infoUrl = streamUrl.replace(/\/stream$/, "/stream/info");
    fetch(infoUrl)
      .then((r) => r.json())
      .then((info: StreamInfo) => {
        setStreamInfo(info);
        if (info.duration > 0) setDuration(info.duration);
      })
      .catch(() => {
        setStreamInfo({ mode: "direct", duration: 0 });
      });
  }, [streamUrl]);

  // Build the effective video src (with ?start= for transcoded streams)
  const getStreamSrc = useCallback(
    (seekTime?: number) => {
      const base = hlsUrl || streamUrl;
      if (isDirectPlay || !seekTime || seekTime <= 0) return base;
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}start=${Math.floor(seekTime)}`;
    },
    [hlsUrl, streamUrl, isDirectPlay]
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
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  // Seek to startTime once metadata is loaded (for direct play)
  // For transcoded streams, load with ?start= from the start
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !startTime || startTime <= 0 || !streamInfo) return;

    if (!isDirectPlay) {
      if (!didSeekToStart.current) {
        didSeekToStart.current = true;
        setTimeOffset(startTime);
        video.src = getStreamSrc(startTime);
        video.play().catch(() => {});
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
  }, [startTime, streamInfo, isDirectPlay, getStreamSrc]);

  // Unified seek function for both direct and transcoded streams
  const seekTo = useCallback(
    (targetTime: number) => {
      const video = videoRef.current;
      if (!video) return;

      if (isDirectPlay) {
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
        // Reload with new start position
        setTimeOffset(targetTime);
        setCurrentTime(0);
        setIsLoading(true);
        video.src = getStreamSrc(targetTime);
        video.play().catch(() => {});
      }
    },
    [isDirectPlay, timeOffset, getStreamSrc]
  );

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

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
          video.paused ? video.play() : video.pause();
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
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case "Escape":
          if (isTheaterMode) {
            e.preventDefault();
            setIsTheaterMode(false);
          }
          break;
      }
      resetHideTimer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTheaterMode, resetHideTimer, effectiveTime, effectiveDuration, seekTo, toggleFullscreen]);

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
    if (isDirectPlay) {
      setBuffered(video.duration > 0 ? end / video.duration : 0);
    } else {
      setBuffered(
        effectiveDuration > 0 ? (end + timeOffset) / effectiveDuration : 0
      );
    }
  }, [isDirectPlay, effectiveDuration, timeOffset]);

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

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      seekToPosition(e.clientX);

      const handleMouseMove = (ev: MouseEvent) => seekToPosition(ev.clientX);
      const handleMouseUp = (ev: MouseEvent) => {
        seekToPosition(ev.clientX);
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
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
    video.paused ? video.play() : video.pause();
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

  return (
    <div
      ref={containerRef}
      className={`group relative w-full overflow-hidden rounded-2xl border border-border bg-black shadow-2xl transition-all select-none ${
        isTheaterMode ? "fixed inset-0 z-50 rounded-none border-none" : ""
      }`}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (!videoRef.current?.paused) setShowControls(false);
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className={`w-full bg-black cursor-pointer ${
          isTheaterMode ? "h-full object-contain" : "max-h-[75vh]"
        }`}
        src={getStreamSrc()}
        poster={posterUrl}
        playsInline
        autoPlay
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setIsPlaying(true);
          resetHideTimer();
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
        }}
        onTimeUpdate={handleVideoTimeUpdate}
        onDurationChange={() => {
          const d = videoRef.current?.duration;
          if (d && isFinite(d) && d > 0) {
            if (isDirectPlay) setDuration(d);
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
      {isLoading && (isPlaying || isSeeking) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-12 w-12 animate-spin text-white/80" />
        </div>
      )}

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

      {/* Top bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 py-3 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
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
            onClick={() => setIsTheaterMode((prev) => !prev)}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            title={isTheaterMode ? "Exit theater mode" : "Theater mode"}
          >
            {isTheaterMode ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
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
        className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="group/progress relative h-1.5 w-full cursor-pointer rounded-full bg-white/20 mb-3 hover:h-2.5 transition-all"
          onMouseDown={handleProgressMouseDown}
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

          {!isDirectPlay && (
            <span className="text-[10px] text-white/40 uppercase tracking-wider mr-1">
              {streamInfo?.mode === "remux" ? "remux" : "transcode"}
            </span>
          )}

          <button
            onClick={toggleFullscreen}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            title="Fullscreen (F)"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
