import { describe, expect, it } from "vitest";
import {
  buildMovieEditUpdates,
  dedupeGenres,
  formatTimestamp,
  getPosterCandidate,
  hasMissingBasicMovieInfo,
} from "@/features/movie-detail/domain";
import { createMovie } from "../../helpers/createMovie";

describe("movie-detail domain", () => {
  it("dedupes genres case-insensitively while preserving first spelling", () => {
    expect(dedupeGenres([" Drama ", "drama", "Sci-Fi", "", "sci-fi"])).toEqual([
      "Drama",
      "Sci-Fi",
    ]);
  });

  it("builds edit updates and reports empty title validation", () => {
    const movie = createMovie({ titleClean: "Current", posterPath: "/poster-a.jpg" });
    expect(buildMovieEditUpdates(movie, "   ", "/poster-b.jpg").error).toBe(
      "Title cannot be empty."
    );

    const result = buildMovieEditUpdates(movie, "Updated", "   ");
    expect(result.updates).toEqual({
      titleClean: "Updated",
      posterPath: null,
    });
  });

  it("computes poster candidate and missing-info flags", () => {
    const movie = createMovie({ posterPath: "/poster-a.jpg" });
    expect(getPosterCandidate(" /poster-b.jpg ", movie)).toBe("/poster-b.jpg");
    expect(getPosterCandidate("   ", movie)).toBe("/poster-a.jpg");
    expect(hasMissingBasicMovieInfo(createMovie({ runtimeMinutes: null }))).toBe(true);
    expect(hasMissingBasicMovieInfo(createMovie())).toBe(false);
  });

  it("formats timestamps and handles null", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp(0)).toBe("—");
    expect(typeof formatTimestamp(Date.now())).toBe("string");
  });
});
