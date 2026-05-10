import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB_FILE_NAME = "aperture.db";
const SQLITE_ARTIFACT_SUFFIXES = ["", "-wal", "-shm"] as const;
const LEGACY_DATA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data"
);

function getConfiguredDataDir() {
  const configuredPath = process.env.APERTURE_DATA_DIR?.trim();
  if (!configuredPath) {
    return null;
  }

  return path.resolve(configuredPath);
}

export function getDataDir() {
  return getConfiguredDataDir() ?? path.resolve(process.cwd(), "data");
}

export function getLegacyDataDir() {
  return path.resolve(LEGACY_DATA_DIR);
}

export function getDbPath(dataDir = getDataDir()) {
  return path.join(dataDir, DB_FILE_NAME);
}

export function getLegacyDbPath() {
  return getDbPath(getLegacyDataDir());
}

export function getTranscodesDir(dataDir = getDataDir()) {
  return path.join(dataDir, "transcodes");
}

export function getBackupsDir(dataDir = getDataDir()) {
  return path.join(dataDir, "backups");
}

export function ensureDirectoryExists(directoryPath: string) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function getSqliteArtifactPaths(dbPath: string) {
  return SQLITE_ARTIFACT_SUFFIXES.map((suffix) => `${dbPath}${suffix}`);
}

export function migrateSqliteDbIfNeeded(sourceDbPath: string, targetDbPath: string) {
  const normalizedSourcePath = path.resolve(sourceDbPath);
  const normalizedTargetPath = path.resolve(targetDbPath);

  if (normalizedSourcePath === normalizedTargetPath) {
    return false;
  }

  if (fs.existsSync(normalizedTargetPath) || !fs.existsSync(normalizedSourcePath)) {
    return false;
  }

  ensureDirectoryExists(path.dirname(normalizedTargetPath));

  for (const artifactPath of getSqliteArtifactPaths(normalizedSourcePath)) {
    if (!fs.existsSync(artifactPath)) {
      continue;
    }

    const suffix = artifactPath.slice(normalizedSourcePath.length);
    fs.copyFileSync(artifactPath, `${normalizedTargetPath}${suffix}`);
  }

  return true;
}

export function migrateLegacyDbIfNeeded(targetDbPath = getDbPath()) {
  return migrateSqliteDbIfNeeded(getLegacyDbPath(), targetDbPath);
}

export function ensureRuntimeDataReady() {
  const dataDir = getDataDir();
  ensureDirectoryExists(dataDir);

  const dbPath = getDbPath(dataDir);
  migrateLegacyDbIfNeeded(dbPath);

  return {
    dataDir,
    dbPath,
  };
}