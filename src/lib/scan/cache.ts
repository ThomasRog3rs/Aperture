import type {
  FolderScanEntryRow,
  FolderScanStateRow,
  FolderScanStateUpsert,
} from "@/lib/storage";
import type { CachedState } from "./types";

export function buildCachedState(
  previousStates: FolderScanStateRow[],
  previousEntries: FolderScanEntryRow[]
): CachedState {
  const stateByPath = new Map(previousStates.map((state) => [state.folderPath, state]));

  const childStatesByParent = new Map<string, FolderScanStateRow[]>();
  for (const state of previousStates) {
    if (!state.parentFolderPath) continue;
    const existing = childStatesByParent.get(state.parentFolderPath) ?? [];
    existing.push(state);
    childStatesByParent.set(state.parentFolderPath, existing);
  }

  const entriesByFolderPath = new Map<string, FolderScanEntryRow[]>();
  for (const entry of previousEntries) {
    const existing = entriesByFolderPath.get(entry.folderPath) ?? [];
    existing.push(entry);
    entriesByFolderPath.set(entry.folderPath, existing);
  }

  return { stateByPath, childStatesByParent, entriesByFolderPath };
}

export function restoreSeenState(
  previousState: FolderScanStateRow,
  now: number,
  overrides?: Partial<FolderScanStateUpsert>
): FolderScanStateUpsert {
  return {
    folderPath: previousState.folderPath,
    folderType: previousState.folderType,
    parentFolderPath: previousState.parentFolderPath,
    dirMtimeMs: previousState.dirMtimeMs,
    fingerprint: previousState.fingerprint,
    lastSeenAt: now,
    lastScannedAt: previousState.lastScannedAt,
    ...overrides,
  };
}
