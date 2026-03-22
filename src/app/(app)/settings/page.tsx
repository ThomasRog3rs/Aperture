"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Folder, RefreshCw, Trash2, Play, X } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";

type SettingsResponse = {
  libraryRootPath: string | null;
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

export default function SettingsPage() {
  const [libraryRootPath, setLibraryRootPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const [purging, setPurging] = useState(false);
  const [deletedStats, setDeletedStats] = useState<DeletedStats | null>(null);
  const [playerMode, setPlayerMode] = useState<"browser" | "external">("browser");
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

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data: SettingsResponse & { playerMode?: string }) => {
        setLibraryRootPath(data.libraryRootPath ?? "");
        if (data.playerMode === "external") setPlayerMode("external");
      })
      .catch(() => {
        setNotice({ tone: "error", message: "Failed to load settings." });
      });
    void fetchDeletedStats();
  }, [fetchDeletedStats]);

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
            void fetchDeletedStats();
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

  const handlePurgeDeleted = async () => {
    setPurging(true);
    setNotice(null);
    try {
      const response = await fetch("/api/purge-deleted", { method: "POST" });
      const data = (await response.json()) as { purged: number; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to purge deleted items.");
      }
      setNotice({
        tone: "success",
        message: `Permanently removed ${data.purged} deleted item${data.purged === 1 ? "" : "s"} from the database.`,
      });
      void fetchDeletedStats();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to purge deleted items.",
      });
    } finally {
      setPurging(false);
    }
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
            {deletedStats !== null ? (
              deletedStats.total === 0 ? (
                <p className="text-sm text-muted">No deleted items in the database.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-foreground">{deletedStats.total}</span>{" "}
                    deleted item{deletedStats.total === 1 ? "" : "s"} retained in the database
                    {" "}({deletedStats.movies} movie{deletedStats.movies === 1 ? "" : "s"},{" "}
                    {deletedStats.seasons} season{deletedStats.seasons === 1 ? "" : "s"},{" "}
                    {deletedStats.episodes} episode{deletedStats.episodes === 1 ? "" : "s"}).
                  </p>
                  <button
                    onClick={handlePurgeDeleted}
                    disabled={purging}
                    className="inline-flex w-fit items-center gap-2 rounded-lg border border-red-500/30 px-5 py-2 text-sm text-red-400 transition-colors hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {purging ? "Purging..." : `Purge ${deletedStats.total} deleted item${deletedStats.total === 1 ? "" : "s"}`}
                  </button>
                </div>
              )
            ) : (
              <p className="text-sm text-muted">Loading…</p>
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
    </div>
  );
}
