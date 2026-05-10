import { describe, expect, it, vi } from "vitest";
import { createFetchSeriesDetailGateway } from "@/features/series-detail/gateway";
import { createEpisode, createSeasonWithEpisodes, createSeries } from "../../helpers/createSeries";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("series-detail gateway", () => {
  it("calls injected fetch with global context", async () => {
    const series = createSeries({ id: "series-fetch-bind" });
    let wasBoundToGlobal = false;

    function strictFetch(this: unknown) {
      wasBoundToGlobal = this === globalThis;
      return Promise.resolve(
        jsonResponse({
          series,
          seasons: [createSeasonWithEpisodes()],
        })
      );
    }

    const gateway = createFetchSeriesDetailGateway(strictFetch as unknown as typeof fetch);
    const loaded = await gateway.getSeries(series.id);

    expect(loaded.series.id).toBe("series-fetch-bind");
    expect(wasBoundToGlobal).toBe(true);
  });

  it("normalizes series seasons and supports explicit update/delete/error flows", async () => {
    const series = createSeries({ seasons: [createSeasonWithEpisodes({ episodes: [] })] });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ series }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            series: createSeries({ titleClean: "Updated" }),
            seasons: [createSeasonWithEpisodes()],
          },
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(jsonResponse({ error: "Cannot delete" }, { status: 500 }));

    const gateway = createFetchSeriesDetailGateway(fetchMock);

    const loaded = await gateway.getSeries(series.id);
    expect(loaded.seasons[0]?.episodes).toEqual([]);

    const updated = await gateway.updateSeries(series.id, { titleClean: "Updated" });
    expect(updated.series?.titleClean).toBe("Updated");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/series/${series.id}`,
      expect.objectContaining({ method: "PATCH" })
    );

    await expect(gateway.deleteSeries(series.id)).rejects.toThrow("Cannot delete");
  });

  it("handles folder images, refresh metadata, and random session actions", async () => {
    const season = createSeasonWithEpisodes();
    const series = createSeries({ seasons: [season] });
    const episode = createEpisode({ id: "episode-random" });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ images: [{ name: "a", url: "/a.jpg" }] }))
      .mockResolvedValueOnce(jsonResponse({ series }))
      .mockResolvedValueOnce(jsonResponse({ session: null }))
      .mockResolvedValueOnce(jsonResponse({ session: { seriesId: series.id }, episode }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const gateway = createFetchSeriesDetailGateway(fetchMock);

    await expect(gateway.getFolderImages(series.id)).resolves.toEqual([
      { name: "a", url: "/a.jpg" },
    ]);
    await expect(gateway.refreshSeriesMetadata(series.id)).resolves.toEqual(series);
    await expect(gateway.getRandomSession(series.id)).resolves.toEqual({ session: null });
    await expect(
      gateway.requestRandomSessionAction(series.id, { action: "next_random" })
    ).resolves.toMatchObject({ episode: { id: "episode-random" } });
    await expect(gateway.getRandomSession(series.id)).resolves.toEqual({});
  });

  it("updates episode, saves progress, launches player, and surfaces parse errors", async () => {
    const episode = createEpisode({ id: "episode-1", watched: true });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ episode }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ error: "Player blocked" }, { status: 500 }))
      .mockResolvedValueOnce(new Response("not-json", { status: 500 }));

    const gateway = createFetchSeriesDetailGateway(fetchMock);

    await expect(gateway.updateEpisode(episode.id, { watched: true })).resolves.toEqual(
      episode
    );
    await expect(gateway.saveEpisodeWatchProgress(episode.id, 25.4, 100)).resolves.toBeUndefined();
    await expect(gateway.launchExternalPlayer(episode.filePath)).rejects.toThrow("Player blocked");
    await expect(gateway.getSeries("bad-json")).rejects.toThrow(
      "Received invalid JSON while loading series details."
    );
  });
});
