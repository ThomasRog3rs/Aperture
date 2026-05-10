import { describe, expect, it } from "vitest";
import {
  areAllEpisodesWatched,
  buildOrderedEpisodes,
  buildSeriesEditUpdates,
  formatTimestamp,
  getContinueEpisode,
  getEpisodeNavigationTarget,
  getEpisodeNumberLabel,
  getEpisodePlayerTitle,
  getPosterCandidate,
  getSeasonLabel,
  getSeasonSummary,
  getSeriesCastCrew,
  getSeriesRating,
  hasMissingBasicSeriesInfo,
} from "@/features/series-detail/domain";
import {
  createEpisode,
  createSeasonWithEpisodes,
  createSeries,
} from "../../helpers/createSeries";

describe("series-detail domain", () => {
  it("builds edit updates and reports empty title validation", () => {
    const series = createSeries({ titleClean: "Current", posterPath: "/poster-a.jpg" });

    expect(buildSeriesEditUpdates(series, "   ", "/poster-b.jpg").error).toBe(
      "Title cannot be empty."
    );

    const result = buildSeriesEditUpdates(series, "Updated", "   ");
    expect(result.updates).toEqual({
      titleClean: "Updated",
      posterPath: null,
    });
  });

  it("computes episode labels and player metadata", () => {
    const season = createSeasonWithEpisodes({ seasonNumber: 3, titleClean: "Season Three" });
    const episode = createEpisode({ id: "episode-9", episodeNumber: 9, titleClean: "The Climb" });

    expect(getSeasonLabel(season)).toBe("Season 3");
    expect(getEpisodeNumberLabel(episode)).toBe("9");
    expect(getEpisodePlayerTitle(episode)).toBe("Episode 9 — The Climb");
    expect(getEpisodeNavigationTarget(season, episode)).toEqual({
      id: "episode-9",
      title: "The Climb",
      subtitle: "Season 3 • Episode 9",
    });
  });

  it("orders episodes and computes continue/all-watched state", () => {
    const seasonOne = createSeasonWithEpisodes({
      id: "season-1",
      episodes: [
        createEpisode({ id: "episode-1", watched: true }),
        createEpisode({ id: "episode-2", watched: false }),
      ],
    });
    const seasonTwo = createSeasonWithEpisodes({
      id: "season-2",
      seasonNumber: 2,
      episodes: [createEpisode({ id: "episode-3", watched: false })],
    });

    const ordered = buildOrderedEpisodes([seasonOne, seasonTwo]);
    expect(ordered.map(({ episode }) => episode.id)).toEqual([
      "episode-1",
      "episode-2",
      "episode-3",
    ]);
    expect(getContinueEpisode(ordered)?.id).toBe("episode-2");
    expect(areAllEpisodesWatched(ordered)).toBe(false);

    const watchedOrdered = ordered.map((item) => ({
      ...item,
      episode: { ...item.episode, watched: true },
    }));
    expect(areAllEpisodesWatched(watchedOrdered)).toBe(true);
  });

  it("computes rating, cast/crew, season summary, and missing basic info", () => {
    const seasons = [
      createSeasonWithEpisodes({
        tmdbRating: 7.1,
        year: 2022,
        directors: [" Alex Doe ", "alex doe"],
        writers: ["Writer One", "writer one"],
        actors: ["Actor One", "Actor Two", "actor one"],
      }),
      createSeasonWithEpisodes({
        id: "season-2",
        seasonNumber: 2,
        tmdbRating: 8.4,
        year: 2023,
        directors: ["Director Two"],
      }),
    ];

    expect(getSeriesRating(seasons)).toBe(8.4);
    expect(getSeriesCastCrew(seasons)).toEqual({
      directors: ["Alex Doe", "Director Two"],
      writers: ["Writer One"],
      actors: ["Actor One", "Actor Two"],
    });

    expect(getSeasonSummary(createSeries({ seasonCount: 2 }))).toBe("2 seasons");
    expect(getPosterCandidate(" /next.jpg ", createSeries({ posterPath: "/old.jpg" }))).toBe(
      "/next.jpg"
    );
    expect(hasMissingBasicSeriesInfo(createSeries(), seasons)).toBe(false);
    expect(
      hasMissingBasicSeriesInfo(createSeries(), [createSeasonWithEpisodes({ tmdbRating: null })])
    ).toBe(true);
  });

  it("formats timestamps and handles null", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp(0)).toBe("—");
    expect(typeof formatTimestamp(Date.now())).toBe("string");
  });
});
