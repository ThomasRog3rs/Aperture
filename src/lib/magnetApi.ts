import type { MagnetApiRawResult, MagnetSearchResult } from "@/lib/types";

const DEFAULT_MAGNET_API_BASE_URL = "http://localhost:8000";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getMagnetApiBaseUrl() {
  const configured =
    process.env.MAGNET_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_MAGNET_API_BASE_URL?.trim() ||
    DEFAULT_MAGNET_API_BASE_URL;

  return trimTrailingSlash(configured);
}

export function buildPirateBayVideoSearchUrl(query: string) {
  const encodedQuery = encodeURIComponent(query.trim());
  return `${getMagnetApiBaseUrl()}/pirate-bay/${encodedQuery}/video`;
}

function normalizeField(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "na") return null;
  return trimmed;
}

export function normalizeMagnetResult(
  result: MagnetApiRawResult
): MagnetSearchResult | null {
  const name = normalizeField(result.name);
  const magnet = normalizeField(result.magnet);

  if (!name || !magnet) {
    return null;
  }

  return {
    name,
    magnet,
    seeders: normalizeField(result.Seeders),
    leechers: normalizeField(result.Leechers),
    size: normalizeField(result.Size),
    date: normalizeField(result.Date),
    category: normalizeField(result.otherDetails?.category),
    uploader: normalizeField(result.otherDetails?.uploader),
    source: "pirate-bay",
  };
}
