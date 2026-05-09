import { describe, expect, it } from "vitest";

import { buildUpdateByIdSql } from "@/lib/storage/shared/updateBuilder";

describe("storage/shared/updateBuilder", () => {
  it("filters out undefined update entries", () => {
    const result = buildUpdateByIdSql("movies", "movie-1", {
      watched: 1,
      titleClean: undefined,
      personalRating: null,
    });

    expect(result).toEqual({
      sql: "UPDATE movies SET watched = @watched, personalRating = @personalRating WHERE id = @id",
      params: {
        id: "movie-1",
        watched: 1,
        personalRating: null,
      },
    });
  });

  it("returns null when there are no defined updates", () => {
    expect(
      buildUpdateByIdSql("episodes", "episode-1", {
        watched: undefined,
        subtitlesEnabled: undefined,
      })
    ).toBeNull();
  });
});
