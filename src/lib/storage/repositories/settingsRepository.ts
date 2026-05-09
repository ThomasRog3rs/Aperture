import { createRepositoryFactory, resolveStorageDb } from "@/lib/storage/context";

export const createSettingsRepository = createRepositoryFactory((context) => {
  return {
    getSetting(key: string): string | null {
      const db = resolveStorageDb(context);
      const row = db
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },

    setSetting(key: string, value: string) {
      const db = resolveStorageDb(context);
      db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(key, value);
    },
  };
});
