import { createRepositoryFactory, resolveStorageDb } from "@/lib/storage/context";
import {
  type DeletedMovieRow,
  type MovieQuery,
  type MovieRow,
  type MovieUpdate,
  type MovieUpsert,
} from "@/lib/storage/types";
import { stringifyJsonList } from "@/lib/storage/shared/json";
import { buildUpdateByIdSql } from "@/lib/storage/shared/updateBuilder";

export const createMovieRepository = createRepositoryFactory((context) => {
  return {
    upsertMovie(movie: MovieUpsert) {
      const db = resolveStorageDb(context);
      db.prepare(
        `
        INSERT INTO movies (
          id,
          folderPath,
          filePath,
          fileSizeBytes,
          titleRaw,
          titleClean,
          titleEditedAt,
          year,
          tmdbId,
          posterPath,
          backdropPath,
          runtimeMinutes,
          tmdbRating,
          genresJson,
          userGenresJson,
          directorsJson,
          writersJson,
          actorsJson,
          youtubeTrailerKey,
          personalRating,
          errorMessage,
          lastSyncedAt
        ) VALUES (
          @id,
          @folderPath,
          @filePath,
          @fileSizeBytes,
          @titleRaw,
          @titleClean,
          @titleEditedAt,
          @year,
          @tmdbId,
          @posterPath,
          @backdropPath,
          @runtimeMinutes,
          @tmdbRating,
          @genresJson,
          @userGenresJson,
          @directorsJson,
          @writersJson,
          @actorsJson,
          @youtubeTrailerKey,
          @personalRating,
          @errorMessage,
          @lastSyncedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          folderPath = excluded.folderPath,
          filePath = excluded.filePath,
          fileSizeBytes = excluded.fileSizeBytes,
          titleRaw = excluded.titleRaw,
          titleClean = excluded.titleClean,
          titleEditedAt = excluded.titleEditedAt,
          year = excluded.year,
          tmdbId = excluded.tmdbId,
          posterPath = excluded.posterPath,
          backdropPath = excluded.backdropPath,
          runtimeMinutes = excluded.runtimeMinutes,
          tmdbRating = excluded.tmdbRating,
          genresJson = excluded.genresJson,
          userGenresJson = excluded.userGenresJson,
          directorsJson = excluded.directorsJson,
          writersJson = excluded.writersJson,
          actorsJson = excluded.actorsJson,
          youtubeTrailerKey = excluded.youtubeTrailerKey,
          personalRating = excluded.personalRating,
          errorMessage = excluded.errorMessage,
          lastSyncedAt = excluded.lastSyncedAt,
          deletedAt = NULL
      `
      ).run({
        ...movie,
        genresJson: stringifyJsonList(movie.genres),
        userGenresJson: stringifyJsonList(movie.userGenres),
        directorsJson: stringifyJsonList(movie.directors),
        writersJson: stringifyJsonList(movie.writers),
        actorsJson: stringifyJsonList(movie.actors),
      });
    },

    listMovies(query: MovieQuery): MovieRow[] {
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
        FROM movies
        ${whereClause}
        ORDER BY ${orderBy}
      `;

      return db.prepare(sql).all(params) as MovieRow[];
    },

    listActiveGenreRows(): Array<{ genresJson: string | null; userGenresJson: string | null }> {
      const db = resolveStorageDb(context);
      return db
        .prepare("SELECT genresJson, userGenresJson FROM movies WHERE deletedAt IS NULL")
        .all() as Array<{ genresJson: string | null; userGenresJson: string | null }>;
    },

    listActivePeopleRows(): Array<{
      directorsJson: string | null;
      writersJson: string | null;
      actorsJson: string | null;
    }> {
      const db = resolveStorageDb(context);
      return db
        .prepare("SELECT directorsJson, writersJson, actorsJson FROM movies WHERE deletedAt IS NULL")
        .all() as Array<{
        directorsJson: string | null;
        writersJson: string | null;
        actorsJson: string | null;
      }>;
    },

    updateMovie(id: string, updates: MovieUpdate) {
      const db = resolveStorageDb(context);
      const update = buildUpdateByIdSql(
        "movies",
        id,
        updates as Record<string, string | number | null | undefined>
      );
      if (!update) return;
      db.prepare(update.sql).run(update.params);
    },

    updatePersonalRating(id: string, personalRating: number | null) {
      const db = resolveStorageDb(context);
      db.prepare("UPDATE movies SET personalRating = @personalRating WHERE id = @id").run({
        id,
        personalRating,
      });
    },

    getMovieById(id: string): MovieRow | null {
      const db = resolveStorageDb(context);
      const row = db.prepare("SELECT * FROM movies WHERE id = ?").get(id);
      return (row as MovieRow | undefined) ?? null;
    },

    deleteMovie(id: string) {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM movies WHERE id = ?").run(id);
    },

    getAllMovieFolderPaths(): string[] {
      const db = resolveStorageDb(context);
      const rows = db
        .prepare("SELECT folderPath FROM movies WHERE deletedAt IS NULL")
        .all() as Array<{ folderPath: string }>;
      return rows.map((row) => row.folderPath);
    },

    markMoviesDeleted(folderPaths: string[]) {
      if (folderPaths.length === 0) return;
      const db = resolveStorageDb(context);
      const now = Date.now();
      const placeholders = folderPaths.map(() => "?").join(", ");
      db.prepare(
        `UPDATE movies SET deletedAt = ? WHERE folderPath IN (${placeholders}) AND deletedAt IS NULL`
      ).run(now, ...folderPaths);
    },

    listDeletedMovies(): DeletedMovieRow[] {
      const db = resolveStorageDb(context);
      return db
        .prepare("SELECT * FROM movies WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC")
        .all() as DeletedMovieRow[];
    },

    countDeletedMovies(): number {
      const db = resolveStorageDb(context);
      return (
        db.prepare("SELECT COUNT(*) as count FROM movies WHERE deletedAt IS NOT NULL").get() as {
          count: number;
        }
      ).count;
    },

    purgeDeletedMovies() {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM movies WHERE deletedAt IS NOT NULL").run();
    },

    purgeMoviesByIds(ids: string[]) {
      if (ids.length === 0) return;
      const db = resolveStorageDb(context);
      const placeholders = ids.map(() => "?").join(", ");
      db.prepare(`DELETE FROM movies WHERE id IN (${placeholders})`).run(...ids);
    },

    restoreMoviesByIds(ids: string[]) {
      if (ids.length === 0) return;
      const db = resolveStorageDb(context);
      const placeholders = ids.map(() => "?").join(", ");
      db.prepare(`UPDATE movies SET deletedAt = NULL WHERE id IN (${placeholders})`).run(...ids);
    },
  };
});
