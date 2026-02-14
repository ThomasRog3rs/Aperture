"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export function LibraryView() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [sort, setSort] = useState<"title" | "rating" | "recent">("title");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [libraryRootPath, setLibraryRootPath] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 350);

  const fetchSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    const data = (await response.json()) as SettingsResponse;
    setLibraryRootPath(data.libraryRootPath ?? null);
  }, []);

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (genre && genre !== "All") params.set("genre", genre);
    if (minRating !== null) {
      params.set("minPersonalRating", String(minRating));
    }
    params.set("sort", sort);

    const response = await fetch(`/api/movies?${params.toString()}`);
    const data = (await response.json()) as { movies: Movie[] };
    setMovies(data.movies ?? []);
    setLoading(false);
  }, [debouncedQuery, genre, minRating, sort]);

  useEffect(() => {
    fetchSettings().catch(() => {
      setNotice({ tone: "error", message: "Failed to load settings." });
    });
  }, [fetchSettings]);

  useEffect(() => {
    fetchMovies().catch(() => {
      setNotice({ tone: "error", message: "Failed to load movies." });
      setLoading(false);
    });
  }, [fetchMovies]);

  const availableGenres = useMemo(() => {
    const unique = new Set<string>();
    movies.forEach((movie) => {
      movie.genres.forEach((genreName) => unique.add(genreName));
    });
    return Array.from(unique).sort();
  }, [movies]);

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
        sort={sort}
        onSortChange={setSort}
        onSync={handleSync}
        syncing={syncing}
        lastSyncedAt={lastSyncedAt}
        libraryRootPath={libraryRootPath}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        {notice ? <StatusBanner tone={notice.tone} message={notice.message} /> : null}

        {!libraryRootPath ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-neutral-300">
            Set your library path in Settings to begin scanning your movies.
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-300">
            Loading your collection...
          </div>
        ) : null}

        {!loading && libraryRootPath && movies.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-300">
            No movies yet. Run a sync to scan your library.
          </div>
        ) : null}

        {movies.length > 0 ? (
          <MovieGrid movies={movies} onPlay={handlePlay} onRate={handleRate} />
        ) : null}
      </main>
    </div>
  );
}

