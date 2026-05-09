import { getSeriesId } from "@/lib/series";
import { createRepositoryFactory, resolveStorageDb } from "@/lib/storage/context";
import type {
  SeriesRow,
  SeriesUpdate,
  SeriesUpsert,
} from "@/lib/storage/types";
import { stringifyJsonList } from "@/lib/storage/shared/json";
import { buildUpdateByIdSql } from "@/lib/storage/shared/updateBuilder";

export const createSeriesRepository = createRepositoryFactory((context) => {
  const listSeriesFolderPaths = (): string[] => {
    const db = resolveStorageDb(context);
    const rows = db
      .prepare("SELECT DISTINCT seriesFolderPath FROM seasons WHERE deletedAt IS NULL")
      .all() as Array<{ seriesFolderPath: string }>;
    return rows.map((row) => row.seriesFolderPath);
  };

  const getSeriesFolderPathById = (seriesId: string): string | null => {
    const folders = listSeriesFolderPaths();
    for (const folder of folders) {
      if (getSeriesId(folder) === seriesId) return folder;
    }
    return null;
  };

  return {
    upsertSeries(series: SeriesUpsert) {
      const db = resolveStorageDb(context);
      db.prepare(
        `
        INSERT INTO series (
          id,
          seriesFolderPath,
          titleClean,
          titleEditedAt,
          year,
          tmdbId,
          posterPath,
          tmdbRating,
          genresJson,
          userGenresJson,
          directorsJson,
          writersJson,
          actorsJson,
          errorMessage,
          lastSyncedAt
        ) VALUES (
          @id,
          @seriesFolderPath,
          @titleClean,
          @titleEditedAt,
          @year,
          @tmdbId,
          @posterPath,
          @tmdbRating,
          @genresJson,
          @userGenresJson,
          @directorsJson,
          @writersJson,
          @actorsJson,
          @errorMessage,
          @lastSyncedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          seriesFolderPath = excluded.seriesFolderPath,
          titleClean = excluded.titleClean,
          titleEditedAt = excluded.titleEditedAt,
          year = excluded.year,
          tmdbId = excluded.tmdbId,
          posterPath = excluded.posterPath,
          tmdbRating = excluded.tmdbRating,
          genresJson = excluded.genresJson,
          userGenresJson = excluded.userGenresJson,
          directorsJson = excluded.directorsJson,
          writersJson = excluded.writersJson,
          actorsJson = excluded.actorsJson,
          errorMessage = excluded.errorMessage,
          lastSyncedAt = excluded.lastSyncedAt
        `
      ).run({
        ...series,
        genresJson: stringifyJsonList(series.genres),
        userGenresJson: stringifyJsonList(series.userGenres),
        directorsJson: stringifyJsonList(series.directors),
        writersJson: stringifyJsonList(series.writers),
        actorsJson: stringifyJsonList(series.actors),
      });
    },

    listSeriesFolderPaths,

    getSeriesFolderPathById,

    getSeriesById(id: string): SeriesRow | null {
      const db = resolveStorageDb(context);
      const row = db.prepare("SELECT * FROM series WHERE id = ?").get(id);
      return (row as SeriesRow | undefined) ?? null;
    },

    getSeriesByFolderPath(seriesFolderPath: string): SeriesRow | null {
      const db = resolveStorageDb(context);
      const row = db
        .prepare("SELECT * FROM series WHERE seriesFolderPath = ?")
        .get(seriesFolderPath);
      return (row as SeriesRow | undefined) ?? null;
    },

    updateSeries(id: string, updates: SeriesUpdate) {
      const db = resolveStorageDb(context);
      const update = buildUpdateByIdSql(
        "series",
        id,
        updates as Record<string, string | number | null | undefined>
      );
      if (!update) return;
      db.prepare(update.sql).run(update.params);
    },

    deleteSeries(id: string) {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM series WHERE id = ?").run(id);
    },
  };
});
