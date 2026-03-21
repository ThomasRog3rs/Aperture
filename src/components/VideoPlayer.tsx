"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  Poster,
  Track,
} from "@vidstack/react";
import {
  DefaultAudioLayout,
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { X, Monitor, Maximize2, Minimize2 } from "lucide-react";

export type VideoPlayerProps = {
  /** Title shown in the player chrome */
  title: string;
  /** The direct stream URL (e.g. /api/movies/{id}/stream) */
  streamUrl: string;
  /** Optional HLS manifest URL. Takes priority over streamUrl when provided. */
  hlsUrl?: string;
  /** Optional poster/backdrop image URL */
  posterUrl?: string;
  /** Optional storyboard VTT URL for thumbnail scrubbing */
  thumbnailsVttUrl?: string;
  /** Called when the user clicks the close button */
  onClose: () => void;
  /** Called when the player encounters an error */
  onError?: (message: string) => void;
  /** Called when playback position changes (for saving resume position). Fires every ~5 seconds. */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Initial playback position in seconds (for resume) */
  startTime?: number;
  /** Called to launch external player */
  onExternalPlayer?: () => void;
};

export function VideoPlayer({
  title,
  streamUrl,
  hlsUrl,
  posterUrl,
  thumbnailsVttUrl,
  onClose,
  onError,
  onTimeUpdate,
  startTime,
  onExternalPlayer,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const lastReportedTime = useRef(0);

  const src = hlsUrl || streamUrl;

  function onProviderChange(provider: MediaProviderAdapter | null) {
    if (isHLSProvider(provider)) {
      provider.library = () => import("hls.js");
    }
  }

  const handleTimeUpdate = useCallback(() => {
    if (!onTimeUpdate || !playerRef.current) return;
    const { currentTime, duration } = playerRef.current.state;
    // Only report every ~5 seconds to avoid excessive calls
    if (Math.abs(currentTime - lastReportedTime.current) >= 5) {
      lastReportedTime.current = currentTime;
      onTimeUpdate(currentTime, duration);
    }
  }, [onTimeUpdate]);

  // Seek to startTime once the player is ready
  useEffect(() => {
    if (!startTime || !playerRef.current) return;
    const player = playerRef.current;
    const unsub = player.subscribe(({ canPlay }) => {
      if (canPlay && startTime > 0) {
        player.currentTime = startTime;
      }
    });
    return unsub;
  }, [startTime]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-border bg-black shadow-2xl transition-all ${
        isTheaterMode ? "fixed inset-0 z-50 rounded-none border-none" : ""
      }`}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-2 pointer-events-none">
        <span className="text-sm font-medium text-white truncate pointer-events-auto">
          {title}
        </span>
        <div className="flex items-center gap-1 pointer-events-auto">
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

      <MediaPlayer
        ref={playerRef}
        src={src}
        crossOrigin
        playsInline
        autoPlay
        onProviderChange={onProviderChange}
        onTimeUpdate={handleTimeUpdate}
        onError={(e) => {
          onError?.(
            `Playback error: ${e?.message || "Browser cannot play this file format. Try the external player."}`
          );
        }}
        className={isTheaterMode ? "h-screen" : "max-h-[75vh]"}
        style={{
          "--media-brand": "var(--accent, #e50914)",
          "--media-focus-ring-color": "var(--accent, #e50914)",
          "--media-font-family": "var(--font-body-sans, sans-serif)",
        } satisfies Record<string, string>}
      >
        <MediaProvider>
          {posterUrl && (
            <Poster
              className="absolute inset-0 block h-full w-full rounded-md object-cover opacity-0 transition-opacity data-[visible]:opacity-100"
              src={posterUrl}
              alt={title}
            />
          )}
        </MediaProvider>
        {thumbnailsVttUrl && (
          <Track
            kind="chapters"
            src={thumbnailsVttUrl}
            type="vtt"
            default
          />
        )}
        <DefaultAudioLayout icons={defaultLayoutIcons} />
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          thumbnails={thumbnailsVttUrl}
        />
      </MediaPlayer>
    </div>
  );
}
