import { describe, expect, it } from "vitest";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";
import {
  buildEpisodeEndedUpdate,
  buildEpisodeProgressUpdate,
  buildOrderedEpisodes,
  findActiveEpisodeState,
  getCastCrew,
  getContinueEpisode,
  getInitialSelectedFolderImage,
  getMatchingFolderImageUrl,
  getRandomSessionExhaustedNotice,
  getSeasonSummary,
  getSeriesRating,
  updateEpisodeInSeasons,
} from "@/app/(app)/series/[id]/series-detail.selectors";

function createEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: "episode-1",
    seasonId: "season-1",
    episodeNumber: 1,
    titleRaw: "Pilot Raw",
    titleClean: "Pilot",
    filePath: "/library/episode-1.mkv",
    fileSizeBytes: 1,
    lastSyncedAt: 1,
    watched: false,
    watchProgressSeconds: 0,
    selectedSubtitleId: null,
    subtitlesEnabled: false,
    ...overrides,
  };
}

function createSeason(overrides: Partial<SeasonWithEpisodes> = {}): SeasonWithEpisodes {
  return {
    id: "season-1",
    seriesFolderPath: "/library/series",
    seriesId: "series-1",
    seasonFolderPath: "/library/series/season-1",
    seasonNumber: 1,
    titleRaw: "Season 1",
    titleClean: "Season 1",
    titleEditedAt: null,
    year: 2024,
    tmdbId: 1,
    posterPath: "/poster.jpg",
    backdropPath: "/backdrop.jpg",
    tmdbRating: 7.5,
    genres: ["Drama"],
    omdbGenres: ["Drama"],
    directors: ["Pat Doe"],
    writers: ["Sam Doe"],
    actors: ["Chris Doe"],
    userGenres: [],
    personalRating: null,
    errorMessage: null,
    lastSyncedAt: 1,
    xxxRated: false,
    watched: false,
    episodeCount: 2,
    episodes: [
      createEpisode(),
      createEpisode({
        id: "episode-2",
        episodeNumber: 2,
        titleRaw: "Second Raw",
        titleClean: "Second",
        watched: true,
      }),
    ],
    ...overrides,
  };
}

describe("series-detail.selectors", () => {
  it("builds ordered episodes and derives active navigation state", () => {
    const seasonOne = createSeason();
    const seasonTwo = createSeason({
      id: "season-2",
      seasonNumber: 2,
      titleClean: "Season 2",
      episodes: [
        createEpisode({
          id: "episode-3",
          seasonId: "season-2",
          episodeNumber: 1,
          titleClean: "Third",
        }),
      ],
    });

    const ordered = buildOrderedEpisodes([seasonOne, seasonTwo]);
    const active = findActiveEpisodeState(ordered, "episode-2");

    expect(ordered.map(({ episode }) => episode.id)).toEqual([
      "episode-1",
      "episode-2",
      "episode-3",
    ]);
    expect(active.activeEpisode?.id).toBe("episode-2");
    expect(active.previousEpisodeItem?.episode.id).toBe("episode-1");
    expect(active.nextEpisodeItem?.episode.id).toBe("episode-3");
  });

  it("picks the first unwatched episode for continue and falls back to the first episode", () => {
    const ordered = buildOrderedEpisodes([createSeason()]);
    expect(getContinueEpisode(ordered)?.id).toBe("episode-1");

    const allWatched = buildOrderedEpisodes([
      createSeason({
        episodes: [
          createEpisode({ id: "episode-a", watched: true }),
          createEpisode({ id: "episode-b", watched: true, episodeNumber: 2 }),
        ],
      }),
    ]);
    expect(getContinueEpisode(allWatched)?.id).toBe("episode-a");
  });

  it("deduplicates cast and crew names case-insensitively", () => {
    const castCrew = getCastCrew([
      createSeason({
        directors: ["Pat Doe", " pat doe "],
        writers: ["Sam Doe"],
        actors: ["Chris Doe", "chris doe", "Taylor Doe"],
      }),
    ]);

    expect(castCrew.directors).toEqual(["Pat Doe"]);
    expect(castCrew.writers).toEqual(["Sam Doe"]);
    expect(castCrew.actors).toEqual(["Chris Doe", "Taylor Doe"]);
  });

  it("computes progress and completion episode updates using the 90 percent watched threshold", () => {
    expect(buildEpisodeProgressUpdate(89, 100)).toEqual({
      watchProgressSeconds: 89,
    });
    expect(buildEpisodeProgressUpdate(90, 100)).toEqual({
      watchProgressSeconds: 90,
      watched: true,
    });

    expect(buildEpisodeEndedUpdate(95, 100)).toEqual({
      completedTime: 100,
      updates: {
        watchProgressSeconds: 100,
        watched: true,
      },
    });
  });

  it("updates a single episode in season state without mutating unrelated episodes", () => {
    const seasons = [createSeason()];
    const updated = updateEpisodeInSeasons(seasons, "episode-1", {
      watched: true,
      watchProgressSeconds: 42,
    });

    expect(updated[0].episodes[0]).toMatchObject({
      id: "episode-1",
      watched: true,
      watchProgressSeconds: 42,
    });
    expect(updated[0].episodes[1]).toBe(seasons[0].episodes[1]);
  });

  it("chooses and syncs folder images using the current poster url", () => {
    const folderImages = [
      { name: "poster.jpg", url: "/poster.jpg" },
      { name: "cover.jpg", url: "/cover.jpg" },
    ];

    expect(getInitialSelectedFolderImage(folderImages, "/cover.jpg")).toBe(
      "/cover.jpg"
    );
    expect(getInitialSelectedFolderImage(folderImages, null)).toBe("/poster.jpg");
    expect(getMatchingFolderImageUrl(folderImages, "  /cover.jpg  ")).toBe(
      "/cover.jpg"
    );
  });

  it("summarizes seasons, ratings, and random-session exhausted notices", () => {
    const series: Series = {
      id: "series-1",
      titleClean: "Series",
      seasonCount: 2,
      posterPath: null,
      seasons: [createSeason()],
    };

    expect(getSeasonSummary(series)).toBe("2 seasons");
    expect(
      getSeriesRating([
        createSeason({ tmdbRating: 7.5 }),
        createSeason({ id: "season-2", tmdbRating: 8.4 }),
      ])
    ).toBe(8.4);
    expect(getRandomSessionExhaustedNotice("start_new")).toEqual({
      tone: "info",
      message: "This series has no remaining episodes for a random session.",
    });
  });
});
