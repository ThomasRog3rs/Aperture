import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getBackupsDir,
  getDataDir,
  getDbPath,
  getTranscodesDir,
  migrateSqliteDbIfNeeded,
} from "@/lib/runtimeDataPaths";

const originalDataDir = process.env.APERTURE_DATA_DIR;
const tempDirs: string[] = [];

function createTempDir() {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), "aperture-runtime-paths-"));
  tempDirs.push(dirPath);
  return dirPath;
}

afterEach(() => {
  if (originalDataDir === undefined) {
    delete process.env.APERTURE_DATA_DIR;
  } else {
    process.env.APERTURE_DATA_DIR = originalDataDir;
  }

  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("runtimeDataPaths", () => {
  it("prefers APERTURE_DATA_DIR when configured", () => {
    const dataDir = createTempDir();
    process.env.APERTURE_DATA_DIR = dataDir;

    expect(getDataDir()).toBe(path.resolve(dataDir));
    expect(getDbPath()).toBe(path.join(path.resolve(dataDir), "aperture.db"));
    expect(getTranscodesDir()).toBe(path.join(path.resolve(dataDir), "transcodes"));
    expect(getBackupsDir()).toBe(path.join(path.resolve(dataDir), "backups"));
  });

  it("falls back to a data directory under the current working directory", () => {
    delete process.env.APERTURE_DATA_DIR;

    expect(getDataDir()).toBe(path.resolve(process.cwd(), "data"));
  });

  it("copies sqlite artifacts when migrating to a new canonical database path", () => {
    const tempRoot = createTempDir();
    const sourceDbPath = path.join(tempRoot, "legacy", "aperture.db");
    const targetDbPath = path.join(tempRoot, "stable", "aperture.db");

    fs.mkdirSync(path.dirname(sourceDbPath), { recursive: true });
    fs.writeFileSync(sourceDbPath, "db");
    fs.writeFileSync(`${sourceDbPath}-wal`, "wal");
    fs.writeFileSync(`${sourceDbPath}-shm`, "shm");

    expect(migrateSqliteDbIfNeeded(sourceDbPath, targetDbPath)).toBe(true);
    expect(fs.readFileSync(targetDbPath, "utf8")).toBe("db");
    expect(fs.readFileSync(`${targetDbPath}-wal`, "utf8")).toBe("wal");
    expect(fs.readFileSync(`${targetDbPath}-shm`, "utf8")).toBe("shm");
  });
});