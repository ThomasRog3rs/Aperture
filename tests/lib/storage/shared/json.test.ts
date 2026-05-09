import { describe, expect, it } from "vitest";

import {
  parseJsonStringList,
  parseUniqueNonEmptyJsonStringList,
  stringifyJsonList,
} from "@/lib/storage/shared/json";

describe("storage/shared/json", () => {
  it("returns empty lists for null or malformed JSON", () => {
    expect(parseJsonStringList(null)).toEqual([]);
    expect(parseJsonStringList("{ bad")).toEqual([]);
    expect(parseJsonStringList('{"a":1}')).toEqual([]);

    expect(parseUniqueNonEmptyJsonStringList("not-json")).toEqual([]);
    expect(parseUniqueNonEmptyJsonStringList('{"a":1}')).toEqual([]);
  });

  it("parses and stringifies list JSON without behavior changes", () => {
    expect(parseJsonStringList('["Drama","Action"]')).toEqual(["Drama", "Action"]);
    expect(parseUniqueNonEmptyJsonStringList('["ep-1", "ep-1", "", "  ", 1, "ep-2"]')).toEqual([
      "ep-1",
      "ep-2",
    ]);
    expect(stringifyJsonList(["one", "two"])).toBe('["one","two"]');
  });
});
