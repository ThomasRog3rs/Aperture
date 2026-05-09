import { createRepositoryFactory, resolveStorageDb } from "@/lib/storage/context";
import type {
  FolderScanEntryRow,
  FolderScanEntryUpsert,
  FolderScanStateRow,
  FolderScanStateUpsert,
} from "@/lib/storage/types";

export const createFolderScanRepository = createRepositoryFactory((context) => {
  return {
    listAllFolderScanStates(): FolderScanStateRow[] {
      const db = resolveStorageDb(context);
      return db
        .prepare(
          `
          SELECT
            folderPath,
            folderType,
            parentFolderPath,
            dirMtimeMs,
            fingerprint,
            lastSeenAt,
            lastScannedAt
          FROM folder_scan_state
          `
        )
        .all() as FolderScanStateRow[];
    },

    listAllFolderScanEntries(): FolderScanEntryRow[] {
      const db = resolveStorageDb(context);
      return db
        .prepare(
          `
          SELECT
            folderPath,
            entryPath,
            sizeBytes,
            mtimeMs
          FROM folder_scan_entries
          `
        )
        .all() as FolderScanEntryRow[];
    },

    saveFolderScanSnapshot(
      rootPath: string,
      states: FolderScanStateUpsert[],
      entries: FolderScanEntryUpsert[],
      lastSyncedAt: number
    ) {
      const db = resolveStorageDb(context);
      const existingStateRows = db
        .prepare("SELECT folderPath FROM folder_scan_state")
        .all() as Array<{ folderPath: string }>;
      const currentStatePaths = new Set(states.map((state) => state.folderPath));
      const removedStatePaths = existingStateRows
        .map((row) => row.folderPath)
        .filter((folderPath) => !currentStatePaths.has(folderPath));
      const trackedFolderPaths = new Set(
        states
          .filter((state) => state.folderType === "movie" || state.folderType === "season")
          .map((state) => state.folderPath)
      );
      for (const folderPath of removedStatePaths) {
        trackedFolderPaths.add(folderPath);
      }

      const upsertState = db.prepare(
        `
        INSERT INTO folder_scan_state (
          folderPath,
          folderType,
          parentFolderPath,
          dirMtimeMs,
          fingerprint,
          lastSeenAt,
          lastScannedAt
        ) VALUES (
          @folderPath,
          @folderType,
          @parentFolderPath,
          @dirMtimeMs,
          @fingerprint,
          @lastSeenAt,
          @lastScannedAt
        )
        ON CONFLICT(folderPath) DO UPDATE SET
          folderType = excluded.folderType,
          parentFolderPath = excluded.parentFolderPath,
          dirMtimeMs = excluded.dirMtimeMs,
          fingerprint = excluded.fingerprint,
          lastSeenAt = excluded.lastSeenAt,
          lastScannedAt = excluded.lastScannedAt
        `
      );
      const deleteState = db.prepare("DELETE FROM folder_scan_state WHERE folderPath = ?");
      const deleteEntries = db.prepare("DELETE FROM folder_scan_entries WHERE folderPath = ?");
      const insertEntry = db.prepare(
        `
        INSERT INTO folder_scan_entries (
          folderPath,
          entryPath,
          sizeBytes,
          mtimeMs
        ) VALUES (
          @folderPath,
          @entryPath,
          @sizeBytes,
          @mtimeMs
        )
        ON CONFLICT(folderPath, entryPath) DO UPDATE SET
          sizeBytes = excluded.sizeBytes,
          mtimeMs = excluded.mtimeMs
        `
      );
      const upsertRoot = db.prepare(
        `
        INSERT INTO sync_roots (
          rootPath,
          lastSyncedAt,
          lastFullSyncedAt
        ) VALUES (
          @rootPath,
          @lastSyncedAt,
          NULL
        )
        ON CONFLICT(rootPath) DO UPDATE SET
          lastSyncedAt = excluded.lastSyncedAt
        `
      );

      const saveSnapshot = db.transaction(() => {
        for (const folderPath of removedStatePaths) {
          deleteState.run(folderPath);
        }

        for (const state of states) {
          upsertState.run(state);
        }

        for (const folderPath of trackedFolderPaths) {
          deleteEntries.run(folderPath);
        }

        for (const entry of entries) {
          insertEntry.run(entry);
        }

        upsertRoot.run({ rootPath, lastSyncedAt });
      });

      saveSnapshot();
    },
  };
});
