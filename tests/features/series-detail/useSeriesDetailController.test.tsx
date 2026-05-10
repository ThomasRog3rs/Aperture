import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSeriesDetailController } from "@/features/series-detail/useSeriesDetailController";
import type { SeriesDetailGateway } from "@/features/series-detail/gateway";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";
import type { RandomSessionSummary } from "@/features/series-detail/types";
import {
  createEpisode,
  createSeasonWithEpisodes,
  createSeries,
} from "../../helpers/createSeries";

afterEach(() => {
  cleanup();
});

function createSeriesFixture() {
  const episodeOne = createEpisode({
    id: "episode-1",
    seasonId: "season-1",
    episodeNumber: 1,
    titleRaw: "Episode One",
    titleClean: "Episode One",
    filePath: "/library/series/s01e01.mkv",
    watched: false,
    watchProgressSeconds: 45,
  });
  const episodeTwo = createEpisode({
    id: "episode-2",
    seasonId: "season-1",
    episodeNumber: 2,
    titleRaw: "Episode Two",
    titleClean: "Episode Two",
    filePath: "/library/series/s01e02.mkv",
    watched: false,
    watchProgressSeconds: 0,
  });
  const season = createSeasonWithEpisodes({
    id: "season-1",
    seriesId: "series-1",
    seasonNumber: 1,
    episodes: [episodeOne, episodeTwo],
    episodeCount: 2,
  });
  const series = createSeries({
    id: "series-1",
    titleClean: "Series One",
    posterPath: "/series-one.jpg",
    seasonCount: 1,
    seasons: [season],
  });

  return { series, seasons: [season], episodeOne, episodeTwo };
}

function createRandomSession(seriesId: string): RandomSessionSummary {
  return {
    seriesId,
    startedEpisodeIds: [],
    currentEpisodeId: null,
    startedEpisodeCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    totalEpisodeCount: 2,
    remainingEpisodeCount: 2,
    unwatchedRemainingEpisodeCount: 2,
    watchedRemainingEpisodeCount: 0,
    exhausted: false,
  };
}

function createGatewayMock(
  fixture: { series: Series; seasons: SeasonWithEpisodes[]; episodeOne: Episode },
  overrides: Partial<SeriesDetailGateway> = {}
): SeriesDetailGateway {
  return {
    getSeries: vi.fn().mockResolvedValue({
      series: fixture.series,
      seasons: fixture.seasons,
    }),
    getFolderImages: vi.fn().mockResolvedValue([]),
    updateSeries: vi
      .fn()
      .mockResolvedValue({ series: fixture.series, seasons: fixture.seasons }),
    refreshSeriesMetadata: vi.fn().mockResolvedValue(fixture.series),
    deleteSeries: vi.fn().mockResolvedValue(undefined),
    launchExternalPlayer: vi.fn().mockResolvedValue(undefined),
    updateEpisode: vi.fn().mockResolvedValue(fixture.episodeOne),
    saveEpisodeWatchProgress: vi.fn().mockResolvedValue(undefined),
    getRandomSession: vi.fn().mockResolvedValue({ session: null }),
    requestRandomSessionAction: vi.fn().mockResolvedValue({ session: null }),
    ...overrides,
  };
}

async function waitForControllerReady(
  result: { current: ReturnType<typeof useSeriesDetailController> }
) {
  await waitFor(() => expect(result.current.loading).toBe(false));
  await waitFor(() => expect(result.current.folderImagesLoading).toBe(false));
  await waitFor(() => expect(result.current.randomSessionLoading).toBe(false));
}

describe("useSeriesDetailController", () => {
  it("loads series, folder images, and random session", async () => {
    const fixture = createSeriesFixture();
    const randomSession = createRandomSession(fixture.series.id);
    const gateway = createGatewayMock(fixture, {
      getFolderImages: vi
        .fn()
        .mockResolvedValue([{ name: "poster.jpg", url: "/series-one.jpg" }]),
      getRandomSession: vi.fn().mockResolvedValue({ session: randomSession }),
    });

    const { result } = renderHook(() =>
      useSeriesDetailController({ seriesId: fixture.series.id, gateway })
    );

    await waitForControllerReady(result);

    expect(gateway.getSeries).toHaveBeenCalledWith(fixture.series.id);
    expect(gateway.getFolderImages).toHaveBeenCalledWith(
      fixture.series.id
    );
    expect(gateway.getRandomSession).toHaveBeenCalledWith(fixture.series.id);
    expect(result.current.series?.id).toBe(fixture.series.id);
    expect(result.current.title).toBe("Series One");
    expect(result.current.posterInput).toBe("/series-one.jpg");
    expect(result.current.selectedFolderImage).toBe("/series-one.jpg");
    expect(result.current.randomSession?.seriesId).toBe(fixture.series.id);
  });

  it("reports missing series id without calling gateway", async () => {
    const fixture = createSeriesFixture();
    const gateway = createGatewayMock(fixture);

    const { result } = renderHook(() =>
      useSeriesDetailController({ seriesId: undefined, gateway })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(gateway.getSeries).not.toHaveBeenCalled();
    expect(result.current.notice).toEqual({
      tone: "error",
      message: "Missing series id in URL.",
    });
  });

  it("validates save payload and updates series state", async () => {
    const fixture = createSeriesFixture();
    const updatedSeries = createSeries({
      ...fixture.series,
      titleClean: "Renamed Series",
      posterPath: "/renamed.jpg",
    });
    const gateway = createGatewayMock(fixture, {
      updateSeries: vi
        .fn()
        .mockResolvedValue({ series: updatedSeries, seasons: fixture.seasons }),
    });

    const { result } = renderHook(() =>
      useSeriesDetailController({ seriesId: fixture.series.id, gateway })
    );

    await waitForControllerReady(result);

    act(() => result.current.setTitle("   "));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(gateway.updateSeries).not.toHaveBeenCalled();
    expect(result.current.notice).toEqual({
      tone: "error",
      message: "Title cannot be empty.",
    });

    act(() => {
      result.current.setTitle("Renamed Series");
      result.current.setPosterInput("/renamed.jpg");
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(gateway.updateSeries).toHaveBeenCalledWith(fixture.series.id, {
      titleClean: "Renamed Series",
      posterPath: "/renamed.jpg",
    });
    expect(result.current.series?.titleClean).toBe("Renamed Series");
    expect(result.current.posterInput).toBe("/renamed.jpg");
    expect(result.current.notice).toEqual({
      tone: "success",
      message: "Series updated.",
    });
  });

  it("starts continue playback and advances to next episode on end", async () => {
    const fixture = createSeriesFixture();
    const gateway = createGatewayMock(fixture);

    const { result } = renderHook(() =>
      useSeriesDetailController({ seriesId: fixture.series.id, gateway })
    );

    await waitForControllerReady(result);

    act(() => {
      result.current.handlePlayContinue();
    });

    await waitFor(() => expect(result.current.activeEpisodeId).toBe("episode-1"));
    expect(result.current.playerStartTime).toBe(45);

    act(() => {
      result.current.handleEpisodeEnded("episode-1", 100, 100);
    });

    await waitFor(() => expect(result.current.activeEpisodeId).toBe("episode-2"));
    expect(gateway.saveEpisodeWatchProgress).toHaveBeenCalledWith("episode-1", 100, 100);
    expect(result.current.seasons[0].episodes[0].watched).toBe(true);
    expect(result.current.seasons[0].episodes[0].watchProgressSeconds).toBe(100);
  });

  it("shows random-session error when mark_started fails during random navigation", async () => {
    const fixture = createSeriesFixture();
    const requestRandomSessionAction = vi
      .fn()
      .mockResolvedValueOnce({
        session: createRandomSession(fixture.series.id),
        episode: fixture.episodeOne,
      })
      .mockRejectedValueOnce(new Error("Failed to update random session."));
    const gateway = createGatewayMock(fixture, {
      requestRandomSessionAction,
    });

    const { result } = renderHook(() =>
      useSeriesDetailController({ seriesId: fixture.series.id, gateway })
    );

    await waitForControllerReady(result);

    await act(async () => {
      await result.current.handleRandomSessionAction("start_new");
    });
    await waitFor(() => expect(result.current.playbackMode).toBe("random"));

    act(() => {
      result.current.handlePlayNextEpisode();
    });

    await waitFor(() =>
      expect(result.current.notice).toEqual({
        tone: "error",
        message: "Failed to update random session.",
      })
    );
    expect(result.current.activeEpisodeId).toBe("episode-1");
  });

  it("closes player when random session is exhausted on next_random", async () => {
    const fixture = createSeriesFixture();
    const requestRandomSessionAction = vi
      .fn()
      .mockResolvedValueOnce({ session: createRandomSession(fixture.series.id), episode: fixture.episodeOne })
      .mockResolvedValueOnce({ session: null, exhausted: true });
    const gateway = createGatewayMock(fixture, {
      requestRandomSessionAction,
    });

    const { result } = renderHook(() =>
      useSeriesDetailController({ seriesId: fixture.series.id, gateway })
    );

    await waitForControllerReady(result);

    await act(async () => {
      await result.current.handleRandomSessionAction("start_new");
    });
    await waitFor(() => expect(result.current.activeEpisodeId).toBe("episode-1"));

    await act(async () => {
      await result.current.handleRandomSessionAction("next_random");
    });

    expect(result.current.activeEpisodeId).toBe(null);
    expect(result.current.notice).toEqual({
      tone: "info",
      message: "This random session is complete. Start a new one to keep going.",
    });
  });

  it("updates watched state through gateway and clears toggling set", async () => {
    const fixture = createSeriesFixture();
    const gateway = createGatewayMock(fixture, {
      updateEpisode: vi.fn().mockResolvedValue({ ...fixture.episodeOne, watched: true }),
    });

    const { result } = renderHook(() =>
      useSeriesDetailController({ seriesId: fixture.series.id, gateway })
    );

    await waitForControllerReady(result);

    await act(async () => {
      await result.current.handleToggleEpisodeWatched(fixture.episodeOne, true);
    });

    expect(gateway.updateEpisode).toHaveBeenCalledWith("episode-1", { watched: true });
    expect(result.current.seasons[0].episodes[0].watched).toBe(true);
    expect(result.current.togglingWatchedEpisodeIds.has("episode-1")).toBe(false);
  });

  it("supports delete confirmation and onDeleted callback", async () => {
    const fixture = createSeriesFixture();
    const onDeleted = vi.fn();
    const confirmDelete = vi.fn().mockReturnValue(true);
    const gateway = createGatewayMock(fixture);

    const { result } = renderHook(() =>
      useSeriesDetailController({
        seriesId: fixture.series.id,
        gateway,
        confirmDelete,
        onDeleted,
      })
    );

    await waitForControllerReady(result);

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(confirmDelete).toHaveBeenCalled();
    expect(gateway.deleteSeries).toHaveBeenCalledWith(fixture.series.id);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it("does not delete when confirmation is rejected", async () => {
    const fixture = createSeriesFixture();
    const confirmDelete = vi.fn().mockReturnValue(false);
    const gateway = createGatewayMock(fixture);

    const { result } = renderHook(() =>
      useSeriesDetailController({
        seriesId: fixture.series.id,
        gateway,
        confirmDelete,
      })
    );

    await waitForControllerReady(result);

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(confirmDelete).toHaveBeenCalled();
    expect(gateway.deleteSeries).not.toHaveBeenCalled();
  });
});
