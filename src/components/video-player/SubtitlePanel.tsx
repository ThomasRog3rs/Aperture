"use client";

import { AlertCircle, X } from "lucide-react";
import type { RefObject } from "react";
import type { SubtitleSearchResult } from "@/lib/types";
import type { SubtitleState } from "@/components/video-player/state";
import { SubtitleSearchSection } from "@/components/video-player/SubtitleSearchSection";
import { SubtitleTrackList } from "@/components/video-player/SubtitleTrackList";

type SubtitlePanelProps = {
  panelRef: RefObject<HTMLDivElement | null>;
  subtitleState: SubtitleState;
  onClose: () => void;
  onToggleCc: () => void;
  onSelectSubtitle: (subtitleId: string) => void;
  onDeleteSubtitle: (subtitleId: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSearchLanguageChange: (value: string) => void;
  onSearch: () => void;
  onDownloadSubtitle: (result: SubtitleSearchResult) => void;
};

export function SubtitlePanel({
  panelRef,
  subtitleState,
  onClose,
  onToggleCc,
  onSelectSubtitle,
  onDeleteSubtitle,
  onSearchQueryChange,
  onSearchLanguageChange,
  onSearch,
  onDownloadSubtitle,
}: SubtitlePanelProps) {
  return (
    <div
      ref={panelRef}
      className="absolute bottom-20 right-4 z-30 flex w-[min(30rem,calc(100%-2rem))] max-w-full flex-col overflow-hidden rounded-3xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl"
    >
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
          onClick={onClose}
          className="rounded-full p-2 text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
          aria-label="Close subtitle panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[min(70vh,36rem)] overflow-y-auto bg-background/90">
        {subtitleState.subtitleError ? (
          <div className="flex items-center gap-2 border-b border-border bg-red-400/10 px-5 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{subtitleState.subtitleError}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
          <span className="text-sm font-medium text-foreground">
            Subtitles {subtitleState.subtitlesEnabled ? "On" : "Off"}
          </span>
          <button
            onClick={onToggleCc}
            disabled={!subtitleState.activeSubtitleId}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
              subtitleState.subtitlesEnabled && subtitleState.activeSubtitleId
                ? "bg-accent"
                : "bg-white/20"
            }`}
            aria-label={
              subtitleState.subtitlesEnabled
                ? "Disable subtitles"
                : "Enable subtitles"
            }
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                subtitleState.subtitlesEnabled && subtitleState.activeSubtitleId
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="border-b border-border/60">
          <p className="bg-surface/60 px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-faint">
            Available subtitles
          </p>
          <SubtitleTrackList
            subtitles={subtitleState.subtitles}
            activeSubtitleId={subtitleState.activeSubtitleId}
            subtitlesEnabled={subtitleState.subtitlesEnabled}
            subtitleDeletingId={subtitleState.subtitleDeletingId}
            onSelectSubtitle={onSelectSubtitle}
            onDeleteSubtitle={onDeleteSubtitle}
          />
        </div>

        <SubtitleSearchSection
          subtitleSearchQuery={subtitleState.subtitleSearchQuery}
          subtitleSearchLanguage={subtitleState.subtitleSearchLanguage}
          subtitleSearchResults={subtitleState.subtitleSearchResults}
          subtitleSearchLoading={subtitleState.subtitleSearchLoading}
          subtitleSearchError={subtitleState.subtitleSearchError}
          subtitleDownloadingId={subtitleState.subtitleDownloadingId}
          onSearchQueryChange={onSearchQueryChange}
          onSearchLanguageChange={onSearchLanguageChange}
          onSearch={onSearch}
          onDownloadSubtitle={onDownloadSubtitle}
        />
      </div>
    </div>
  );
}
