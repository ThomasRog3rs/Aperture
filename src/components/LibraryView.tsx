"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Clapperboard, FolderOpen, Loader2 } from "lucide-react";
import { MovieGrid } from "@/components/MovieGrid";
import { HeroFeatured } from "@/components/HeroFeatured";
import { ContentRow } from "@/components/ContentRow";
import { StatusBanner } from "@/components/StatusBanner";
import { MainHeader } from "@/components/MainHeader";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Movie, Series } from "@/lib/types";

type SyncSummary = {
  scanned: number;
  updated: number;
  notFound: number;
  errors: number;
};

type SettingsResponse = {
  libraryRootPath: string | null;
};

type FilterOptionsResponse = {
  genres: string[];
  people: string[];
};

export function LibraryView() {
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as "all" | "movies" | "series") || "all";
  const initialSort = (searchParams.get("sort") as "title" | "rating" | "recent") || "rating";
  const initialWatched = (searchParams.get("watched") as "all" | "watched" | "unwatched") || "all";

  const [movies, setMovies] = useState<Movie[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [person, setPerson] = useState("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [watched, setWatched] = useState<"all" | "watched" | "unwatched">(initialWatched);
  const [mediaType, setMediaType] = useState<"all" | "movies" | "series">(initialType);
  const [sort, setSort] = useState<"title" | "rating" | "recent">(initialSort);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const typeParam = searchParams.get("type") as "all" | "movies" | "series";
    const sortParam = searchParams.get("sort") as "title" | "rating" | "recent";
    const watchedParam = searchParams.get("watched") as "all" | "watched" | "unwatched";
    
    if (typeParam) {
      if (typeParam !== mediaType) setMediaType(typeParam);
    } else if (mediaType !== "all") {
      setMediaType("all");
    }
    if (sortParam && sortParam !== sort) setSort(sortParam);
    if (watchedParam && watchedParam !== watched) setWatched(watchedParam);
  }, [searchParams]);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [libraryRootPath, setLibraryRootPath] = useState<string | null>(null);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availablePeople, setAvailablePeople] = useState<string[]>([]);

  const debouncedQuery = useDebouncedValue(query, 350);

  const fetchSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    const data = (await response.json()) as SettingsResponse;
    setLibraryRootPath(data.libraryRootPath ?? null);
  }, []);

  const fetchFilterOptions = useCallback(async () => {
    const response = await fetch("/api/filter-options");
    const data = (await response.json()) as FilterOptionsResponse;
    setAvailableGenres(data.genres ?? []);
    setAvailablePeople(data.people ?? []);
  }, []);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (genre && genre !== "All") params.set("genre", genre);
    if (person.trim()) params.set("person", person.trim());
    if (minRating !== null) {
      params.set("minPersonalRating", String(minRating));
    }
    if (watched !== "all") params.set("watched", watched);
    params.set("sort", sort);

    const [moviesResponse, seriesResponse] = await Promise.all([
      fetch(`/api/movies?${params.toString()}`),
      fetch(`/api/series?${params.toString()}`),
    ]);
    const moviesData = (await moviesResponse.json()) as { movies: Movie[] };
    const seriesData = (await seriesResponse.json()) as { series: Series[] };
    setMovies(moviesData.movies ?? []);
    setSeries(seriesData.series ?? []);
    setLoading(false);
  }, [debouncedQuery, genre, person, minRating, watched, sort]);

  useEffect(() => {
    fetchSettings().catch(() => {
      setNotice({ tone: "error", message: "Failed to load settings." });
    });
  }, [fetchSettings]);

  useEffect(() => {
    fetchFilterOptions().catch(() => {
      setNotice({ tone: "error", message: "Failed to load filter options." });
    });
  }, [fetchFilterOptions]);

  useEffect(() => {
    fetchLibrary().catch(() => {
      setNotice({ tone: "error", message: "Failed to load library." });
      setLoading(false);
    });
  }, [fetchLibrary]);

  const lastSyncedAt = useMemo(() => {
    const seasonTimestamps = series.flatMap((entry) =>
      entry.seasons.map((season) => season.lastSyncedAt)
    );
    const timestamps = [...movies.map((entry) => entry.lastSyncedAt), ...seasonTimestamps]
      .filter((value) => typeof value === "number");
    if (timestamps.length === 0) return null;
    return Math.max(...timestamps);
  }, [movies, series]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = (await response.json()) as
        | (SyncSummary & { error?: string })
        | {
            movies: SyncSummary;
            seasons: SyncSummary;
            error?: string;
          };
      if (!response.ok) {
        const error =
          "error" in data && data.error ? data.error : "Sync failed.";
        throw new Error(error);
      }
      const summary =
        "movies" in data && "seasons" in data
          ? {
              updated: data.movies.updated + data.seasons.updated,
              notFound: data.movies.notFound + data.seasons.notFound,
              errors: data.movies.errors + data.seasons.errors,
              label: `${data.movies.updated} movies, ${data.seasons.updated} seasons`,
            }
          : {
              updated: data.updated,
              notFound: data.notFound,
              errors: data.errors,
              label: `${data.updated} movies`,
            };
      setNotice({
        tone: summary.errors > 0 ? "error" : "success",
        message: `Synced ${summary.label} (${summary.notFound} not found, ${summary.errors} errors).`,
      });
      await fetchLibrary();
      fetchFilterOptions().catch(() => {
        setNotice((current) =>
          current?.tone === "success"
            ? current
            : { tone: "error", message: "Failed to refresh filters." }
        );
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to sync library.",
      });
    } finally {
      setSyncing(false);
    }
  }, [fetchLibrary]);

  const handlePlay = useCallback(async (movie: Movie) => {
    if (!movie.filePath) {
      setNotice({ tone: "error", message: "File path missing for this movie." });
      return;
    }
    try {
      const response = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: movie.filePath }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to launch player.");
      }
      setNotice({ tone: "success", message: `Playing ${movie.titleClean}.` });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to launch player.",
      });
    }
  }, []);

  const handleWatched = useCallback(async (id: string, watchedValue: boolean) => {
    try {
      const response = await fetch(`/api/movies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watched: watchedValue }),
      });
      const data = (await response.json()) as { movie?: Movie; error?: string };
      if (!response.ok || !data.movie) {
        throw new Error(data.error || "Failed to update watched status.");
      }
      setMovies((prev) =>
        prev.map((m) => (m.id === id ? { ...m, watched: watchedValue } : m))
      );
    } catch {
      setNotice({
        tone: "error",
        message: "Failed to update watched status.",
      });
    }
  }, []);

  const getTitle = useCallback((entry: { type: "movie"; movie: Movie } | { type: "series"; series: Series }) =>
    entry.type === "movie" ? entry.movie.titleClean : entry.series.titleClean, []);

  const getSeriesRating = useCallback((entry: Series) => {
    const ratings = entry.seasons
      .map((season) => season.tmdbRating)
      .filter((value): value is number => typeof value === "number");
    if (ratings.length === 0) return null;
    return Math.max(...ratings);
  }, []);

  const getRating = useCallback((entry: { type: "movie"; movie: Movie } | { type: "series"; series: Series }) =>
    entry.type === "movie"
      ? entry.movie.tmdbRating
      : getSeriesRating(entry.series), [getSeriesRating]);

  const getSeriesSyncedAt = useCallback((entry: Series) => {
    if (entry.seasons.length === 0) return 0;
    return Math.max(...entry.seasons.map((season) => season.lastSyncedAt));
  }, []);

  const getSyncedAt = useCallback((entry: { type: "movie"; movie: Movie } | { type: "series"; series: Series }) =>
    entry.type === "movie"
      ? entry.movie.lastSyncedAt
      : getSeriesSyncedAt(entry.series), [getSeriesSyncedAt]);

  const items = useMemo(() => {
    const merged: Array<
      | { type: "movie"; movie: Movie }
      | { type: "series"; series: Series }
    > = [
      ...movies.map((movie) => ({ type: "movie" as const, movie })),
      ...series.map((entry) => ({ type: "series" as const, series: entry })),
    ];

    const filtered =
      mediaType === "all"
        ? merged
        : merged.filter((entry) =>
            mediaType === "movies"
              ? entry.type === "movie"
              : entry.type === "series"
          );

    filtered.sort((a, b) => {
      if (sort === "rating") {
        const aRating = getRating(a);
        const bRating = getRating(b);
        if (aRating == null && bRating != null) return 1;
        if (aRating != null && bRating == null) return -1;
        if (aRating != null && bRating != null && aRating !== bRating) {
          return bRating - aRating;
        }
      } else if (sort === "recent") {
        const diff = getSyncedAt(b) - getSyncedAt(a);
        if (diff !== 0) return diff;
      }
      return getTitle(a).localeCompare(getTitle(b));
    });

    return filtered;
  }, [movies, series, mediaType, sort, getTitle, getRating, getSyncedAt]);

  const featuredMovieItem = useMemo(() => {
    const eligibleMovies = movies.filter((m) => !m.xxxRated);
    const eligibleSeries = series.filter(
      (s) => s.seasons.length > 0 && !s.seasons[0].xxxRated
    );
    const combined: Array<
      | { type: "movie"; movie: Movie }
      | { type: "series"; series: Series }
    > = [
      ...eligibleMovies.map((movie) => ({ type: "movie" as const, movie })),
      ...eligibleSeries.map((s) => ({ type: "series" as const, series: s })),
    ];
    if (combined.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * combined.length);
    return combined[randomIndex];
  }, [movies, series]);

  const hasFilters = query !== "" || genre !== "All" || person !== "" || minRating !== null;
  const showRows = !hasFilters && mediaType === "all" && sort === "rating";

  return (
    <div className="min-h-screen">
      <MainHeader
        query={query}
        onQueryChange={setQuery}
        genres={availableGenres}
        genre={genre}
        onGenreChange={setGenre}
        people={availablePeople}
        person={person}
        onPersonChange={setPerson}
        minRating={minRating}
        onMinRatingChange={setMinRating}
        watched={watched}
        onWatchedChange={setWatched}
        mediaType={mediaType}
        onMediaTypeChange={setMediaType}
        sort={sort}
        onSortChange={setSort}
        onSync={handleSync}
        syncing={syncing}
        libraryRootPath={libraryRootPath}
      />

      <main className={`mx-auto flex w-full flex-col gap-6 ${showRows ? "max-w-none pb-8" : "max-w-6xl px-6 py-8 2xl:max-w-screen-2xl"}`}>
        {notice ? (
          <div className={showRows ? "px-6 mt-4" : ""}>
            <StatusBanner tone={notice.tone} message={notice.message} />
          </div>
        ) : null}

        {/* ── No library path configured ── */}
        {!libraryRootPath ? (
          <div className={`flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-surface p-12 text-center 2xl:p-16 ${showRows ? "mx-6 mt-6" : ""}`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-muted text-accent 2xl:h-16 2xl:w-16">
              <FolderOpen className="h-7 w-7 2xl:h-8 2xl:w-8" />
            </div>
            <div>
              <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
                Welcome to Aperture
              </p>
              <p className="mt-1 max-w-md text-sm text-muted 2xl:text-base">
                Head over to Settings and point Aperture at your movie library
                to get started.
              </p>
            </div>
          </div>
        ) : null}

        {/* ── Loading ─────────────────────── */}
        {loading ? (
          <div className={`flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted 2xl:p-12 2xl:text-base ${showRows ? "mx-6 mt-6" : ""}`}>
            <Loader2 className="h-5 w-5 animate-spin text-accent 2xl:h-6 2xl:w-6" />
            Loading your collection...
          </div>
        ) : null}

        {/* ── Empty collection ────────────── */}
        {!loading &&
        libraryRootPath &&
        movies.length === 0 &&
        series.length === 0 ? (
          <div className={`flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center 2xl:p-16 ${showRows ? "mx-6 mt-6" : ""}`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-muted text-accent 2xl:h-16 2xl:w-16">
              <Clapperboard className="h-7 w-7 2xl:h-8 2xl:w-8" />
            </div>
            <div>
              <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
                No titles yet
              </p>
              <p className="mt-1 max-w-md text-sm text-muted 2xl:text-base">
                Click <strong className="text-foreground">Sync Library</strong>{" "}
                above to scan your collection and pull in metadata.
              </p>
            </div>
          </div>
        ) : null}

        {items.length > 0 ? (
          showRows ? (
            <div className="flex flex-col w-full">
              <HeroFeatured item={featuredMovieItem} onPlay={handlePlay} />
              
              <div className="flex flex-col gap-6 -mt-12 sm:-mt-24 relative z-20 pb-12">
                <ContentRow 
                  title="" 
                  items={items.filter(i => i.type === "movie" ? !i.movie.watched : i.series.seasons.some(s => s.watched)).slice(0, 20)}
                  onPlayMovie={handlePlay}
                  onWatchedMovie={handleWatched}
                  blurXxxRated={true}
                />

              <ContentRow 
                title="Top Rated Movies" 
                items={items.filter(i => i.type === "movie").sort((a, b) => (getRating(b) || 0) - (getRating(a) || 0)).slice(0, 20)}
                onPlayMovie={handlePlay}
                onWatchedMovie={handleWatched}
                blurXxxRated={true}
              />
                <ContentRow 
                  title="Top Rated TV Shows" 
                  items={items.filter(i => i.type === "series").sort((a, b) => (getRating(b) || 0) - (getRating(a) || 0)).slice(0, 20)}
                  onPlayMovie={handlePlay}
                  onWatchedMovie={handleWatched}
                  blurXxxRated={true}
                />
              </div>
            </div>
          ) : (
            <MovieGrid
              key={items.map((entry) =>
                entry.type === "movie" ? entry.movie.id : entry.series.id
              ).join(",")}
              items={items}
              onPlayMovie={handlePlay}
              onWatchedMovie={handleWatched}
              blurXxxRated={true}
            />
          )
        ) : null}
      </main>
    </div>
  );
}
