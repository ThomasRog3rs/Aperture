import { getDb } from "@/lib/db";

export interface StorageStatement<TGet = unknown, TAll = unknown> {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): TGet | undefined;
  all(...params: unknown[]): TAll[];
}

export interface StorageDb {
  prepare(sql: string): StorageStatement;
  transaction<T>(fn: () => T): () => T;
}

export type StorageDbResolver = () => StorageDb;

export type StorageContext = {
  getDb: StorageDbResolver;
};

export function createStorageContext(
  overrides: Partial<StorageContext> = {}
): StorageContext {
  return {
    getDb: overrides.getDb ?? getDb,
  };
}

export const runtimeStorageContext = createStorageContext();

export function resolveStorageDb(context: StorageContext = runtimeStorageContext): StorageDb {
  return context.getDb();
}

export function createRepositoryFactory<TRepository>(
  createRepository: (context: StorageContext) => TRepository,
  baseContext: StorageContext = runtimeStorageContext
) {
  return (overrides: Partial<StorageContext> = {}): TRepository => {
    return createRepository({
      ...baseContext,
      ...overrides,
    });
  };
}
