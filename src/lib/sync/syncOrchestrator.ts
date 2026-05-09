import {
  listAllFolderScanEntries,
  listAllFolderScanStates,
  getSetting,
  saveFolderScanSnapshot,
} from "@/lib/storage";
import { scanLibraryIncremental } from "@/lib/scan";
import { syncMovies } from "./movieSyncer";
import { syncSeasons } from "./seasonSyncer";
import { releaseSyncController } from "./syncController";
import type { SyncEmitter, SyncSummary } from "./types";

export async function runSync(
  signal: AbortSignal,
  emit: SyncEmitter,
  aborter: AbortController
): Promise<void> {
  try {
    const libraryRootPath = getSetting("libraryRootPath");
    if (!libraryRootPath) {
      emit({ type: "error", error: "Library path not set." });
      return;
    }

    emit({ type: "phase", phase: "scanning" });

    const previousScanStates = listAllFolderScanStates();
    const previousScanEntries = listAllFolderScanEntries();
    let scanned;
    try {
      scanned = await scanLibraryIncremental(
        libraryRootPath,
        previousScanStates,
        previousScanEntries
      );
    } catch (error) {
      emit({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to scan library.",
      });
      return;
    }

    if (signal.aborted) {
      emit({ type: "cancelled" });
      return;
    }

    const syncedAt = Date.now();

    const movieStats = await syncMovies(scanned, signal, syncedAt, emit);
    if (signal.aborted) return;

    const seasonStats = await syncSeasons(scanned, signal, syncedAt, emit);
    if (signal.aborted) return;

    emit({ type: "phase", phase: "saving" });
    saveFolderScanSnapshot(
      libraryRootPath,
      scanned.scanStates,
      scanned.scanEntries,
      syncedAt
    );

    const summary: SyncSummary = {
      mode: "incremental",
      folders: {
        checked:
          scanned.stats.rootFoldersChecked + scanned.stats.seasonFoldersChecked,
        rootChecked: scanned.stats.rootFoldersChecked,
        seasonChecked: scanned.stats.seasonFoldersChecked,
        changed: scanned.stats.foldersChanged,
        rescanned: scanned.stats.foldersRescanned,
      },
      movies: {
        scanned: scanned.currentMovieFolderPaths.length,
        ...movieStats,
      },
      seasons: {
        scanned: scanned.currentSeasonFolderPaths.length,
        ...seasonStats,
      },
    };

    emit({ type: "complete", summary });
  } catch (err) {
    if (!signal.aborted) {
      emit({
        type: "error",
        error: err instanceof Error ? err.message : "Sync failed.",
      });
    }
  } finally {
    releaseSyncController(aborter);
  }
}
