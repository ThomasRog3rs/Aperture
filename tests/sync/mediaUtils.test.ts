import { describe, it, expect } from "vitest";
import {
  generateMediaId,
  shouldKeepPoster,
  resolveTitle,
  parseJsonArray,
} from "@/lib/sync/mediaUtils";

describe("generateMediaId", () => {
  it("returns a 40-character hex sha1 string", () => {
    const id = generateMediaId("/movies/Inception (2010)");
    expect(id).toMatch(/^[0-9a-f]{40}$/);
  });

  it("returns the same id for the same path", () => {
    const path = "/movies/The Matrix (1999)";
    expect(generateMediaId(path)).toBe(generateMediaId(path));
  });

  it("returns different ids for different paths", () => {
    expect(generateMediaId("/movies/A")).not.toBe(generateMediaId("/movies/B"));
  });
});

describe("shouldKeepPoster", () => {
  it("returns true for https:// posters", () => {
    expect(shouldKeepPoster("https://example.com/poster.jpg")).toBe(true);
  });

  it("returns true for http:// posters", () => {
    expect(shouldKeepPoster("http://example.com/poster.jpg")).toBe(true);
  });

  it("returns true for /api/ posters", () => {
    expect(shouldKeepPoster("/api/poster/abc123")).toBe(true);
  });

  it("returns false for null", () => {
    expect(shouldKeepPoster(null)).toBe(false);
  });

  it("returns false for a local file path", () => {
    expect(shouldKeepPoster("/tmp/poster.jpg")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(shouldKeepPoster("")).toBe(false);
  });
});

describe("resolveTitle", () => {
  it("uses derived title when there is no existing record", () => {
    const result = resolveTitle(null, "Inception", "Inception (2010)");
    expect(result).toEqual({ titleClean: "Inception", titleRaw: "Inception (2010)" });
  });

  it("uses derived title when titleEditedAt is null", () => {
    const existing = { titleClean: "Old Name", titleRaw: "Old Raw", titleEditedAt: null };
    const result = resolveTitle(existing, "New Name", "New Raw");
    expect(result).toEqual({ titleClean: "New Name", titleRaw: "New Raw" });
  });

  it("preserves edited title when titleEditedAt is set", () => {
    const existing = {
      titleClean: "Edited Name",
      titleRaw: "Edited Raw",
      titleEditedAt: 1700000000000,
    };
    const result = resolveTitle(existing, "Derived Name", "Raw Fallback");
    expect(result).toEqual({ titleClean: "Edited Name", titleRaw: "Edited Raw" });
  });

  it("falls back to derived values when edited record has no title fields", () => {
    const existing = { titleClean: undefined, titleRaw: undefined, titleEditedAt: 1700000000000 };
    const result = resolveTitle(existing, "Derived", "Raw");
    expect(result).toEqual({ titleClean: "Derived", titleRaw: "Raw" });
  });
});

describe("parseJsonArray", () => {
  it("parses a valid JSON string array", () => {
    expect(parseJsonArray('["Action","Drama"]')).toEqual(["Action", "Drama"]);
  });

  it("returns empty array for null", () => {
    expect(parseJsonArray(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(parseJsonArray(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseJsonArray("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseJsonArray("not json")).toEqual([]);
  });

  it("returns empty array when JSON is not an array", () => {
    expect(parseJsonArray('{"key":"value"}')).toEqual([]);
  });
});
