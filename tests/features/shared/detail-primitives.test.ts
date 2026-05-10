import { describe, expect, it } from "vitest";
import {
  buildTitlePosterEditUpdates,
  formatTimestamp,
  getPosterCandidate,
} from "@/features/shared/detail-primitives";

describe("detail shared primitives", () => {
  it("formats timestamps and handles nullable values", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp(0)).toBe("—");
    expect(typeof formatTimestamp(Date.now())).toBe("string");
  });

  it("selects poster candidate from input first", () => {
    expect(getPosterCandidate(" /next.jpg ", "/existing.jpg")).toBe("/next.jpg");
    expect(getPosterCandidate("   ", "/existing.jpg")).toBe("/existing.jpg");
    expect(getPosterCandidate("   ", null)).toBeNull();
  });

  it("builds title and poster updates", () => {
    expect(buildTitlePosterEditUpdates("Current", "/poster-a.jpg", "   ", "/poster-b.jpg")).toEqual(
      {
        error: "Title cannot be empty.",
        updates: {},
      }
    );

    expect(buildTitlePosterEditUpdates("Current", "/poster-a.jpg", "Updated", "   ")).toEqual({
      updates: {
        titleClean: "Updated",
        posterPath: null,
      },
    });
  });
});
