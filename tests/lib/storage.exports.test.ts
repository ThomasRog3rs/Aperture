import { describe, expect, expectTypeOf, it } from "vitest";

import * as storage from "@/lib/storage";
import type {
  DeletedMovieRow,
  DeletedSeasonRow,
  EpisodeRow,
  EpisodeUpdate,
  EpisodeUpsert,
  FolderScanEntryRow,
  FolderScanEntryUpsert,
  FolderScanStateRow,
  FolderScanStateUpsert,
  FolderScanType,
  MovieQuery,
  MovieRow,
  MovieUpdate,
  MovieUpsert,
  SeasonQuery,
  SeasonRow,
  SeasonUpdate,
  SeasonUpsert,
  SeriesRandomSession,
  SeriesRandomSessionRow,
  SeriesRow,
  SeriesUpdate,
  SeriesUpsert,
  SubtitleRow,
  SubtitleUpsert,
} from "@/lib/storage";

describe("storage facade exports", () => {
  it("preserves legacy value exports from @/lib/storage", () => {
    expect(Object.keys(storage).sort()).toEqual([
      "countDeletedItems",
      "countEpisodesBySeasonId",
      "deleteMovie",
      "deleteSeasonById",
      "deleteSeries",
      "deleteSeriesRandomSession",
      "deleteSubtitleById",
      "deleteSubtitlesByMediaId",
      "getAllMovieFolderPaths",
      "getAllSeasonFolderPaths",
      "getEpisodeById",
      "getEpisodeCountsBySeasonIds",
      "getEpisodesBySeasonId",
      "getMovieById",
      "getSeasonById",
      "getSeriesByFolderPath",
      "getSeriesById",
      "getSeriesFolderPathById",
      "getSeriesRandomSession",
      "getSetting",
      "getSubtitleById",
      "listAllFolderScanEntries",
      "listAllFolderScanStates",
      "listDeletedMovies",
      "listDeletedSeasons",
      "listGenres",
      "listMovies",
      "listPeople",
      "listSeasons",
      "listSeasonsBySeriesFolderPath",
      "listSeriesFolderPaths",
      "listSubtitlesByMedia",
      "markEpisodesDeletedNotInSeason",
      "markMoviesDeleted",
      "markSeasonDeleted",
      "markSeasonsDeleted",
      "markSeriesRandomSessionEpisodeStarted",
      "purgeDeletedItems",
      "purgeMoviesByIds",
      "purgeSeasonsByIds",
      "replaceSeriesRandomSession",
      "restoreMoviesByIds",
      "restoreSeasonsByIds",
      "saveFolderScanSnapshot",
      "setSetting",
      "updateEpisode",
      "updateEpisodeSubtitlePreference",
      "updateMovie",
      "updateMovieSubtitlePreference",
      "updatePersonalRating",
      "updateSeason",
      "updateSeries",
      "upsertEpisode",
      "upsertMovie",
      "upsertSeason",
      "upsertSeries",
      "upsertSubtitle",
    ]);
  });

  it("preserves legacy type exports from @/lib/storage", () => {
    type StorageTypeSurface = {
      DeletedMovieRow: DeletedMovieRow;
      DeletedSeasonRow: DeletedSeasonRow;
      EpisodeRow: EpisodeRow;
      EpisodeUpdate: EpisodeUpdate;
      EpisodeUpsert: EpisodeUpsert;
      FolderScanEntryRow: FolderScanEntryRow;
      FolderScanEntryUpsert: FolderScanEntryUpsert;
      FolderScanStateRow: FolderScanStateRow;
      FolderScanStateUpsert: FolderScanStateUpsert;
      FolderScanType: FolderScanType;
      MovieQuery: MovieQuery;
      MovieRow: MovieRow;
      MovieUpdate: MovieUpdate;
      MovieUpsert: MovieUpsert;
      SeasonQuery: SeasonQuery;
      SeasonRow: SeasonRow;
      SeasonUpdate: SeasonUpdate;
      SeasonUpsert: SeasonUpsert;
      SeriesRandomSession: SeriesRandomSession;
      SeriesRandomSessionRow: SeriesRandomSessionRow;
      SeriesRow: SeriesRow;
      SeriesUpdate: SeriesUpdate;
      SeriesUpsert: SeriesUpsert;
      SubtitleRow: SubtitleRow;
      SubtitleUpsert: SubtitleUpsert;
    };

    expectTypeOf<StorageTypeSurface>().toEqualTypeOf<StorageTypeSurface>();
  });
});
