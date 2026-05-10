const fs = require("node:fs");
const path = require("node:path");

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

function resolveBackupPath(requestedPath, backupsDir) {
  const fileName = `aperture-${formatTimestamp(new Date())}.db`;
  if (!requestedPath) {
    return path.join(backupsDir, fileName);
  }

  const resolvedPath = path.resolve(requestedPath);
  if (path.extname(resolvedPath) === ".db") {
    return resolvedPath;
  }

  return path.join(resolvedPath, fileName);
}

async function main() {
  const dataDir = getDataDir();
  const dbPath = getDbPath(dataDir);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found at ${dbPath}`);
  }

  const backupsDir = getBackupsDir(dataDir);
  fs.mkdirSync(backupsDir, { recursive: true });

  const backupPath = resolveBackupPath(process.argv[2], backupsDir);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });

  const db = new Database(dbPath, { fileMustExist: true });
  try {
    await db.backup(backupPath);
  } finally {
    db.close();
  }

  console.log(`Backed up ${dbPath} to ${backupPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});