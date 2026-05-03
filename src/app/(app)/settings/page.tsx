"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Folder, RefreshCw, Trash2, Play, X, Film, Tv, RotateCcw } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";
import { Modal } from "@/components/Modal";

type SettingsResponse = {
  libraryRootPath: string | null;
  openSubtitlesConfigured?: boolean;
};

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

type DeletedStats = {
  movies: number;
  seasons: number;
  episodes: number;
  total: number;
};

type DeletedMovieRow = {
  id: string;
  titleClean: string;
  folderPath: string;
  posterPath: string | null;
  year: number | null;
  deletedAt: number;
};

type DeletedSeasonRow = {
  id: string;
  titleClean: string;
  seasonFolderPath: string;
  posterPath: string | null;
  seasonNumber: number | null;
  deletedAt: number;
  deletedEpisodeCount: number;
};

type DeletedItems = {
  movies: DeletedMovieRow[];
  seasons: DeletedSeasonRow[];
};

type PurgeConfirm = {
  movieIds: string[];
  seasonIds: string[];
  titles: string[];
  isAll: boolean;
};

function formatDeletedDate(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffDays = Math.floor((now - ts) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function SettingsPage() {
  const [libraryRootPath, setLibraryRootPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const [deletedStats, setDeletedStats] = useState<DeletedStats | null>(null);
  const [deletedItems, setDeletedItems] = useState<DeletedItems | null>(null);
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<string>>(new Set());
  const [selectedSeasonIds, setSelectedSeasonIds] = useState<Set<string>>(new Set());
  const [purgeConfirm, setPurgeConfirm] = useState<PurgeConfirm | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [playerMode, setPlayerMode] = useState<"browser" | "external">("browser");
  const [openSubtitlesConfigured, setOpenSubtitlesConfigured] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const fetchDeletedStats = useCallback(async () => {
    try {
      const response = await fetch("/api/deleted-stats");
      const data = (await response.json()) as DeletedStats;
      setDeletedStats(data);
    } catch {
      // Non-critical; silently ignore
    }
  }, []);

  const fetchDeletedItems = useCallback(async () => {
    try {
      const response = await fetch("/api/deleted-items");
      const data = (await response.json()) as DeletedItems;
      setDeletedItems(data);
    } catch {
      // Non-critical
    }
  }, []);

  const refreshDeleted = useCallback(async () => {
    await Promise.all([fetchDeletedStats(), fetchDeletedItems()]);
  }, [fetchDeletedStats, fetchDeletedItems]);

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data: SettingsResponse & { playerMode?: string }) => {
        setLibraryRootPath(data.libraryRootPath ?? "");
        if (data.playerMode === "external") setPlayerMode("external");
        setOpenSubtitlesConfigured(data.openSubtitlesConfigured ?? false);
      })
      .catch(() => {
        setNotice({ tone: "error", message: "Failed to load settings." });
      });
    void refreshDeleted();
  }, [refreshDeleted]);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryRootPath }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }
      setNotice({ tone: "success", message: "Library path saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
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
            void refreshDeleted();
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
  };

  const handleCancelSync = () => {
    syncAbortRef.current?.abort();
    fetch("/api/sync", { method: "DELETE" }).catch(() => {});
  };

  const executePurge = async (movieIds: string[], seasonIds: string[]) => {
    setActionInProgress(true);
    setPurgeConfirm(null);
    setNotice(null);
    try {
      const requests: Promise<Response>[] = [];
      if (movieIds.length > 0) {
        requests.push(
          fetch("/api/purge-deleted", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "movie", ids: movieIds }),
          })
        );
      }
      if (seasonIds.length > 0) {
        requests.push(
          fetch("/api/purge-deleted", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "season", ids: seasonIds }),
          })
        );
      }
      if (requests.length === 0) {
        // Purge all
        requests.push(fetch("/api/purge-deleted", { method: "POST" }));
      }
      await Promise.all(requests);
      const total = movieIds.length + seasonIds.length;
      setNotice({
        tone: "success",
        message:
          total > 0
            ? `Permanently removed ${total} item${total === 1 ? "" : "s"} from the database.`
            : "All deleted items permanently removed from the database.",
      });
      setSelectedMovieIds(new Set());
      setSelectedSeasonIds(new Set());
      void refreshDeleted();
    } catch {
      setNotice({ tone: "error", message: "Failed to purge items." });
    } finally {
      setActionInProgress(false);
    }
  };

  const handleConfirmPurge = () => {
    if (!purgeConfirm) return;
    if (purgeConfirm.isAll) {
      void executePurge([], []);
    } else {
      void executePurge(purgeConfirm.movieIds, purgeConfirm.seasonIds);
    }
  };

  const openPurgeConfirm = (movieIds: string[], seasonIds: string[], isAll: boolean) => {
    const movieTitles =
      deletedItems?.movies.filter((m) => movieIds.includes(m.id)).map((m) => m.titleClean) ?? [];
    const seasonTitles =
      deletedItems?.seasons.filter((s) => seasonIds.includes(s.id)).map((s) => s.titleClean) ?? [];
    setPurgeConfirm({
      movieIds,
      seasonIds,
      titles: [...movieTitles, ...seasonTitles],
      isAll,
    });
  };

  const handleRestoreItems = async (type: "movie" | "season", ids: string[]) => {
    if (ids.length === 0) return;
    setActionInProgress(true);
    setNotice(null);
    try {
      const response = await fetch("/api/restore-deleted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ids }),
      });
      const data = (await response.json()) as { restored: number };
      setNotice({
        tone: "success",
        message: `Restored ${data.restored} item${data.restored === 1 ? "" : "s"}.`,
      });
      if (type === "movie") {
        setSelectedMovieIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      } else {
        setSelectedSeasonIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
      void refreshDeleted();
    } catch {
      setNotice({ tone: "error", message: "Failed to restore items." });
    } finally {
      setActionInProgress(false);
    }
  };

  const totalSelected = selectedMovieIds.size + selectedSeasonIds.size;

  const handleRestoreSelected = async () => {
    const movieIds = [...selectedMovieIds];
    const seasonIds = [...selectedSeasonIds];
    if (movieIds.length === 0 && seasonIds.length === 0) return;
    setActionInProgress(true);
    setNotice(null);
    try {
      const requests: Promise<Response>[] = [];
      if (movieIds.length > 0) {
        requests.push(
          fetch("/api/restore-deleted", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "movie", ids: movieIds }),
          })
        );
      }
      if (seasonIds.length > 0) {
        requests.push(
          fetch("/api/restore-deleted", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "season", ids: seasonIds }),
          })
        );
      }
      await Promise.all(requests);
      const total = movieIds.length + seasonIds.length;
      setNotice({ tone: "success", message: `Restored ${total} item${total === 1 ? "" : "s"}.` });
      setSelectedMovieIds(new Set());
      setSelectedSeasonIds(new Set());
      void refreshDeleted();
    } catch {
      setNotice({ tone: "error", message: "Failed to restore items." });
    } finally {
      setActionInProgress(false);
    }
  };

  const toggleMovie = (id: string) => {
    setSelectedMovieIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleSeason = (id: string) => {
    setSelectedSeasonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleAllMovies = () => {
    if (!deletedItems) return;
    const allIds = deletedItems.movies.map((m) => m.id);
    const allSelected = allIds.every((id) => selectedMovieIds.has(id));
    setSelectedMovieIds(allSelected ? new Set() : new Set(allIds));
  };

  const toggleAllSeasons = () => {
    if (!deletedItems) return;
    const allIds = deletedItems.seasons.map((s) => s.id);
    const allSelected = allIds.every((id) => selectedSeasonIds.has(id));
    setSelectedSeasonIds(allSelected ? new Set() : new Set(allIds));
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Library Settings
              </h1>
              <p className="text-sm text-muted">
                Point Aperture at your local movie library.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <label className="text-xs font-medium uppercase tracking-[0.2em] text-faint">
              Library path
            </label>
            <input
              value={libraryRootPath}
              onChange={(event) => setLibraryRootPath(event.target.value)}
              placeholder="/Volumes/Expansion/My Movies"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
            />
            <p className="text-xs text-faint">
              Example: /Volumes/Expansion/My Movies
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save path"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing
                ? syncProgress
                  ? syncProgress.phase === "movies" && syncProgress.total > 0
                    ? `Movies ${syncProgress.current}/${syncProgress.total}…`
                    : syncProgress.phase === "seasons" && syncProgress.total > 0
                      ? `Shows ${syncProgress.current}/${syncProgress.total}…`
                      : "Syncing…"
                  : "Syncing…"
                : "Sync Library"}
            </button>
            {syncing ? (
              <button
                onClick={handleCancelSync}
                title="Cancel sync"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-6">
            {notice ? (
              <StatusBanner tone={notice.tone} message={notice.message} />
            ) : null}
          </div>
        </div>

        {/* Deleted Items */}
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Deleted Items
              </h2>
              <p className="text-sm text-muted">
                Items marked deleted when their folder was no longer found on disk during a sync.
              </p>
            </div>
          </div>

          <div className="mt-6">
            {deletedStats === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : deletedStats.total === 0 ? (
              <p className="text-sm text-muted">No deleted items in the database.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Summary + Purge All */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-foreground">{deletedStats.total}</span>{" "}
                    deleted item{deletedStats.total === 1 ? "" : "s"} retained in the database
                    {" "}({deletedStats.movies} movie{deletedStats.movies === 1 ? "" : "s"},{" "}
                    {deletedStats.seasons} season{deletedStats.seasons === 1 ? "" : "s"},{" "}
                    {deletedStats.episodes} episode{deletedStats.episodes === 1 ? "" : "s"}).
                  </p>
                  <button
                    onClick={() =>
                      openPurgeConfirm(
                        deletedItems?.movies.map((m) => m.id) ?? [],
                        deletedItems?.seasons.map((s) => s.id) ?? [],
                        true
                      )
                    }
                    disabled={actionInProgress}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition-colors hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Purge all
                  </button>
                </div>

                {/* Bulk action bar */}
                {totalSelected > 0 && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/20 bg-accent-muted px-4 py-2.5">
                    <span className="text-sm font-medium text-accent">
                      {totalSelected} selected
                    </span>
                    <button
                      onClick={() => void handleRestoreSelected()}
                      disabled={actionInProgress}
                      className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/60 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore selected
                    </button>
                    <button
                      onClick={() =>
                        openPurgeConfirm([...selectedMovieIds], [...selectedSeasonIds], false)
                      }
                      disabled={actionInProgress}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:border-red-500/60 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Purge selected
                    </button>
                  </div>
                )}

                {/* Item list */}
                {deletedItems === null ? (
                  <p className="text-sm text-muted">Loading items…</p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {/* Movies group */}
                    {deletedItems.movies.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
                          <input
                            type="checkbox"
                            checked={
                              deletedItems.movies.length > 0 &&
                              deletedItems.movies.every((m) => selectedMovieIds.has(m.id))
                            }
                            onChange={toggleAllMovies}
                            className="h-4 w-4 cursor-pointer accent-accent"
                          />
                          <Film className="h-4 w-4 text-muted" />
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                            Movies ({deletedItems.movies.length})
                          </span>
                        </div>
                        <div className="divide-y divide-border/40">
                          {deletedItems.movies.map((movie) => (
                            <div key={movie.id} className="flex items-center gap-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedMovieIds.has(movie.id)}
                                onChange={() => toggleMovie(movie.id)}
                                className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
                              />
                              {movie.posterPath ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={movie.posterPath}
                                  alt=""
                                  className="h-12 w-8 shrink-0 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-surface-strong">
                                  <Film className="h-4 w-4 text-faint" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {movie.titleClean}
                                  {movie.year ? (
                                    <span className="ml-1.5 text-xs text-muted">
                                      ({movie.year})
                                    </span>
                                  ) : null}
                                </p>
                                <p className="truncate text-xs text-faint" title={movie.folderPath}>
                                  {movie.folderPath}
                                </p>
                                <p className="text-xs text-faint/70">
                                  Deleted {formatDeletedDate(movie.deletedAt)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  onClick={() => void handleRestoreItems("movie", [movie.id])}
                                  disabled={actionInProgress}
                                  title="Restore"
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Restore
                                </button>
                                <button
                                  onClick={() => openPurgeConfirm([movie.id], [], false)}
                                  disabled={actionInProgress}
                                  title="Purge"
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Purge
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seasons group */}
                    {deletedItems.seasons.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
                          <input
                            type="checkbox"
                            checked={
                              deletedItems.seasons.length > 0 &&
                              deletedItems.seasons.every((s) => selectedSeasonIds.has(s.id))
                            }
                            onChange={toggleAllSeasons}
                            className="h-4 w-4 cursor-pointer accent-accent"
                          />
                          <Tv className="h-4 w-4 text-muted" />
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                            Seasons ({deletedItems.seasons.length})
                          </span>
                        </div>
                        <div className="divide-y divide-border/40">
                          {deletedItems.seasons.map((season) => (
                            <div key={season.id} className="flex items-center gap-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedSeasonIds.has(season.id)}
                                onChange={() => toggleSeason(season.id)}
                                className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
                              />
                              {season.posterPath ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={season.posterPath}
                                  alt=""
                                  className="h-12 w-8 shrink-0 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-surface-strong">
                                  <Tv className="h-4 w-4 text-faint" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {season.titleClean}
                                  </p>
                                  {season.seasonNumber !== null ? (
                                    <span className="shrink-0 text-xs text-muted">
                                      S{String(season.seasonNumber).padStart(2, "0")}
                                    </span>
                                  ) : null}
                                  {season.deletedEpisodeCount > 0 ? (
                                    <span className="shrink-0 rounded-full bg-surface-strong px-1.5 py-0.5 text-xs text-faint">
                                      {season.deletedEpisodeCount} ep{season.deletedEpisodeCount === 1 ? "" : "s"}
                                    </span>
                                  ) : null}
                                </div>
                                <p
                                  className="truncate text-xs text-faint"
                                  title={season.seasonFolderPath}
                                >
                                  {season.seasonFolderPath}
                                </p>
                                <p className="text-xs text-faint/70">
                                  Deleted {formatDeletedDate(season.deletedAt)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  onClick={() => void handleRestoreItems("season", [season.id])}
                                  disabled={actionInProgress}
                                  title="Restore"
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Restore
                                </button>
                                <button
                                  onClick={() => openPurgeConfirm([], [season.id], false)}
                                  disabled={actionInProgress}
                                  title="Purge"
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Purge
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Playback Settings */}
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Playback Settings
              </h2>
              <p className="text-sm text-muted">
                Configure how videos are played.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            <label className="text-xs font-medium uppercase tracking-[0.2em] text-faint">
              Default player
            </label>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setPlayerMode("browser");
                  setSavingPlayer(true);
                  try {
                    await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ playerMode: "browser" }),
                    });
                  } catch { /* ignore */ } finally {
                    setSavingPlayer(false);
                  }
                }}
                disabled={savingPlayer}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  playerMode === "browser"
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-border text-muted hover:border-border-hover hover:text-foreground"
                }`}
              >
                🎬 Browser Player (Vidstack)
              </button>
              <button
                onClick={async () => {
                  setPlayerMode("external");
                  setSavingPlayer(true);
                  try {
                    await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ playerMode: "external" }),
                    });
                  } catch { /* ignore */ } finally {
                    setSavingPlayer(false);
                  }
                }}
                disabled={savingPlayer}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  playerMode === "external"
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-border text-muted hover:border-border-hover hover:text-foreground"
                }`}
              >
                🖥️ External OS Player
              </button>
            </div>
            <p className="text-xs text-faint">
              The browser player streams directly in the app with full seek controls. The external
              player opens your OS default media player (VLC, mpv, etc.).
            </p>
          </div>
        </div>

        {/* Subtitles Settings */}
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <span className="text-lg">CC</span>
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Subtitles
              </h2>
              <p className="text-sm text-muted">
                OpenSubtitles integration for searching and downloading subtitles.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3">
              <span className="text-muted">OpenSubtitles API key</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  openSubtitlesConfigured
                    ? "bg-green-500/15 text-green-400"
                    : "bg-surface-strong text-faint"
                }`}
              >
                {openSubtitlesConfigured ? "Configured" : "Not configured"}
              </span>
            </div>
            <p className="text-xs text-faint">
              To enable subtitle search and download, add your OpenSubtitles API key to{" "}
              <code className="rounded bg-surface-strong px-1.5 py-0.5 font-mono">.env</code>:
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-background/60 px-4 py-3 text-xs font-mono text-muted">
              {`OPENSUBTITLES_API_KEY=your_api_key_here
# Optional — enables higher download quotas on paid accounts:
OPENSUBTITLES_USERNAME=your_username
OPENSUBTITLES_PASSWORD=your_password`}
            </pre>
            <p className="text-xs text-faint">
              Get a free API key at{" "}
              <a
                href="https://www.opensubtitles.com/consumers"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                opensubtitles.com/consumers
              </a>
              . Subtitle files are stored beside the media file on disk. Local subtitle management
              works without an API key.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          <p className="font-serif font-medium text-foreground">
            Tips for better matches
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted marker:text-accent/40">
            <li>
              Keep folder names focused on title + year (e.g. The_Godfather_1972)
            </li>
            <li>
              The cleaner removes tags like 1080p, x264, BluRay, REPACK, etc.
            </li>
            <li>
              If a movie isn&apos;t found, it will still appear with a
              &quot;Not found&quot; badge.
            </li>
          </ul>
        </div>
      </div>

      {/* Purge confirmation modal */}
      <Modal
        isOpen={purgeConfirm !== null}
        onClose={() => setPurgeConfirm(null)}
        title="Confirm permanent deletion"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {purgeConfirm?.isAll
              ? `This will permanently delete all ${deletedStats?.total ?? 0} deleted item${(deletedStats?.total ?? 0) === 1 ? "" : "s"} from the database. This cannot be undone.`
              : `This will permanently delete the following ${purgeConfirm?.titles.length ?? 0} item${(purgeConfirm?.titles.length ?? 0) === 1 ? "" : "s"} from the database. This cannot be undone.`}
          </p>
          {purgeConfirm && !purgeConfirm.isAll && purgeConfirm.titles.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background px-4 py-3 text-sm">
              {purgeConfirm.titles.map((title, i) => (
                <li key={i} className="py-1 text-foreground">
                  {title}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setPurgeConfirm(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPurge}
              disabled={actionInProgress}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500/80 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {purgeConfirm?.isAll ? "Purge all" : `Purge ${purgeConfirm?.titles.length ?? 0} item${(purgeConfirm?.titles.length ?? 0) === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

