import { createRepositoryFactory, resolveStorageDb } from "@/lib/storage/context";
import {
  type DeletedSeasonRow,
  type SeasonQuery,
  type SeasonRow,
  type SeasonUpdate,
  type SeasonUpsert,
} from "@/lib/storage/types";
import { stringifyJsonList } from "@/lib/storage/shared/json";
import { buildUpdateByIdSql } from "@/lib/storage/shared/updateBuilder";

export const createSeasonRepository = createRepositoryFactory((context) => {
  return {
    upsertSeason(season: SeasonUpsert) {
      const db = resolveStorageDb(context);
      db.prepare(
        `
        INSERT INTO seasons (
          id,
          seriesFolderPath,
          seasonFolderPath,
          seasonNumber,
          titleRaw,
          titleClean,
          titleEditedAt,
          year,
          tmdbId,
          posterPath,
          backdropPath,
          tmdbRating,
          genresJson,
          userGenresJson,
          directorsJson,
          writersJson,
          actorsJson,
          personalRating,
          errorMessage,
          lastSyncedAt,
          xxxRated,
          watched
        ) VALUES (
          @id,
          @seriesFolderPath,
          @seasonFolderPath,
          @seasonNumber,
          @titleRaw,
          @titleClean,
          @titleEditedAt,
          @year,
          @tmdbId,
          @posterPath,
          @backdropPath,
          @tmdbRating,
          @genresJson,
          @userGenresJson,
          @directorsJson,
          @writersJson,
          @actorsJson,
          @personalRating,
          @errorMessage,
          @lastSyncedAt,
          @xxxRated,
          @watched
        )
        ON CONFLICT(id) DO UPDATE SET
          seriesFolderPath = excluded.seriesFolderPath,
          seasonFolderPath = excluded.seasonFolderPath,
          seasonNumber = excluded.seasonNumber,
          titleRaw = excluded.titleRaw,
          titleClean = excluded.titleClean,
          titleEditedAt = excluded.titleEditedAt,
          year = excluded.year,
          tmdbId = excluded.tmdbId,
          posterPath = excluded.posterPath,
          backdropPath = excluded.backdropPath,
          tmdbRating = excluded.tmdbRating,
          genresJson = excluded.genresJson,
          userGenresJson = excluded.userGenresJson,
          directorsJson = excluded.directorsJson,
          writersJson = excluded.writersJson,
          actorsJson = excluded.actorsJson,
          personalRating = excluded.personalRating,
          errorMessage = excluded.errorMessage,
          lastSyncedAt = excluded.lastSyncedAt,
          xxxRated = excluded.xxxRated,
          watched = excluded.watched,
          deletedAt = NULL
        `
      ).run({
        ...season,
        genresJson: stringifyJsonList(season.genres),
        userGenresJson: stringifyJsonList(season.userGenres),
        directorsJson: stringifyJsonList(season.directors),
        writersJson: stringifyJsonList(season.writers),
        actorsJson: stringifyJsonList(season.actors),
      });
    },

    listSeasons(query: SeasonQuery): SeasonRow[] {
      const db = resolveStorageDb(context);
      const where: string[] = [];
      const params: Record<string, string | number> = {};

      if (query.q) {
        where.push(
          "(LOWER(titleClean) LIKE @q OR LOWER(titleRaw) LIKE @q OR LOWER(directorsJson) LIKE @q OR LOWER(writersJson) LIKE @q OR LOWER(actorsJson) LIKE @q)"
        );
        params.q = `%${query.q.toLowerCase()}%`;
      }

      if (query.genre) {
        where.push("(genresJson LIKE @genre OR userGenresJson LIKE @genre)");
        params.genre = `%\"${query.genre}\"%`;
      }

      if (query.person) {
        where.push(
          "(directorsJson LIKE @person OR writersJson LIKE @person OR actorsJson LIKE @person)"
        );
        params.person = `%\"${query.person}\"%`;
      }

      if (typeof query.minPersonalRating === "number") {
        where.push("personalRating >= @minPersonalRating");
        params.minPersonalRating = query.minPersonalRating;
      }

      if (query.watched === "watched") {
        where.push("watched = 1");
      } else if (query.watched === "unwatched") {
        where.push("watched = 0");
      }

      where.push("deletedAt IS NULL");

      const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

      let orderBy = "titleClean ASC";
      if (query.sort === "rating") {
        orderBy = "tmdbRating IS NULL, tmdbRating DESC";
      } else if (query.sort === "recent") {
        orderBy = "lastSyncedAt DESC";
      }

      const sql = `
        SELECT *
        FROM seasons
        ${whereClause}
        ORDER BY ${orderBy}
      `;

      return db.prepare(sql).all(params) as SeasonRow[];
    },

    listActiveGenreRows(): Array<{ genresJson: string | null; userGenresJson: string | null }> {
      const db = resolveStorageDb(context);
      return db
        .prepare("SELECT genresJson, userGenresJson FROM seasons WHERE deletedAt IS NULL")
        .all() as Array<{ genresJson: string | null; userGenresJson: string | null }>;
    },

    listActivePeopleRows(): Array<{
      directorsJson: string | null;
      writersJson: string | null;
      actorsJson: string | null;
    }> {
      const db = resolveStorageDb(context);
      return db
        .prepare("SELECT directorsJson, writersJson, actorsJson FROM seasons WHERE deletedAt IS NULL")
        .all() as Array<{
        directorsJson: string | null;
        writersJson: string | null;
        actorsJson: string | null;
      }>;
    },

    listSeasonsBySeriesFolderPath(seriesFolderPath: string): SeasonRow[] {
      const db = resolveStorageDb(context);
      return db
        .prepare(
          `
          SELECT *
          FROM seasons
          WHERE seriesFolderPath = ?
          AND deletedAt IS NULL
          ORDER BY
            CASE WHEN seasonNumber IS NULL THEN 1 ELSE 0 END,
            seasonNumber ASC,
            titleClean ASC
          `
        )
        .all(seriesFolderPath) as SeasonRow[];
    },

    updateSeason(id: string, updates: SeasonUpdate) {
      const db = resolveStorageDb(context);
      const update = buildUpdateByIdSql(
        "seasons",
        id,
        updates as Record<string, string | number | null | undefined>
      );
      if (!update) return;
      db.prepare(update.sql).run(update.params);
    },

    getSeasonById(id: string): SeasonRow | null {
      const db = resolveStorageDb(context);
      const row = db.prepare("SELECT * FROM seasons WHERE id = ?").get(id);
      return (row as SeasonRow | undefined) ?? null;
    },

    deleteSeasonById(id: string) {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM seasons WHERE id = ?").run(id);
    },

    deleteSeasonsBySeriesFolderPath(seriesFolderPath: string) {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM seasons WHERE seriesFolderPath = ?").run(seriesFolderPath);
    },

    getAllSeasonFolderPaths(): string[] {
      const db = resolveStorageDb(context);
      const rows = db
        .prepare("SELECT seasonFolderPath FROM seasons WHERE deletedAt IS NULL")
        .all() as Array<{ seasonFolderPath: string }>;
      return rows.map((row) => row.seasonFolderPath);
    },

    markSeasonsDeleted(seasonFolderPaths: string[]) {
      if (seasonFolderPaths.length === 0) return;
      const db = resolveStorageDb(context);
      const now = Date.now();
      const placeholders = seasonFolderPaths.map(() => "?").join(", ");
      db.prepare(
        `UPDATE seasons SET deletedAt = ? WHERE seasonFolderPath IN (${placeholders}) AND deletedAt IS NULL`
      ).run(now, ...seasonFolderPaths);
    },

    markSeasonDeleted(id: string) {
      const db = resolveStorageDb(context);
      db.prepare("UPDATE seasons SET deletedAt = ? WHERE id = ? AND deletedAt IS NULL").run(
        Date.now(),
        id
      );
    },

    listDeletedSeasons(): DeletedSeasonRow[] {
      const db = resolveStorageDb(context);
      return db
        .prepare(
          `SELECT s.*, COUNT(e.id) as deletedEpisodeCount
           FROM seasons s
           LEFT JOIN episodes e ON e.seasonId = s.id AND e.deletedAt IS NOT NULL
           WHERE s.deletedAt IS NOT NULL
           GROUP BY s.id
           ORDER BY s.deletedAt DESC`
        )
        .all() as DeletedSeasonRow[];
    },

    listDeletedSeasonIds(): string[] {
      const db = resolveStorageDb(context);
      const rows = db.prepare("SELECT id FROM seasons WHERE deletedAt IS NOT NULL").all() as Array<{
        id: string;
      }>;
      return rows.map((row) => row.id);
    },

    countDeletedSeasons(): number {
      const db = resolveStorageDb(context);
      return (
        db.prepare("SELECT COUNT(*) as count FROM seasons WHERE deletedAt IS NOT NULL").get() as {
          count: number;
        }
      ).count;
    },

    purgeDeletedSeasons() {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM seasons WHERE deletedAt IS NOT NULL").run();
    },

    purgeSeasonsByIds(ids: string[]) {
      if (ids.length === 0) return;
      const db = resolveStorageDb(context);
      const placeholders = ids.map(() => "?").join(", ");
      db.prepare(`DELETE FROM seasons WHERE id IN (${placeholders})`).run(...ids);
    },

    restoreSeasonsByIds(ids: string[]) {
      if (ids.length === 0) return;
      const db = resolveStorageDb(context);
      const placeholders = ids.map(() => "?").join(", ");
      db.prepare(`UPDATE seasons SET deletedAt = NULL WHERE id IN (${placeholders})`).run(...ids);
    },
  };
});
