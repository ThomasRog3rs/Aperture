"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clapperboard, FolderOpen, Loader2 } from "lucide-react";
import { MovieGrid } from "@/components/MovieGrid";
import { StatusBanner } from "@/components/StatusBanner";
import { TopBar } from "@/components/TopBar";
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
};

export function LibraryView() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [watched, setWatched] = useState<"all" | "watched" | "unwatched">("all");
  const [sort, setSort] = useState<"title" | "rating" | "recent">("rating");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [libraryRootPath, setLibraryRootPath] = useState<string | null>(null);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);

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
  }, []);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (genre && genre !== "All") params.set("genre", genre);
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
  }, [debouncedQuery, genre, minRating, watched, sort]);

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

  const handleRate = useCallback(async (id: string, rating: number | null) => {
    await fetch("/api/rating", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, personalRating: rating }),
    });
    setMovies((prev) =>
      prev.map((movie) =>
        movie.id === id ? { ...movie, personalRating: rating } : movie
      )
    );
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

  const items = useMemo(() => {
    const merged: Array<
      | { type: "movie"; movie: Movie }
      | { type: "series"; series: Series }
    > = [
      ...movies.map((movie) => ({ type: "movie" as const, movie })),
      ...series.map((entry) => ({ type: "series" as const, series: entry })),
    ];

    const getTitle = (entry: (typeof merged)[number]) =>
      entry.type === "movie" ? entry.movie.titleClean : entry.series.titleClean;
    const getSeriesRating = (entry: Series) => {
      const ratings = entry.seasons
        .map((season) => season.tmdbRating)
        .filter((value): value is number => typeof value === "number");
      if (ratings.length === 0) return null;
      return Math.max(...ratings);
    };
    const getRating = (entry: (typeof merged)[number]) =>
      entry.type === "movie"
        ? entry.movie.tmdbRating
        : getSeriesRating(entry.series);
    const getSeriesSyncedAt = (entry: Series) => {
      if (entry.seasons.length === 0) return 0;
      return Math.max(...entry.seasons.map((season) => season.lastSyncedAt));
    };
    const getSyncedAt = (entry: (typeof merged)[number]) =>
      entry.type === "movie"
        ? entry.movie.lastSyncedAt
        : getSeriesSyncedAt(entry.series);

    merged.sort((a, b) => {
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

    return merged;
  }, [movies, series, sort]);

  return (
    <div className="min-h-screen">
      <TopBar
        query={query}
        onQueryChange={setQuery}
        genres={availableGenres}
        genre={genre}
        onGenreChange={setGenre}
        minRating={minRating}
        onMinRatingChange={setMinRating}
        watched={watched}
        onWatchedChange={setWatched}
        sort={sort}
        onSortChange={setSort}
        onSync={handleSync}
        syncing={syncing}
        lastSyncedAt={lastSyncedAt}
        libraryRootPath={libraryRootPath}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 2xl:max-w-screen-2xl">
        {notice ? (
          <StatusBanner tone={notice.tone} message={notice.message} />
        ) : null}

        {/* ── No library path configured ── */}
        {!libraryRootPath ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-surface p-12 text-center 2xl:p-16">
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
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted 2xl:p-12 2xl:text-base">
            <Loader2 className="h-5 w-5 animate-spin text-accent 2xl:h-6 2xl:w-6" />
            Loading your collection...
          </div>
        ) : null}

        {/* ── Empty collection ────────────── */}
        {!loading &&
        libraryRootPath &&
        movies.length === 0 &&
        series.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center 2xl:p-16">
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
          <MovieGrid
            key={items.map((entry) =>
              entry.type === "movie" ? entry.movie.id : entry.series.id
            ).join(",")}
            items={items}
            onPlayMovie={handlePlay}
            onRateMovie={handleRate}
            onWatchedMovie={handleWatched}
            blurXxxRated={true}
          />
        ) : null}
      </main>
    </div>
  );
}
