let currentSyncController: AbortController | null = null;

export function startSync(): AbortController {
  if (currentSyncController) {
    currentSyncController.abort();
  }
  const aborter = new AbortController();
  currentSyncController = aborter;
  return aborter;
}

export function releaseSyncController(aborter: AbortController): void {
  if (currentSyncController === aborter) {
    currentSyncController = null;
  }
}

export function isActiveSyncRunning(): boolean {
  return currentSyncController !== null;
}

export function abortActiveSync(): boolean {
  if (currentSyncController) {
    currentSyncController.abort();
    return true;
  }
  return false;
}
