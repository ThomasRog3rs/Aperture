"use client";

import { Download, Loader2, Search } from "lucide-react";
import type { SubtitleSearchResult } from "@/lib/types";
import { SUBTITLE_SEARCH_LANGUAGE_OPTIONS } from "@/components/video-player/utils";

type SubtitleSearchSectionProps = {
  subtitleSearchQuery: string;
  subtitleSearchLanguage: string;
  subtitleSearchResults: SubtitleSearchResult[];
  subtitleSearchLoading: boolean;
  subtitleSearchError: string | null;
  subtitleDownloadingId: number | null;
  onSearchQueryChange: (value: string) => void;
  onSearchLanguageChange: (value: string) => void;
  onSearch: () => void;
  onDownloadSubtitle: (result: SubtitleSearchResult) => void;
};

export function SubtitleSearchSection({
  subtitleSearchQuery,
  subtitleSearchLanguage,
  subtitleSearchResults,
  subtitleSearchLoading,
  subtitleSearchError,
  subtitleDownloadingId,
  onSearchQueryChange,
  onSearchLanguageChange,
  onSearch,
  onDownloadSubtitle,
}: SubtitleSearchSectionProps) {
  return (
    <div>
      <p className="bg-surface/60 px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-faint">
        Search OpenSubtitles
      </p>
      <div className="space-y-3 px-5 py-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={subtitleSearchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder="Search title…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint outline-none focus:border-accent/60"
          />
          <select
            value={subtitleSearchLanguage}
            onChange={(event) => onSearchLanguageChange(event.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:border-accent/60"
          >
            {SUBTITLE_SEARCH_LANGUAGE_OPTIONS.map((language) => (
              <option key={language} value={language}>
                {language.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            onClick={onSearch}
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
          <div className="overflow-hidden rounded-lg border border-border divide-y divide-border/40">
            {subtitleSearchResults.slice(0, 20).map((result) => (
              <div
                key={result.fileId}
                className="flex items-center gap-3 bg-surface/40 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{result.fileName}</p>
                  <p className="text-xs text-muted">
                    {result.language.toUpperCase()} · {result.format.toUpperCase()}
                    {result.downloadCount != null
                      ? ` · ${result.downloadCount.toLocaleString()} downloads`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={() => onDownloadSubtitle(result)}
                  disabled={subtitleDownloadingId === result.fileId}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-strong disabled:opacity-40"
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
        ) : subtitleSearchLoading ? null : subtitleSearchError === null &&
          subtitleSearchQuery === "" ? (
          <p className="text-xs text-muted">
            Search to find subtitles from OpenSubtitles.
          </p>
        ) : (
          <p className="text-xs text-muted">No results found.</p>
        )}
      </div>
    </div>
  );
}
