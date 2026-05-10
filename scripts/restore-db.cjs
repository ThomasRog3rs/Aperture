const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const Database = require("better-sqlite3");

function getDataDir() {
  const configuredPath = process.env.APERTURE_DATA_DIR?.trim();
  return path.resolve(configuredPath || path.join(process.cwd(), "data"));
}

function getDbPath(dataDir = getDataDir()) {
  return path.join(dataDir, "aperture.db");
}

function getBackupsDir(dataDir = getDataDir()) {
  return path.join(dataDir, "backups");
}

function formatTimestamp(date) {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    force: args.includes("--force"),
    backupPathArg: args.find((arg) => arg !== "--force") ?? null,
  };
}

function listBackupFiles(backupsDir) {
  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  return fs
    .readdirSync(backupsDir)
    .filter((fileName) => fileName.endsWith(".db"))
    .map((fileName) => path.join(backupsDir, fileName))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
}

function resolveBackupPath(backupPathArg, backupsDir) {
  if (!backupPathArg) {
    return listBackupFiles(backupsDir)[0] ?? null;
  }

  const directPath = path.resolve(backupPathArg);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const backupDirPath = path.join(backupsDir, backupPathArg);
  if (fs.existsSync(backupDirPath)) {
    return backupDirPath;
  }

  return null;
}

function getOpenProcessIds(dbPath) {
  const result = spawnSync("lsof", ["-t", dbPath], { encoding: "utf8" });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      return null;
    }

    throw result.error;
  }

  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  return result.stdout
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function backupCurrentDb(dbPath, backupsDir) {
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const safetyBackupPath = path.join(
    backupsDir,
    `pre-restore-${formatTimestamp(new Date())}.db`
  );
  const db = new Database(dbPath, { fileMustExist: true });
  try {
    await db.backup(safetyBackupPath);
    return safetyBackupPath;
  } finally {
    db.close();
  }
}

async function main() {
  const { force, backupPathArg } = parseArgs(process.argv);
  const dataDir = getDataDir();
  const dbPath = getDbPath(dataDir);
  const backupsDir = getBackupsDir(dataDir);
  const backupPath = resolveBackupPath(backupPathArg, backupsDir);

  if (!backupPath) {
    throw new Error(
      `No backup file found. Looked in ${backupsDir}${backupPathArg ? ` and for ${backupPathArg}` : ""}`
    );
  }

  if (path.resolve(backupPath) === path.resolve(dbPath)) {
    throw new Error("Refusing to restore from the live database path.");
  }

  const openProcessIds = getOpenProcessIds(dbPath);
  if (openProcessIds && openProcessIds.length > 0 && !force) {
    throw new Error(
      `Database appears to be open by PID(s) ${openProcessIds.join(", ")}. Stop Aperture first or rerun with --force.`
    );
  }

  if (openProcessIds === null && !force) {
    console.warn("Could not verify whether the database is open. Ensure Aperture is stopped before restoring.");
  }

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(backupsDir, { recursive: true });

  const safetyBackupPath = await backupCurrentDb(dbPath, backupsDir);
  fs.copyFileSync(backupPath, dbPath);
  fs.rmSync(`${dbPath}-wal`, { force: true });
  fs.rmSync(`${dbPath}-shm`, { force: true });

  console.log(`Restored ${dbPath} from ${backupPath}`);
  if (safetyBackupPath) {
    console.log(`Saved the pre-restore database to ${safetyBackupPath}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});