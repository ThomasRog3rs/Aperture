"use client";

import Link from "next/link";
import { Search, RefreshCw, Menu, X } from "lucide-react";
import { SearchableDropdown } from "./SearchableDropdown";
import { useState } from "react";

type WatchedFilter = "all" | "watched" | "unwatched";
type MediaTypeFilter = "all" | "movies" | "series";

type SyncProgress = {
  phase: "scanning" | "movies" | "seasons" | "cleanup" | "saving";
  current: number;
  total: number;
  title?: string;
};

type MainHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  genres: string[];
  genre: string;
  onGenreChange: (value: string) => void;
  people: string[];
  person: string;
  onPersonChange: (value: string) => void;
  minRating: number | null;
  onMinRatingChange: (value: number | null) => void;
  watched: WatchedFilter;
  onWatchedChange: (value: WatchedFilter) => void;
  mediaType: MediaTypeFilter;
  onMediaTypeChange: (value: MediaTypeFilter) => void;
  sort: "title" | "rating" | "recent";
  onSortChange: (value: "title" | "rating" | "recent") => void;
  onSync: () => void;
  syncing: boolean;
  syncProgress?: SyncProgress | null;
  onCancelSync?: () => void;
  libraryRootPath?: string | null;
};

function syncLabel(progress: SyncProgress | null | undefined): string {
  if (!progress) return "Syncing...";
  switch (progress.phase) {
    case "scanning": return "Scanning…";
    case "cleanup": return "Cleaning up…";
    case "saving": return "Saving…";
    case "movies":
      return progress.total > 0
        ? `Movies ${progress.current}/${progress.total}`
        : "Movies…";
    case "seasons":
      return progress.total > 0
        ? `Shows ${progress.current}/${progress.total}`
        : "Shows…";
  }
}

export function MainHeader({
  query,
  onQueryChange,
  genres,
  genre,
  onGenreChange,
  people,
  person,
  onPersonChange,
  minRating,
  onMinRatingChange,
  watched,
  onWatchedChange,
  mediaType,
  onMediaTypeChange,
  sort,
  onSortChange,
  onSync,
  syncing,
  syncProgress,
  onCancelSync,
  libraryRootPath,
}: MainHeaderProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex flex-1 items-center gap-3 sm:gap-4">
            <button
              onClick={() => setShowMobileNav(!showMobileNav)}
              className="sm:hidden p-2 -ml-2 text-muted hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <label className="relative flex w-full max-w-md items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/50">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search movies, shows, people..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
              />
            </label>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="hidden sm:block text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              {showFilters ? "Hide Filters" : "Filters"}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 ml-2">
            {/* Desktop sync controls */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={onSync}
                disabled={syncing}
                className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? syncLabel(syncProgress) : "Sync"}
              </button>
              {syncing && onCancelSync ? (
                <button
                  onClick={onCancelSync}
                  title="Cancel sync"
                  className="flex items-center justify-center rounded-full border border-border p-2 text-muted transition-colors hover:border-border-hover hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Mobile sync controls */}
            <div className="sm:hidden flex items-center gap-1">
              <button
                onClick={onSync}
                disabled={syncing}
                className="flex items-center justify-center p-2 rounded-full bg-accent text-white disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              </button>
              {syncing && onCancelSync ? (
                <button
                  onClick={onCancelSync}
                  title="Cancel sync"
                  className="flex items-center justify-center p-2 rounded-full border border-border text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Progress bar strip shown while syncing */}
        {syncing ? (
          <div className="border-t border-border/50 bg-accent/5 px-4 sm:px-6 py-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 overflow-hidden rounded-full bg-border h-1">
                {syncProgress && syncProgress.total > 0 ? (
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                  />
                ) : (
                  <div className="h-full w-full bg-accent/40 animate-pulse" />
                )}
              </div>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {syncProgress?.title
                  ? `${syncLabel(syncProgress)} — ${syncProgress.title}`
                  : syncLabel(syncProgress)}
              </span>
            </div>
          </div>
        ) : null}

        {(showFilters || showMobileNav) && (
          <div className="border-t border-border bg-surface/50 px-4 sm:px-6 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {showMobileNav && (
                <div className="flex sm:hidden w-full flex-wrap gap-2 pb-2 border-b border-border mb-2">
                  <Link href="/" className="px-3 py-1.5 bg-surface rounded-lg text-sm">Home</Link>
                  <Link href="/?type=series" className="px-3 py-1.5 bg-surface rounded-lg text-sm">TV Shows</Link>
                  <Link href="/?type=movies" className="px-3 py-1.5 bg-surface rounded-lg text-sm">Movies</Link>
                  <Link href="/settings" className="px-3 py-1.5 bg-surface rounded-lg text-sm">Settings</Link>
                  <button onClick={() => setShowFilters(!showFilters)} className="px-3 py-1.5 bg-accent/20 text-accent rounded-lg text-sm ml-auto">
                    Filters {showFilters ? "▲" : "▼"}
                  </button>
                </div>
              )}
              {showFilters && (
                <>
            <select
              value={genre}
              onChange={(event) => onGenreChange(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border-hover"
            >
              <option value="All">All genres</option>
              {genres.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <SearchableDropdown
              options={people}
              value={person}
              onChange={onPersonChange}
              placeholder="Search people..."
              allLabel="All people"
              className="min-w-[160px]"
            />

            <select
              value={minRating ?? ""}
              onChange={(event) =>
                onMinRatingChange(event.target.value === "" ? null : Number(event.target.value))
              }
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border-hover"
            >
              <option value="">Any rating</option>
              {[10, 9, 8, 7, 6, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating}+
                </option>
              ))}
            </select>

            <select
              value={watched}
              onChange={(event) => onWatchedChange(event.target.value as WatchedFilter)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border-hover"
            >
              <option value="all">All</option>
              <option value="watched">Watched</option>
              <option value="unwatched">Unwatched</option>
            </select>

            <select
              value={mediaType}
              onChange={(event) => onMediaTypeChange(event.target.value as MediaTypeFilter)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border-hover"
            >
              <option value="all">All media</option>
              <option value="movies">Movies</option>
              <option value="series">TV Shows</option>
            </select>

            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as "title" | "rating" | "recent")}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border-hover"
            >
              <option value="title">Sort: Title</option>
              <option value="rating">Sort: Rating</option>
              <option value="recent">Sort: Recently Synced</option>
            </select>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
