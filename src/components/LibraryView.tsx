"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clapperboard, FolderOpen, Loader2, Sparkles, Star, Tv } from "lucide-react";
import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { ContentRow } from "@/components/ContentRow";
import { HeroFeatured } from "@/components/HeroFeatured";
import { MagnetFallbackResults } from "@/components/MagnetFallbackResults";
import { MainHeader } from "@/components/MainHeader";
import { Modal } from "@/components/Modal";
import { MovieGrid } from "@/components/MovieGrid";
import { StatusBanner } from "@/components/StatusBanner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { MagnetSearchResult, Movie, Series } from "@/lib/types";
import type { ContinueWatchingItem } from "@/lib/types";

type SyncProgress = {
  phase: "scanning" | "movies" | "seasons" | "cleanup" | "saving";
  current: number;
  total: number;
  title?: string;
};

type SyncEvent =
  | { type: "phase"; phase: SyncProgress["phase"] }
  | { type: "progress"; phase: "movies" | "seasons"; current: number; total: number; title: string }
  | { type: "complete"; summary: IncrementalSyncResponse }
  | { type: "error"; error: string }
  | { type: "cancelled" };

type IncrementalSyncResponse = {
  mode?: "incremental";
  folders?: {
    checked: number;
    rootChecked: number;
    seasonChecked: number;
    changed: number;
    rescanned: number;
  };
  movies: { updated: number; notFound: number; errors: number; deleted?: number };
  seasons: { updated: number; notFound: number; errors: number; deleted?: number };
  error?: string;
};

type SettingsResponse = {
  libraryRootPath: string | null;
};

type FilterOptionsResponse = {
  genres: string[];
  people: string[];
};

type MagnetSearchResponse = {
  results: MagnetSearchResult[];
  error?: string;
};

export function LibraryView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType =
    (searchParams.get("type") as "all" | "movies" | "series") || "all";
  const initialSort =
    (searchParams.get("sort") as "title" | "rating" | "recent") || "rating";
  const initialWatched =
    (searchParams.get("watched") as "all" | "watched" | "unwatched") || "all";

  const [movies, setMovies] = useState<Movie[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [person, setPerson] = useState("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [watched, setWatched] = useState<"all" | "watched" | "unwatched">(
    initialWatched
  );
  const [mediaType, setMediaType] = useState<"all" | "movies" | "series">(
    initialType
  );
  const [sort, setSort] = useState<"title" | "rating" | "recent">(initialSort);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [libraryRootPath, setLibraryRootPath] = useState<string | null>(null);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availablePeople, setAvailablePeople] = useState<string[]>([]);
  const [fallbackResults, setFallbackResults] = useState<MagnetSearchResult[]>(
    []
  );
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [pendingMagnet, setPendingMagnet] =
    useState<MagnetSearchResult | null>(null);
  const [continueWatchingItems, setContinueWatchingItems] = useState<ContinueWatchingItem[]>([]);

  useEffect(() => {
    const typeParam = searchParams.get("type") as
      | "all"
      | "movies"
      | "series";
    const sortParam = searchParams.get("sort") as
      | "title"
      | "rating"
      | "recent";
    const watchedParam = searchParams.get("watched") as
      | "all"
      | "watched"
      | "unwatched";

    if (typeParam) {
      if (typeParam !== mediaType) setMediaType(typeParam);
    } else if (mediaType !== "all") {
      setMediaType("all");
    }
    if (sortParam && sortParam !== sort) setSort(sortParam);
    if (watchedParam && watchedParam !== watched) setWatched(watchedParam);
  }, [mediaType, searchParams, sort, watched]);

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

  const fetchContinueWatching = useCallback(async () => {
    const response = await fetch("/api/continue-watching");
    const data = (await response.json()) as { items: ContinueWatchingItem[] };
    setContinueWatchingItems(data.items ?? []);
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
  }, [debouncedQuery, genre, minRating, person, sort, watched]);

  useEffect(() => {
    fetchContinueWatching().catch(() => {
      // Silently fail — Continue Watching is best-effort
    });
  }, [fetchContinueWatching]);

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

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncProgress({ phase: "scanning", current: 0, total: 0 });
    setNotice(null);

    const abort = new AbortController();
    syncAbortRef.current = abort;

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        signal: abort.signal,
      });

      if (!response.body) throw new Error("No response body.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: SyncEvent;
          try {
            event = JSON.parse(line.slice(6)) as SyncEvent;
          } catch {
            continue;
          }

          if (event.type === "phase") {
            setSyncProgress({ phase: event.phase, current: 0, total: 0 });
          } else if (event.type === "progress") {
            setSyncProgress({
              phase: event.phase,
              current: event.current,
              total: event.total,
              title: event.title,
            });
          } else if (event.type === "complete") {
            const data = event.summary;
            const summary = {
              updated: data.movies.updated + data.seasons.updated,
              notFound: data.movies.notFound + data.seasons.notFound,
              errors: data.movies.errors + data.seasons.errors,
              deleted: (data.movies.deleted ?? 0) + (data.seasons.deleted ?? 0),
              label: `${data.movies.updated} movies, ${data.seasons.updated} seasons`,
              foldersChecked: data.folders?.checked ?? null,
              foldersRescanned: data.folders?.rescanned ?? null,
            };
            const deletedPart = summary.deleted > 0 ? `, ${summary.deleted} deleted` : "";
            const folderPart =
              typeof summary.foldersChecked === "number" &&
              typeof summary.foldersRescanned === "number"
                ? ` Checked ${summary.foldersChecked} folders, rescanned ${summary.foldersRescanned}.`
                : "";
            setNotice({
              tone: summary.errors > 0 ? "error" : "success",
              message: `Synced ${summary.label} (${summary.notFound} not found${deletedPart}, ${summary.errors} errors).${folderPart}`,
            });
            await fetchLibrary();
            fetchContinueWatching().catch(() => {});
            fetchFilterOptions().catch(() => {
              setNotice((current) =>
                current?.tone === "success"
                  ? current
                  : { tone: "error", message: "Failed to refresh filters." }
              );
            });
          } else if (event.type === "error") {
            setNotice({ tone: "error", message: event.error });
          } else if (event.type === "cancelled") {
            setNotice({ tone: "info", message: "Sync cancelled." });
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setNotice({ tone: "info", message: "Sync cancelled." });
      } else {
        setNotice({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to sync library.",
        });
      }
    } finally {
      setSyncing(false);
      setSyncProgress(null);
      syncAbortRef.current = null;
    }
  }, [fetchFilterOptions, fetchLibrary, fetchContinueWatching]);

  const handleCancelSync = useCallback(() => {
    syncAbortRef.current?.abort();
    fetch("/api/sync", { method: "DELETE" }).catch(() => {});
  }, []);

  const handlePlay = useCallback((movie: Movie) => {
    router.push(`/movies/${movie.id}`);
  }, [router]);

  const handleWatched = useCallback(async (id: string, watchedValue: boolean) => {
    try {
      const response = await fetch(`/api/movies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watched: watchedValue }),
      });
      const data = (await response.json()) as {
        movie?: Movie;
        error?: string;
      };
      if (!response.ok || !data.movie) {
        throw new Error(data.error || "Failed to update watched status.");
      }
      setMovies((prev) =>
        prev.map((movie) =>
          movie.id === id ? { ...movie, watched: watchedValue } : movie
        )
      );
    } catch {
      setNotice({
        tone: "error",
        message: "Failed to update watched status.",
      });
    }
  }, []);

  const getTitle = useCallback(
    (
      entry: { type: "movie"; movie: Movie } | { type: "series"; series: Series }
    ) => (entry.type === "movie" ? entry.movie.titleClean : entry.series.titleClean),
    []
  );

  const getSeriesRating = useCallback((entry: Series) => {
    const ratings = entry.seasons
      .map((season) => season.tmdbRating)
      .filter((value): value is number => typeof value === "number");
    if (ratings.length === 0) return null;
    return Math.max(...ratings);
  }, []);

  const getRating = useCallback(
    (
      entry: { type: "movie"; movie: Movie } | { type: "series"; series: Series }
    ) =>
      entry.type === "movie"
        ? entry.movie.tmdbRating
        : getSeriesRating(entry.series),
    [getSeriesRating]
  );

  const getSeriesSyncedAt = useCallback((entry: Series) => {
    if (entry.seasons.length === 0) return 0;
    return Math.max(...entry.seasons.map((season) => season.lastSyncedAt));
  }, []);

  const getSyncedAt = useCallback(
    (
      entry: { type: "movie"; movie: Movie } | { type: "series"; series: Series }
    ) =>
      entry.type === "movie"
        ? entry.movie.lastSyncedAt
        : getSeriesSyncedAt(entry.series),
    [getSeriesSyncedAt]
  );

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
  }, [getRating, getSyncedAt, getTitle, mediaType, movies, series, sort]);

  const featuredMovieItem = useMemo(() => {
    const eligibleMovies = movies.filter((movie) => !movie.xxxRated);
    const eligibleSeries = series.filter(
      (entry) => entry.seasons.length > 0 && !entry.seasons[0].xxxRated
    );
    const combined: Array<
      | { type: "movie"; movie: Movie }
      | { type: "series"; series: Series }
    > = [
      ...eligibleMovies.map((movie) => ({ type: "movie" as const, movie })),
      ...eligibleSeries.map((entry) => ({ type: "series" as const, series: entry })),
    ];
    if (combined.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * combined.length);
    return combined[randomIndex];
  }, [movies, series]);

  const unwatchedCarouselItems = useMemo(() => {
    const RESERVOIR_SIZE = 20;
    type Entry =
      | { type: "movie"; movie: Movie }
      | { type: "series"; series: Series };

    const isUnwatched = (entry: Entry): boolean =>
      entry.type === "movie"
        ? !entry.movie.watched
        : !entry.series.seasons.some((s) => s.watched);

    const isXxxRated = (entry: Entry): boolean =>
      entry.type === "movie"
        ? entry.movie.xxxRated
        : entry.series.seasons.some((s) => s.xxxRated);

    const reservoir: Entry[] = [];
    let unwatchedCount = 0;

    for (const entry of items) {
      if (isXxxRated(entry) || !isUnwatched(entry)) continue;
      unwatchedCount++;
      if (reservoir.length < RESERVOIR_SIZE) {
        reservoir.push(entry);
      } else {
        const r = Math.floor(Math.random() * unwatchedCount);
        if (r < RESERVOIR_SIZE) reservoir[r] = entry;
      }
    }
    return reservoir;
  }, [items]);

  const activeQuery = debouncedQuery.trim();
  const hasFilters =
    query !== "" || genre !== "All" || person !== "" || minRating !== null;
  const hasActiveConstraints =
    hasFilters || watched !== "all" || mediaType !== "all";
  const showRows = !hasFilters && mediaType === "all" && sort === "rating";
  const showMagnetFallback =
    Boolean(libraryRootPath) &&
    !loading &&
    activeQuery.length > 0 &&
    items.length === 0;

  useEffect(() => {
    if (!showMagnetFallback) {
      setFallbackResults([]);
      setFallbackLoading(false);
      setFallbackError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setFallbackLoading(true);
    setFallbackError(null);

    fetch(`/api/magnet-search?q=${encodeURIComponent(activeQuery)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as MagnetSearchResponse;
        if (!response.ok) {
          throw new Error(data.error || "Magnet search failed.");
        }
        if (!cancelled) {
          setFallbackResults(data.results ?? []);
        }
      })
      .catch((error) => {
        if (cancelled || controller.signal.aborted) return;
        setFallbackResults([]);
        setFallbackError(
          error instanceof Error
            ? error.message
            : "Failed to load fallback results."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setFallbackLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeQuery, showMagnetFallback]);

  const handleCopyMagnet = useCallback(async (result: MagnetSearchResult) => {
    try {
      await navigator.clipboard.writeText(result.magnet);
      setNotice({
        tone: "success",
        message: "Magnet link copied. Turn on your VPN before opening it.",
      });
    } catch {
      setNotice({
        tone: "error",
        message: "Failed to copy magnet link.",
      });
    }
  }, []);

  const handleOpenMagnet = useCallback((result: MagnetSearchResult) => {
    setPendingMagnet(result);
  }, []);

  const confirmOpenMagnet = useCallback(() => {
    if (!pendingMagnet) return;
    const magnet = pendingMagnet.magnet;
    setPendingMagnet(null);
    window.location.assign(magnet);
  }, [pendingMagnet]);

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
        syncProgress={syncProgress}
        onCancelSync={handleCancelSync}
        libraryRootPath={libraryRootPath}
      />

      <main
        className={`mx-auto flex w-full flex-col gap-6 ${showRows ? "max-w-none pb-8" : "max-w-6xl px-6 py-8 2xl:max-w-screen-2xl"}`}
      >
        {notice ? (
          <div className={showRows ? "px-6 mt-4" : ""}>
            <StatusBanner tone={notice.tone} message={notice.message} />
          </div>
        ) : null}

        {!libraryRootPath ? (
          <div
            className={`flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-surface p-12 text-center 2xl:p-16 ${showRows ? "mx-6 mt-6" : ""}`}
          >
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

        {loading ? (
          <div
            className={`flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted 2xl:p-12 2xl:text-base ${showRows ? "mx-6 mt-6" : ""}`}
          >
            <Loader2 className="h-5 w-5 animate-spin text-accent 2xl:h-6 2xl:w-6" />
            Loading your collection...
          </div>
        ) : null}

        {!loading &&
        libraryRootPath &&
        !hasActiveConstraints &&
        movies.length === 0 &&
        series.length === 0 ? (
          <div
            className={`flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center 2xl:p-16 ${showRows ? "mx-6 mt-6" : ""}`}
          >
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
            <div className="flex w-full flex-col">
              <HeroFeatured item={featuredMovieItem} onPlay={handlePlay} />

              <div className="relative z-20 mt-10 flex w-full max-w-7xl mx-auto flex-col gap-6 pb-16 sm:mt-14 px-6 lg:px-12 2xl:px-16">
                {continueWatchingItems.length > 0 && (
                  <ContinueWatchingRow items={continueWatchingItems} />
                )}
                <ContentRow
                  title="Something New"
                  icon={Sparkles}
                  items={unwatchedCarouselItems}
                  onPlayMovie={handlePlay}
                  onWatchedMovie={handleWatched}
                  blurXxxRated={true}
                />

                <ContentRow
                  title="Top Rated Movies"
                  icon={Star}
                  items={items
                    .filter(
                      (entry) =>
                        entry.type === "movie" && !entry.movie.xxxRated
                    )
                    .sort((a, b) => (getRating(b) || 0) - (getRating(a) || 0))
                    .slice(0, 20)}
                  onPlayMovie={handlePlay}
                  onWatchedMovie={handleWatched}
                  blurXxxRated={true}
                />
                <ContentRow
                  title="Top Rated TV Shows"
                  icon={Tv}
                  items={items
                    .filter(
                      (entry) =>
                        entry.type === "series" &&
                        !entry.series.seasons.some((s) => s.xxxRated)
                    )
                    .sort((a, b) => (getRating(b) || 0) - (getRating(a) || 0))
                    .slice(0, 20)}
                  onPlayMovie={handlePlay}
                  onWatchedMovie={handleWatched}
                  blurXxxRated={true}
                />
              </div>
            </div>
          ) : (
            <MovieGrid
              key={items
                .map((entry) =>
                  entry.type === "movie" ? entry.movie.id : entry.series.id
                )
                .join(",")}
              items={items}
              onPlayMovie={handlePlay}
              onWatchedMovie={handleWatched}
              blurXxxRated
            />
          )
        ) : null}

        {!loading && libraryRootPath && items.length === 0 && hasActiveConstraints ? (
          showMagnetFallback ? (
            <MagnetFallbackResults
              query={activeQuery}
              results={fallbackResults}
              loading={fallbackLoading}
              error={fallbackError}
              onOpen={handleOpenMagnet}
              onCopy={handleCopyMagnet}
            />
          ) : (
            <div
              className={`rounded-2xl border border-border bg-surface p-12 text-center 2xl:p-16 ${showRows ? "mx-6 mt-6" : ""}`}
            >
              <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
                No local matches
              </p>
              <p className="mt-1 text-sm text-muted 2xl:text-base">
                Try a broader search or clear some filters.
              </p>
            </div>
          )
        ) : null}
      </main>

      <Modal
        isOpen={pendingMagnet !== null}
        onClose={() => setPendingMagnet(null)}
        title="VPN reminder"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Turn on your VPN before opening magnet links.
          </p>
          {pendingMagnet ? (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">
                {pendingMagnet.name}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setPendingMagnet(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmOpenMagnet}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover"
            >
              I&apos;m on VPN
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
