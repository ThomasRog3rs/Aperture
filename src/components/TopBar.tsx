"use client";

import Link from "next/link";
import { Search, Aperture, RefreshCw } from "lucide-react";
import { SearchableDropdown } from "./SearchableDropdown";

type WatchedFilter = "all" | "watched" | "unwatched";
type MediaTypeFilter = "all" | "movies" | "series";

type TopBarProps = {
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
  lastSyncedAt?: number | null;
  libraryRootPath?: string | null;
};

export function TopBar({
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
  lastSyncedAt,
  libraryRootPath,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 2xl:max-w-screen-2xl">
        {/* ── Brand row ────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent 2xl:h-12 2xl:w-12">
              <Aperture className="h-5 w-5 2xl:h-6 2xl:w-6" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold tracking-tight 2xl:text-2xl">
                The Tom Collection
              </h1>
              <p className="text-xs text-muted 2xl:text-sm">
                {libraryRootPath ? libraryRootPath : "Library path not set"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground 2xl:py-2 2xl:text-base"
            >
              Settings
            </Link>
            <button
              onClick={onSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 2xl:py-2 2xl:text-base"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing" : "Sync Library"}
            </button>
          </div>
        </div>

        {/* ── Filters row ──────────────────── */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative flex w-full max-w-lg items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors focus-within:border-accent/50 2xl:max-w-xl 2xl:py-2 2xl:text-base">
            <Search className="h-4 w-4 text-muted 2xl:h-5 2xl:w-5" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search your collection..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-faint 2xl:text-base"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={genre}
              onChange={(event) => onGenreChange(event.target.value)}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-border-hover 2xl:py-2 2xl:text-base"
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
              className="min-w-[180px]"
            />

            <select
              value={minRating ?? ""}
              onChange={(event) =>
                onMinRatingChange(
                  event.target.value === "" ? null : Number(event.target.value)
                )
              }
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-border-hover 2xl:py-2 2xl:text-base"
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
              onChange={(event) =>
                onWatchedChange(event.target.value as WatchedFilter)
              }
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-border-hover 2xl:py-2 2xl:text-base"
            >
              <option value="all">All</option>
              <option value="watched">Watched</option>
              <option value="unwatched">Unwatched</option>
            </select>

            <select
              value={mediaType}
              onChange={(event) =>
                onMediaTypeChange(event.target.value as MediaTypeFilter)
              }
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-border-hover 2xl:py-2 2xl:text-base"
            >
              <option value="all">All media</option>
              <option value="movies">Movies</option>
              <option value="series">TV Shows</option>
            </select>

            <select
              value={sort}
              onChange={(event) =>
                onSortChange(
                  event.target.value as "title" | "rating" | "recent"
                )
              }
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-border-hover 2xl:py-2 2xl:text-base"
            >
              <option value="title">Sort: Title</option>
              <option value="rating">Sort: Rating</option>
              <option value="recent">Sort: Recently Synced</option>
            </select>
          </div>
        </div>

        {lastSyncedAt ? (
          <p className="text-xs text-faint 2xl:text-sm">
            Last synced {new Date(lastSyncedAt).toLocaleString()}
          </p>
        ) : null}
      </div>
    </header>
  );
}
