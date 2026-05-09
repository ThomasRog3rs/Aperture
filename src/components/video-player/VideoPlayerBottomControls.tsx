"use client";

import {
  Captions,
  ListVideo,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { ChangeEvent, PointerEventHandler, RefObject } from "react";
import { PlayerHoverCard } from "@/components/video-player/PlayerHoverCard";
import type {
  ClientDevice,
  PlaybackStrategy,
  StreamInfo,
  VideoPlayerEpisodeTarget,
} from "@/components/video-player/types";
import { formatTime, getPlaybackModeBadge } from "@/components/video-player/utils";

type VideoPlayerBottomControlsProps = {
  showControls: boolean;
  progressRef: RefObject<HTMLDivElement | null>;
  overflowMenuButtonRef: RefObject<HTMLButtonElement | null>;
  overflowMenuPanelRef: RefObject<HTMLDivElement | null>;
  ccButtonRef: RefObject<HTMLButtonElement | null>;
  episodeSelectorButtonRef: RefObject<HTMLButtonElement | null>;
  buffered: number;
  progress: number;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  effectiveTime: number;
  effectiveDuration: number;
  clientDevice: ClientDevice;
  playbackStrategy: PlaybackStrategy;
  streamInfo: StreamInfo | null;
  mediaId?: string;
  isCcPanelOpen: boolean;
  isEpisodeSelectorOpen: boolean;
  isOverflowMenuOpen: boolean;
  hasActiveSubtitleIndicator: boolean;
  canBrowseEpisodes: boolean;
  isRandomMode: boolean;
  previousEpisode?: VideoPlayerEpisodeTarget;
  nextEpisode?: VideoPlayerEpisodeTarget;
  onProgressPointerDown: PointerEventHandler<HTMLDivElement>;
  onTogglePlay: () => void;
  onSkip: (seconds: number) => void;
  onToggleMute: () => void;
  onVolumeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPlaybackStrategyChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onToggleCcPanel: () => void;
  onToggleEpisodeSelector: () => void;
  onToggleOverflowMenu: () => void;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  onRandomEpisode?: () => void;
  onClose: () => void;
};

function PlaybackModeControl({
  playbackStrategy,
  streamInfo,
  onPlaybackStrategyChange,
}: {
  playbackStrategy: PlaybackStrategy;
  streamInfo: StreamInfo | null;
  onPlaybackStrategyChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const playbackModeBadge = getPlaybackModeBadge(streamInfo?.mode);

  return (
    <>
      {playbackModeBadge ? (
        <span className="mr-1 text-[10px] uppercase tracking-wider text-white/40">
          {playbackModeBadge}
        </span>
      ) : null}

      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-white/70">
        Mode
        <select
          value={playbackStrategy}
          onChange={onPlaybackStrategyChange}
          className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-white outline-none"
          aria-label="Playback mode"
        >
          <option value="auto">Auto</option>
          <option value="classic">Classic</option>
          <option value="hls">HLS</option>
        </select>
      </label>
    </>
  );
}

export function VideoPlayerBottomControls({
  showControls,
  progressRef,
  overflowMenuButtonRef,
  overflowMenuPanelRef,
  ccButtonRef,
  episodeSelectorButtonRef,
  buffered,
  progress,
  isPlaying,
  isMuted,
  volume,
  effectiveTime,
  effectiveDuration,
  clientDevice,
  playbackStrategy,
  streamInfo,
  mediaId,
  isCcPanelOpen,
  isEpisodeSelectorOpen,
  isOverflowMenuOpen,
  hasActiveSubtitleIndicator,
  canBrowseEpisodes,
  isRandomMode,
  previousEpisode,
  nextEpisode,
  onProgressPointerDown,
  onTogglePlay,
  onSkip,
  onToggleMute,
  onVolumeChange,
  onPlaybackStrategyChange,
  onToggleCcPanel,
  onToggleEpisodeSelector,
  onToggleOverflowMenu,
  onPreviousEpisode,
  onNextEpisode,
  onRandomEpisode,
  onClose,
}: VideoPlayerBottomControlsProps) {
  const playbackModeBadge = getPlaybackModeBadge(streamInfo?.mode);

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${
        showControls ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        ref={progressRef}
        className="group/progress relative mb-3 h-1.5 w-full cursor-pointer touch-none rounded-full bg-white/20 transition-all hover:h-2.5"
        onPointerDown={onProgressPointerDown}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-white/30"
          style={{ width: `${buffered * 100}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 shadow-lg transition-opacity group-hover/progress:opacity-100"
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onTogglePlay}
          className="rounded-lg p-1 text-white transition-colors hover:bg-white/10 sm:p-1.5"
          title={isPlaying ? "Pause (K)" : "Play (K)"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Play className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
          )}
        </button>

        <button
          onClick={() => onSkip(-10)}
          className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:p-1.5"
          title="Back 10s (←)"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => onSkip(10)}
          className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:p-1.5"
          title="Forward 10s (→)"
        >
          <RotateCw className="h-4 w-4" />
        </button>

        <div className="group/vol flex items-center gap-1">
          <button
            onClick={onToggleMute}
            className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:p-1.5"
            title="Mute (M)"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          {clientDevice !== "mobile" ? (
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={onVolumeChange}
              className="w-0 cursor-pointer opacity-0 transition-all duration-200 accent-accent group-hover/vol:w-20 group-hover/vol:opacity-100"
            />
          ) : null}
        </div>

        <span className="ml-0.5 text-xs tabular-nums text-white/70 sm:ml-1">
          {formatTime(effectiveTime)} / {formatTime(effectiveDuration)}
        </span>

        <div className="flex-1" />

        {clientDevice !== "mobile" ? (
          <>
            <PlaybackModeControl
              playbackStrategy={playbackStrategy}
              streamInfo={streamInfo}
              onPlaybackStrategyChange={onPlaybackStrategyChange}
            />

              <div className="ml-auto flex items-center gap-2">
                {isRandomMode ? (
                  <div className="group relative">
                    <button
                      onClick={onRandomEpisode}
                      disabled={!onRandomEpisode}
                      className="peer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Play another random episode"
                    >
                      <Shuffle className="h-4 w-4" />
                    </button>
                    <PlayerHoverCard
                      label="Random episode"
                      target={{
                        id: "random-episode",
                        title: "Play another random episode",
                        subtitle: "Pick a different episode from this random session.",
                      }}
                    />
                  </div>
                ) : null}

                {mediaId ? (
                  <div className="relative">
                    <button
                    ref={ccButtonRef}
                    onClick={onToggleCcPanel}
                    className={`relative rounded-xl border px-3 py-2 text-white/80 transition-colors ${
                      isCcPanelOpen
                        ? "border-accent/50 bg-accent/20 text-white"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white"
                    }`}
                    aria-label="Subtitle options"
                    title="Subtitles"
                  >
                    <Captions className="h-4 w-4" />
                    {hasActiveSubtitleIndicator ? (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent" />
                    ) : null}
                  </button>
                </div>
              ) : null}

              {canBrowseEpisodes ? (
                <div className="group relative">
                  <button
                    ref={episodeSelectorButtonRef}
                    onClick={onToggleEpisodeSelector}
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
                      nextEpisode
                        ? `Next episode: ${nextEpisode.title}`
                        : "No next episode"
                    }
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                  <PlayerHoverCard label="Next episode" target={nextEpisode} />
                </div>
              </div>
            </div>
          </>
        ) : null}

        {clientDevice === "mobile" ? (
          <div className="relative">
            <button
              ref={overflowMenuButtonRef}
              onClick={onToggleOverflowMenu}
              className={`rounded-xl border p-1.5 text-white/80 transition-colors ${
                isOverflowMenuOpen
                  ? "border-accent/50 bg-accent/20 text-white"
                  : "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white"
              }`}
              aria-label="More controls"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {isOverflowMenuOpen ? (
              <div
                ref={overflowMenuPanelRef}
                className="absolute bottom-full right-0 mb-2 min-w-[200px] rounded-2xl border border-white/10 bg-black/90 p-3 shadow-2xl backdrop-blur-xl"
              >
                <div className="mb-2 border-b border-white/10 pb-2">
                  <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/40">
                    Playback Mode
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={playbackStrategy}
                      onChange={onPlaybackStrategyChange}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[12px] text-white outline-none"
                      aria-label="Playback mode"
                    >
                      <option value="auto">Auto</option>
                      <option value="classic">Classic</option>
                      <option value="hls">HLS</option>
                    </select>
                    {playbackModeBadge ? (
                      <span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-white/40">
                        {playbackModeBadge}
                      </span>
                    ) : null}
                  </div>
                </div>

                {mediaId ? (
                  <button
                    onClick={onToggleCcPanel}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors ${
                      isCcPanelOpen
                        ? "bg-accent/20 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Captions className="h-4 w-4 flex-shrink-0" />
                    <span>Subtitles</span>
                    {hasActiveSubtitleIndicator ? (
                      <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-accent" />
                    ) : null}
                  </button>
                ) : null}

                {canBrowseEpisodes ? (
                  <button
                    onClick={onToggleEpisodeSelector}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors ${
                      isEpisodeSelectorOpen
                        ? "bg-accent/20 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <ListVideo className="h-4 w-4 flex-shrink-0" />
                    <span>Episodes</span>
                  </button>
                ) : null}

                {isRandomMode ? (
                  <button
                    onClick={onRandomEpisode}
                    disabled={!onRandomEpisode}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Shuffle className="h-4 w-4 flex-shrink-0" />
                    <span>Random Episode</span>
                  </button>
                ) : null}

                <div className="mt-2 flex gap-2 border-t border-white/10 pt-2">
                  <button
                    onClick={onPreviousEpisode}
                    disabled={!onPreviousEpisode}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={
                      previousEpisode
                        ? `Previous episode: ${previousEpisode.title}`
                        : "No previous episode"
                    }
                  >
                    <SkipBack className="h-4 w-4" />
                    <span className="text-xs">Prev</span>
                  </button>
                  <button
                    onClick={onNextEpisode}
                    disabled={!onNextEpisode}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={
                      nextEpisode
                        ? `Next episode: ${nextEpisode.title}`
                        : "No next episode"
                    }
                  >
                    <span className="text-xs">Next</span>
                    <SkipForward className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:p-2"
          title="Exit player"
          aria-label="Exit player"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
