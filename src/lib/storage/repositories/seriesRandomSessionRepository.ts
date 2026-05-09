import { createRepositoryFactory, resolveStorageDb } from "@/lib/storage/context";
import {
  type SeriesRandomSession,
  type SeriesRandomSessionRow,
} from "@/lib/storage/types";
import {
  parseUniqueNonEmptyJsonStringList,
  stringifyJsonList,
} from "@/lib/storage/shared/json";

function mapSeriesRandomSessionRow(row: SeriesRandomSessionRow): SeriesRandomSession {
  const startedEpisodeIds = parseUniqueNonEmptyJsonStringList(row.startedEpisodeIdsJson);
  return {
    seriesId: row.seriesId,
    startedEpisodeIds,
    currentEpisodeId:
      row.currentEpisodeId && row.currentEpisodeId.trim()
        ? row.currentEpisodeId
        : startedEpisodeIds[startedEpisodeIds.length - 1] ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const createSeriesRandomSessionRepository = createRepositoryFactory((context) => {
  return {
    getSeriesRandomSession(seriesId: string): SeriesRandomSession | null {
      const db = resolveStorageDb(context);
      const row = db
        .prepare("SELECT * FROM series_random_sessions WHERE seriesId = ?")
        .get(seriesId) as SeriesRandomSessionRow | undefined;
      return row ? mapSeriesRandomSessionRow(row) : null;
    },

    replaceSeriesRandomSession(
      seriesId: string,
      startedEpisodeIds: string[] = [],
      currentEpisodeId: string | null = null
    ): SeriesRandomSession {
      const db = resolveStorageDb(context);
      const now = Date.now();
      db.prepare(
        `
        INSERT INTO series_random_sessions (
          seriesId,
          startedEpisodeIdsJson,
          currentEpisodeId,
          createdAt,
          updatedAt
        ) VALUES (
          @seriesId,
          @startedEpisodeIdsJson,
          @currentEpisodeId,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(seriesId) DO UPDATE SET
          startedEpisodeIdsJson = excluded.startedEpisodeIdsJson,
          currentEpisodeId = excluded.currentEpisodeId,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt
        `
      ).run({
        seriesId,
        startedEpisodeIdsJson: stringifyJsonList(startedEpisodeIds),
        currentEpisodeId,
        createdAt: now,
        updatedAt: now,
      });
      return {
        seriesId,
        startedEpisodeIds: [...startedEpisodeIds],
        currentEpisodeId,
        createdAt: now,
        updatedAt: now,
      };
    },

    deleteSeriesRandomSession(seriesId: string) {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM series_random_sessions WHERE seriesId = ?").run(seriesId);
    },

    markSeriesRandomSessionEpisodeStarted(
      seriesId: string,
      episodeId: string
    ): SeriesRandomSession {
      const db = resolveStorageDb(context);
      const transaction = db.transaction(() => {
        const row = db
          .prepare("SELECT * FROM series_random_sessions WHERE seriesId = ?")
          .get(seriesId) as SeriesRandomSessionRow | undefined;
        const current = row ? mapSeriesRandomSessionRow(row) : null;
        const startedEpisodeIds = current ? [...current.startedEpisodeIds] : [];
        if (!startedEpisodeIds.includes(episodeId)) {
          startedEpisodeIds.push(episodeId);
        }
        const createdAt = current?.createdAt ?? Date.now();
        const updatedAt = Date.now();
        db.prepare(
          `
          INSERT INTO series_random_sessions (
            seriesId,
            startedEpisodeIdsJson,
            currentEpisodeId,
            createdAt,
            updatedAt
          ) VALUES (
            @seriesId,
            @startedEpisodeIdsJson,
            @currentEpisodeId,
            @createdAt,
            @updatedAt
          )
          ON CONFLICT(seriesId) DO UPDATE SET
            startedEpisodeIdsJson = excluded.startedEpisodeIdsJson,
            currentEpisodeId = excluded.currentEpisodeId,
            createdAt = excluded.createdAt,
            updatedAt = excluded.updatedAt
          `
        ).run({
          seriesId,
          startedEpisodeIdsJson: stringifyJsonList(startedEpisodeIds),
          currentEpisodeId: episodeId,
          createdAt,
          updatedAt,
        });
        return {
          seriesId,
          startedEpisodeIds,
          currentEpisodeId: episodeId,
          createdAt,
          updatedAt,
        };
      });

      return transaction();
    },
  };
});
