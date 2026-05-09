"use client";

import { Loader2, Trash2 } from "lucide-react";
import type { SubtitleFile } from "@/lib/types";

type SubtitleTrackListProps = {
  subtitles: SubtitleFile[];
  activeSubtitleId: string | null;
  subtitlesEnabled: boolean;
  subtitleDeletingId: string | null;
  onSelectSubtitle: (subtitleId: string) => void;
  onDeleteSubtitle: (subtitleId: string) => void;
};

export function SubtitleTrackList({
  subtitles,
  activeSubtitleId,
  subtitlesEnabled,
  subtitleDeletingId,
  onSelectSubtitle,
  onDeleteSubtitle,
}: SubtitleTrackListProps) {
  if (subtitles.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-muted">No subtitle files found.</p>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {subtitles.map((subtitle) => (
        <div
          key={subtitle.id}
          className={`flex items-center gap-3 px-5 py-3 transition-colors ${
            activeSubtitleId === subtitle.id ? "bg-accent/10" : ""
          }`}
        >
          <button
            onClick={() => onSelectSubtitle(subtitle.id)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full ${
                activeSubtitleId === subtitle.id && subtitlesEnabled
                  ? "bg-accent"
                  : activeSubtitleId === subtitle.id
                    ? "bg-white/40"
                    : "bg-white/10"
              }`}
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{subtitle.fileName}</p>
              <p className="text-xs text-muted">
                {subtitle.language.toUpperCase()} · {subtitle.format.toUpperCase()}
                {subtitle.source === "opensubtitles" ? " · OpenSubtitles" : ""}
              </p>
            </div>
          </button>
          <button
            onClick={() => onDeleteSubtitle(subtitle.id)}
            disabled={subtitleDeletingId === subtitle.id}
            className="flex-shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-strong hover:text-red-400 disabled:opacity-40"
            aria-label="Delete subtitle"
          >
            {subtitleDeletingId === subtitle.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
