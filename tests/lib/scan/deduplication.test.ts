import { describe, it, expect } from "vitest";
import { dedupeEpisodes } from "@/lib/scan/deduplication";
import type { ScannedEpisode } from "@/lib/scan/types";

const makeEpisode = (overrides: Partial<ScannedEpisode> = {}): ScannedEpisode => ({
  filePath: "/s1/e01.mkv",
  fileSizeBytes: 500_000,
  episodeNumber: 1,
  titleRaw: "Episode 1.mkv",
  titleClean: "Episode 1",
  ...overrides,
});

describe("dedupeEpisodes", () => {
  it("returns empty array for empty input", () => {
    expect(dedupeEpisodes([])).toEqual([]);
  });

  it("returns a single episode unchanged", () => {
    const ep = makeEpisode();
    expect(dedupeEpisodes([ep])).toEqual([ep]);
  });

  it("keeps the largest file when episode numbers collide", () => {
    const small = makeEpisode({ filePath: "/s1/small.mkv", fileSizeBytes: 100 });
    const large = makeEpisode({ filePath: "/s1/large.mkv", fileSizeBytes: 999 });
    const result = dedupeEpisodes([small, large]);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe("/s1/large.mkv");
  });

  it("preserves distinct episode numbers", () => {
    const ep1 = makeEpisode({ episodeNumber: 1 });
    const ep2 = makeEpisode({ episodeNumber: 2, filePath: "/s1/e02.mkv" });
    const result = dedupeEpisodes([ep2, ep1]);
    expect(result).toHaveLength(2);
  });

  it("sorts episodes by episode number ascending", () => {
    const ep3 = makeEpisode({ episodeNumber: 3, filePath: "/s1/e03.mkv" });
    const ep1 = makeEpisode({ episodeNumber: 1, filePath: "/s1/e01.mkv" });
    const ep2 = makeEpisode({ episodeNumber: 2, filePath: "/s1/e02.mkv" });
    const result = dedupeEpisodes([ep3, ep1, ep2]);
    expect(result.map((e) => e.episodeNumber)).toEqual([1, 2, 3]);
  });

  it("skips episodes with null episode number", () => {
    const withNull = makeEpisode({ episodeNumber: null });
    const valid = makeEpisode({ episodeNumber: 1 });
    const result = dedupeEpisodes([withNull, valid]);
    expect(result).toHaveLength(1);
    expect(result[0].episodeNumber).toBe(1);
  });

  it("returns empty when all episodes have null episode numbers", () => {
    const ep = makeEpisode({ episodeNumber: null });
    expect(dedupeEpisodes([ep, ep])).toEqual([]);
  });
});
