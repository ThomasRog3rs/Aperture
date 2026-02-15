"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clapperboard, FolderOpen, Loader2 } from "lucide-react";
import { MovieGrid } from "@/components/MovieGrid";
import { StatusBanner } from "@/components/StatusBanner";
import { TopBar } from "@/components/TopBar";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Movie } from "@/lib/types";

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

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (genre && genre !== "All") params.set("genre", genre);
    if (minRating !== null) {
      params.set("minPersonalRating", String(minRating));
    }
    if (watched !== "all") params.set("watched", watched);
    params.set("sort", sort);

    const response = await fetch(`/api/movies?${params.toString()}`);
    const data = (await response.json()) as { movies: Movie[] };
    setMovies(data.movies ?? []);
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
    fetchMovies().catch(() => {
      setNotice({ tone: "error", message: "Failed to load movies." });
      setLoading(false);
    });
  }, [fetchMovies]);

  const lastSyncedAt = useMemo(() => {
    if (movies.length === 0) return null;
    return movies.reduce((latest, movie) => {
      return movie.lastSyncedAt > latest ? movie.lastSyncedAt : latest;
    }, movies[0].lastSyncedAt);
  }, [movies]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = (await response.json()) as SyncSummary & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Sync failed.");
      }
      setNotice({
        tone: data.errors > 0 ? "error" : "success",
        message: `Synced ${data.updated} movies (${data.notFound} not found, ${data.errors} errors).`,
      });
      await fetchMovies();
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
  }, [fetchMovies]);

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

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        {notice ? (
          <StatusBanner tone={notice.tone} message={notice.message} />
        ) : null}

        {/* ── No library path configured ── */}
        {!libraryRootPath ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <FolderOpen className="h-7 w-7" />
            </div>
            <div>
              <p className="font-serif text-lg font-medium text-foreground">
                Welcome to Aperture
              </p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Head over to Settings and point Aperture at your movie library
                to get started.
              </p>
            </div>
          </div>
        ) : null}

        {/* ── Loading ─────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Loading your collection...
          </div>
        ) : null}

        {/* ── Empty collection ────────────── */}
        {!loading && libraryRootPath && movies.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <Clapperboard className="h-7 w-7" />
            </div>
            <div>
              <p className="font-serif text-lg font-medium text-foreground">
                No movies yet
              </p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Click <strong className="text-foreground">Sync Library</strong>{" "}
                above to scan your collection and pull in metadata.
              </p>
            </div>
          </div>
        ) : null}

        {movies.length > 0 ? (
          <MovieGrid
            key={movies.map((m) => m.id).join(",")}
            movies={movies}
            onPlay={handlePlay}
            onRate={handleRate}
            onWatched={handleWatched}
            blurXxxRated={true}
          />
        ) : null}
      </main>
    </div>
  );
}
