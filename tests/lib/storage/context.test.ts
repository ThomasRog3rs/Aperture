import { describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import type { StorageContext, StorageDb } from "@/lib/storage/context";
import {
  createRepositoryFactory,
  createStorageContext,
  resolveStorageDb,
  runtimeStorageContext,
} from "@/lib/storage/context";

describe("storage/context", () => {
  it("uses injected getDb when creating a storage context", () => {
    const fakeDb = {
      prepare: vi.fn(),
      transaction: vi.fn(),
    } as unknown as StorageDb;

    const context = createStorageContext({ getDb: () => fakeDb });

    expect(resolveStorageDb(context)).toBe(fakeDb);
  });

  it("uses getDb-backed runtime context by default", () => {
    expect(runtimeStorageContext.getDb).toBe(getDb);
  });

  it("creates repository factories that can override db context in tests", () => {
    const baseDb = {
      prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn(() => []) })),
      transaction: vi.fn((fn: () => string) => fn),
    } as unknown as StorageDb;
    const overrideDb = {
      prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn(() => []) })),
      transaction: vi.fn((fn: () => string) => fn),
    } as unknown as StorageDb;

    const createRepository = (context: StorageContext) => {
      const db = resolveStorageDb(context);
      return {
        db,
        runInTransaction: () => db.transaction(() => "ok")(),
      };
    };

    const factory = createRepositoryFactory(
      createRepository,
      createStorageContext({ getDb: () => baseDb })
    );

    expect(factory().db).toBe(baseDb);
    expect(factory({ getDb: () => overrideDb }).db).toBe(overrideDb);
    expect(factory().runInTransaction()).toBe("ok");
  });
});
