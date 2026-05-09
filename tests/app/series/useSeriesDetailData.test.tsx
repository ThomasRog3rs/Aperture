import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSeriesDetailData } from "@/app/(app)/series/[id]/useSeriesDetailData";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";
import type {
  RandomSessionSummary,
  SeriesDetailResponse,
  SeriesNotice,
} from "@/app/(app)/series/[id]/series-detail.types";

const apiMocks = vi.hoisted(() => ({
  fetchSeriesDetail: vi.fn(),
  fetchRandomSession: vi.fn(),
  runRandomSessionAction: vi.fn(),
  updateEpisodeWatched: vi.fn(),
}));

vi.mock("@/app/(app)/series/[id]/series-detail.api", () => apiMocks);

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
    directors: [],
    writers: [],
    actors: [],
    userGenres: [],
    personalRating: null,
    errorMessage: null,
    lastSyncedAt: 1,
    xxxRated: false,
    watched: false,
    episodeCount: 1,
    episodes: [createEpisode()],
    ...overrides,
  };
}

function createSeriesDetail(): SeriesDetailResponse {
  const season = createSeason();
  const series: Series = {
    id: "series-1",
    titleClean: "Sample Series",
    seasonCount: 1,
    posterPath: "/poster.jpg",
    seasons: [season],
  };

  return {
    series,
    seasons: [season],
  };
}

function createRandomSession(): RandomSessionSummary {
  return {
    seriesId: "series-1",
    startedEpisodeIds: ["episode-1"],
    currentEpisodeId: "episode-1",
    startedEpisodeCount: 1,
    createdAt: 1,
    updatedAt: 1,
    totalEpisodeCount: 10,
    remainingEpisodeCount: 9,
    unwatchedRemainingEpisodeCount: 8,
    watchedRemainingEpisodeCount: 1,
    exhausted: false,
  };
}

describe("useSeriesDetailData", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the series detail and random session state on mount", async () => {
    apiMocks.fetchSeriesDetail.mockResolvedValue(createSeriesDetail());
    apiMocks.fetchRandomSession.mockResolvedValue({
      session: createRandomSession(),
    });

    const setNotice = vi.fn<
      (value: SeriesNotice | ((current: SeriesNotice | null) => SeriesNotice | null) | null) => void
    >();

    const { result } = renderHook(() =>
      useSeriesDetailData({ seriesId: "series-1", setNotice })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() =>
      expect(result.current.randomSession?.seriesId).toBe("series-1")
    );

    expect(result.current.series?.titleClean).toBe("Sample Series");
    expect(result.current.seasons).toHaveLength(1);
    expect(apiMocks.fetchSeriesDetail).toHaveBeenCalledWith("series-1");
    expect(apiMocks.fetchRandomSession).toHaveBeenCalledWith("series-1");
  });

  it("surfaces a missing id as a route-level notice without fetching", async () => {
    const setNotice = vi.fn();

    const { result } = renderHook(() =>
      useSeriesDetailData({ seriesId: undefined, setNotice })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiMocks.fetchSeriesDetail).not.toHaveBeenCalled();
    expect(setNotice).toHaveBeenCalledWith({
      tone: "error",
      message: "Missing series id in URL.",
    });
  });
});
