"use client";

import Link from "next/link";
import { Search, RefreshCw, Settings, User, Menu } from "lucide-react";
import { SearchableDropdown } from "./SearchableDropdown";
import { useState } from "react";

type WatchedFilter = "all" | "watched" | "unwatched";
type MediaTypeFilter = "all" | "movies" | "series";

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
  libraryRootPath?: string | null;
};

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
            <button
              onClick={onSync}
              disabled={syncing}
              className="hidden sm:flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync"}
            </button>
            <button
              onClick={onSync}
              disabled={syncing}
              className="sm:hidden flex items-center justify-center p-2 rounded-full bg-accent text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            </button>
            
            <div className="flex items-center gap-2 text-sm text-muted">
              <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-surface-strong sm:flex">
                <User className="h-4 w-4 text-muted" />
              </div>
              <span className="hidden lg:inline-block">
                {libraryRootPath ? libraryRootPath.split("/").pop() : "No Library"}
              </span>
            </div>
          </div>
        </div>

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
