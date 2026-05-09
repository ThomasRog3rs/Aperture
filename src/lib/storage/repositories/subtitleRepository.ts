import { createRepositoryFactory, resolveStorageDb } from "@/lib/storage/context";
import type { SubtitleRow, SubtitleUpsert } from "@/lib/storage/types";

export const createSubtitleRepository = createRepositoryFactory((context) => {
  return {
    upsertSubtitle(sub: SubtitleUpsert): void {
      const db = resolveStorageDb(context);
      db.prepare(
        `
        INSERT INTO subtitles (
          id, mediaType, mediaId, filePath, fileName, language, format, source, downloadedAt
        ) VALUES (
          @id, @mediaType, @mediaId, @filePath, @fileName, @language, @format, @source, @downloadedAt
        )
        ON CONFLICT(filePath) DO UPDATE SET
          fileName = excluded.fileName,
          language = excluded.language,
          format = excluded.format,
          source = CASE WHEN subtitles.source = 'opensubtitles' THEN 'opensubtitles' ELSE excluded.source END,
          downloadedAt = CASE WHEN excluded.downloadedAt IS NOT NULL THEN excluded.downloadedAt ELSE subtitles.downloadedAt END
        `
      ).run(sub);
    },

    listSubtitlesByMedia(mediaType: string, mediaId: string): SubtitleRow[] {
      const db = resolveStorageDb(context);
      return db
        .prepare(
          "SELECT * FROM subtitles WHERE mediaType = ? AND mediaId = ? ORDER BY language ASC, fileName ASC"
        )
        .all(mediaType, mediaId) as SubtitleRow[];
    },

    getSubtitleById(id: string): SubtitleRow | null {
      const db = resolveStorageDb(context);
      const row = db.prepare("SELECT * FROM subtitles WHERE id = ?").get(id);
      return (row as SubtitleRow | undefined) ?? null;
    },

    deleteSubtitleById(id: string): void {
      const db = resolveStorageDb(context);
      db.prepare("DELETE FROM subtitles WHERE id = ?").run(id);
    },

    deleteSubtitlesByMediaId(mediaType: string, mediaId: string, filePaths: string[]): void {
      const db = resolveStorageDb(context);
      if (filePaths.length === 0) {
        db.prepare("DELETE FROM subtitles WHERE mediaType = ? AND mediaId = ?").run(mediaType, mediaId);
        return;
      }
      const placeholders = filePaths.map(() => "?").join(", ");
      db.prepare(
        `DELETE FROM subtitles WHERE mediaType = ? AND mediaId = ? AND filePath NOT IN (${placeholders})`
      ).run(mediaType, mediaId, ...filePaths);
    },

    updateMovieSubtitlePreference(
      movieId: string,
      selectedSubtitleId: string | null,
      subtitlesEnabled: boolean
    ): void {
      const db = resolveStorageDb(context);
      db.prepare(
        "UPDATE movies SET selectedSubtitleId = @selectedSubtitleId, subtitlesEnabled = @subtitlesEnabled WHERE id = @id"
      ).run({ id: movieId, selectedSubtitleId, subtitlesEnabled: subtitlesEnabled ? 1 : 0 });
    },

    updateEpisodeSubtitlePreference(
      episodeId: string,
      selectedSubtitleId: string | null,
      subtitlesEnabled: boolean
    ): void {
      const db = resolveStorageDb(context);
      db.prepare(
        "UPDATE episodes SET selectedSubtitleId = @selectedSubtitleId, subtitlesEnabled = @subtitlesEnabled WHERE id = @id"
      ).run({ id: episodeId, selectedSubtitleId, subtitlesEnabled: subtitlesEnabled ? 1 : 0 });
    },
  };
});
