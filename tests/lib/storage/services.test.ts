import { describe, expect, it, vi } from "vitest";

import { createDeletedItemLifecycleService } from "@/lib/storage/services/deletedItemLifecycleService";
import { createFilterAggregationService } from "@/lib/storage/services/filterAggregationService";
import { createSeriesDeletionService } from "@/lib/storage/services/seriesDeletionService";

describe("storage orchestration services", () => {
  it("orchestrates series deletion cascade in repository order", () => {
    const seriesRepository = {
      getSeriesFolderPathById: vi.fn(() => "/library/series/show-a"),
      deleteSeries: vi.fn(),
    };
    const seasonRepository = {
      listSeasonsBySeriesFolderPath: vi.fn(() => [{ id: "season-1" }, { id: "season-2" }]),
      deleteSeasonsBySeriesFolderPath: vi.fn(),
    };
    const episodeRepository = {
      deleteEpisodesBySeasonIds: vi.fn(),
    };
    const seriesRandomSessionRepository = {
      deleteSeriesRandomSession: vi.fn(),
    };

    const service = createSeriesDeletionService({
      seriesRepository,
      seasonRepository,
      episodeRepository,
      seriesRandomSessionRepository,
    });

    service.deleteSeries("series-1");

    expect(seriesRepository.getSeriesFolderPathById).toHaveBeenCalledWith("series-1");
    expect(seasonRepository.listSeasonsBySeriesFolderPath).toHaveBeenCalledWith(
      "/library/series/show-a"
    );
    expect(episodeRepository.deleteEpisodesBySeasonIds).toHaveBeenCalledWith([
      "season-1",
      "season-2",
    ]);
    expect(seasonRepository.deleteSeasonsBySeriesFolderPath).toHaveBeenCalledWith(
      "/library/series/show-a"
    );
    expect(seriesRepository.deleteSeries).toHaveBeenCalledWith("series-1");
    expect(seriesRandomSessionRepository.deleteSeriesRandomSession).toHaveBeenCalledWith("series-1");
  });

  it("skips series deletion cascade when no active series folder is resolvable", () => {
    const seriesRepository = {
      getSeriesFolderPathById: vi.fn(() => null),
      deleteSeries: vi.fn(),
    };
    const seasonRepository = {
      listSeasonsBySeriesFolderPath: vi.fn(() => [{ id: "season-1" }]),
      deleteSeasonsBySeriesFolderPath: vi.fn(),
    };
    const episodeRepository = {
      deleteEpisodesBySeasonIds: vi.fn(),
    };
    const seriesRandomSessionRepository = {
      deleteSeriesRandomSession: vi.fn(),
    };

    const service = createSeriesDeletionService({
      seriesRepository,
      seasonRepository,
      episodeRepository,
      seriesRandomSessionRepository,
    });

    service.deleteSeries("series-1");

    expect(seasonRepository.listSeasonsBySeriesFolderPath).not.toHaveBeenCalled();
    expect(episodeRepository.deleteEpisodesBySeasonIds).not.toHaveBeenCalled();
    expect(seasonRepository.deleteSeasonsBySeriesFolderPath).not.toHaveBeenCalled();
    expect(seriesRepository.deleteSeries).not.toHaveBeenCalled();
    expect(seriesRandomSessionRepository.deleteSeriesRandomSession).not.toHaveBeenCalled();
  });

  it("orchestrates deleted-item lifecycle counting, purge, and restore flows", () => {
    const movieRepository = {
      listDeletedMovies: vi.fn(() => []),
      countDeletedMovies: vi.fn(() => 2),
      purgeDeletedMovies: vi.fn(),
      purgeMoviesByIds: vi.fn(),
      restoreMoviesByIds: vi.fn(),
    };
    const seasonRepository = {
      listDeletedSeasons: vi.fn(() => []),
      listDeletedSeasonIds: vi.fn(() => ["season-1", "season-2", "season-3"]),
      countDeletedSeasons: vi.fn(() => 3),
      purgeDeletedSeasons: vi.fn(),
      purgeSeasonsByIds: vi.fn(),
      restoreSeasonsByIds: vi.fn(),
    };
    const episodeRepository = {
      countDeletedEpisodes: vi.fn(() => 5),
      deleteEpisodesBySeasonIds: vi.fn(),
      restoreEpisodesBySeasonIds: vi.fn(),
      purgeDeletedEpisodes: vi.fn(),
    };
    const service = createDeletedItemLifecycleService({
      movieRepository,
      seasonRepository,
      episodeRepository,
    });

    expect(service.countDeletedItems()).toEqual({
      movies: 2,
      seasons: 3,
      episodes: 5,
      total: 10,
    });
    expect(service.purgeDeletedItems()).toBe(5);
    service.purgeSeasonsByIds(["season-9"]);
    service.restoreSeasonsByIds(["season-8"]);

    expect(movieRepository.purgeDeletedMovies).toHaveBeenCalledTimes(1);
    expect(episodeRepository.deleteEpisodesBySeasonIds).toHaveBeenNthCalledWith(1, [
      "season-1",
      "season-2",
      "season-3",
    ]);
    expect(seasonRepository.purgeDeletedSeasons).toHaveBeenCalledTimes(1);
    expect(episodeRepository.purgeDeletedEpisodes).toHaveBeenCalledTimes(1);
    expect(episodeRepository.deleteEpisodesBySeasonIds).toHaveBeenNthCalledWith(2, ["season-9"]);
    expect(seasonRepository.purgeSeasonsByIds).toHaveBeenCalledWith(["season-9"]);
    expect(seasonRepository.restoreSeasonsByIds).toHaveBeenCalledWith(["season-8"]);
    expect(episodeRepository.restoreEpisodesBySeasonIds).toHaveBeenCalledWith(["season-8"]);
  });

  it("aggregates genres and people from active rows with case-insensitive de-dupe", () => {
    const movieRepository = {
      listActiveGenreRows: vi.fn(() => [
        { genresJson: '[" Drama ", "Action"]', userGenresJson: '["drama","Comedy"]' },
        { genresJson: "not-json", userGenresJson: null },
      ]),
      listActivePeopleRows: vi.fn(() => [
        {
          directorsJson: '[" Jane Doe ", "john smith"]',
          writersJson: '["Amy"]',
          actorsJson: '["Actor A", " "]',
        },
      ]),
    };
    const seasonRepository = {
      listActiveGenreRows: vi.fn(() => [{ genresJson: '["action","Thriller"]', userGenresJson: '[""]' }]),
      listActivePeopleRows: vi.fn(() => [
        {
          directorsJson: '["John Smith", "Zed"]',
          writersJson: "{ bad",
          actorsJson: '["actor a", "Actor B"]',
        },
      ]),
    };
    const service = createFilterAggregationService({ movieRepository, seasonRepository });

    expect(service.listGenres()).toEqual(["Action", "Comedy", "Drama", "Thriller"]);
    expect(service.listPeople()).toEqual({
      directors: ["Jane Doe", "john smith", "Zed"],
      writers: ["Amy"],
      actors: ["Actor A", "Actor B"],
    });
  });
});
