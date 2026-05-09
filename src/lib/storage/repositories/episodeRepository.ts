import { createRepositoryFactory, resolveStorageDb } from "@/lib/storage/context";
import {
  type EpisodeRow,
  type EpisodeUpdate,
  type EpisodeUpsert,
} from "@/lib/storage/types";
import { buildUpdateByIdSql } from "@/lib/storage/shared/updateBuilder";

export const createEpisodeRepository = createRepositoryFactory((context) => {
  return {
    upsertEpisode(episode: EpisodeUpsert) {
      const db = resolveStorageDb(context);
      db.prepare(
        `
        INSERT INTO episodes (
          id,
          seasonId,
          episodeNumber,
          titleRaw,
          titleClean,
          filePath,
          fileSizeBytes,
          lastSyncedAt
        ) VALUES (
          @id,
          @seasonId,
          @episodeNumber,
          @titleRaw,
          @titleClean,
          @filePath,
          @fileSizeBytes,
          @lastSyncedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          seasonId = excluded.seasonId,
          episodeNumber = excluded.episodeNumber,
          titleRaw = excluded.titleRaw,
          titleClean = excluded.titleClean,
          filePath = excluded.filePath,
          fileSizeBytes = excluded.fileSizeBytes,
          lastSyncedAt = excluded.lastSyncedAt,
          deletedAt = NULL
        `
      ).run(episode);
    },

    getEpisodesBySeasonId(seasonId: string): EpisodeRow[] {
      const db = resolveStorageDb(context);
      return db
        .prepare(
          `
          SELECT *
          FROM episodes
          WHERE seasonId = ?
          AND deletedAt IS NULL
          ORDER BY
            CASE WHEN episodeNumber IS NULL THEN 1 ELSE 0 END,
            episodeNumber ASC,
            titleClean ASC
          `
        )
        .all(seasonId) as EpisodeRow[];
    },

    countEpisodesBySeasonId(seasonId: string): number {
      const db = resolveStorageDb(context);
      const row = db
        .prepare("SELECT COUNT(*) as count FROM episodes WHERE seasonId = ? AND deletedAt IS NULL")
        .get(seasonId) as { count: number } | undefined;
      return row?.count ?? 0;
    },

    getEpisodeCountsBySeasonIds(seasonIds: string[]): Map<string, number> {
      const counts = new Map<string, number>();
      if (seasonIds.length === 0) return counts;
      const db = resolveStorageDb(context);
      const placeholders = seasonIds.map(() => "?").join(", ");
      const rows = db
        .prepare(
          `
          SELECT seasonId, COUNT(*) as count
          FROM episodes
          WHERE seasonId IN (${placeholders})
          AND deletedAt IS NULL
          GROUP BY seasonId
          `
        )
        .all(...seasonIds) as Array<{ seasonId: string; count: number }>;
      rows.forEach((row) => counts.set(row.seasonId, row.count));
      return counts;
    },

    getEpisodeById(id: string): EpisodeRow | null {
      const db = resolveStorageDb(context);
      const row = db.prepare("SELECT * FROM episodes WHERE id = ?").get(id);
      return (row as EpisodeRow | undefined) ?? null;
    },

    updateEpisode(id: string, updates: EpisodeUpdate) {
      const db = resolveStorageDb(context);
      const update = buildUpdateByIdSql(
        "episodes",
        id,
        updates as Record<string, string | number | null | undefined>
      );
      if (!update) return;
      db.prepare(update.sql).run(update.params);
    },

    markEpisodesDeletedNotInSeason(seasonId: string, filePaths: string[]) {
      const db = resolveStorageDb(context);
      const now = Date.now();
      if (filePaths.length === 0) {
        db.prepare("UPDATE episodes SET deletedAt = ? WHERE seasonId = ? AND deletedAt IS NULL").run(
          now,
          seasonId
        );
        return;
      }
      const placeholders = filePaths.map(() => "?").join(", ");
      db.prepare(
        `
        UPDATE episodes
        SET deletedAt = ?
        WHERE seasonId = ?
        AND filePath NOT IN (${placeholders})
        AND deletedAt IS NULL
        `
      ).run(now, seasonId, ...filePaths);
    },

    deleteEpisodesBySeasonIds(seasonIds: string[]) {
      if (seasonIds.length === 0) return;
      const db = resolveStorageDb(context);
      const placeholders = seasonIds.map(() => "?").join(", ");
      db.prepare(`DELETE FROM episodes WHERE seasonId IN (${placeholders})`).run(...seasonIds);
    },

    restoreEpisodesBySeasonIds(seasonIds: string[]) {
      if (seasonIds.length === 0) return;
      const db = resolveStorageDb(context);
      const placeholders = seasonIds.map(() => "?").join(", ");
      db.prepare(`UPDATE episodes SET deletedAt = NULL WHERE seasonId IN (${placeholders})`).run(
        ...seasonIds
      );
    },

    purgeDeletedEpisodes() {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM episodes WHERE deletedAt IS NOT NULL").run();
    },

    countDeletedEpisodes(): number {
      const db = resolveStorageDb(context);
      return (
        db.prepare("SELECT COUNT(*) as count FROM episodes WHERE deletedAt IS NOT NULL").get() as {
          count: number;
        }
      ).count;
    },
  };
});
