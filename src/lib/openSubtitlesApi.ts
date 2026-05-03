/**
 * OpenSubtitles REST API v1 client.
 * Base URL: https://api.opensubtitles.com/api/v1
 *
 * Required environment variable:
 *   OPENSUBTITLES_API_KEY — your OpenSubtitles REST API key
 *
 * Optional (enables higher download quotas on paid accounts):
 *   OPENSUBTITLES_USERNAME
 *   OPENSUBTITLES_PASSWORD
 */

import type { SubtitleSearchResult } from "@/lib/types";

const BASE_URL = "https://api.opensubtitles.com/api/v1";
const USER_AGENT = "Aperture v0.1";

// Module-level token cache (reset on server restart)
let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours (tokens expire in 24h)

export function isOpenSubtitlesConfigured(): boolean {
  return Boolean(process.env.OPENSUBTITLES_API_KEY?.trim());
}

function getApiKey(): string {
  const key = process.env.OPENSUBTITLES_API_KEY?.trim();
  if (!key) throw new Error("OPENSUBTITLES_API_KEY is not configured.");
  return key;
}

function buildHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Api-Key": getApiKey(),
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchToken(): Promise<string | null> {
  const username = process.env.OPENSUBTITLES_USERNAME?.trim();
  const password = process.env.OPENSUBTITLES_PASSWORD?.trim();
  if (!username || !password) return null;

  const response = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { token?: string };
  return data.token ?? null;
}

async function getToken(): Promise<string | null> {
  if (!process.env.OPENSUBTITLES_USERNAME?.trim()) return null;
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }
  try {
    cachedToken = await fetchToken();
    tokenFetchedAt = Date.now();
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

// ── Search ────────────────────────────────────────────────────────────────────

type SearchParams = {
  query?: string;
  imdbId?: string;
  type?: "movie" | "episode";
  seasonNumber?: number;
  episodeNumber?: number;
  languages?: string; // comma-separated ISO 639-1 codes, e.g. "en,fr"
};

// Raw shape from the OpenSubtitles API
type OsFile = {
  file_id: number;
  cd_number: number;
  file_name: string;
};

type OsSubtitleAttributes = {
  subtitle_id: string;
  language: string;
  download_count: number | null;
  new_download_count: number | null;
  hearing_impaired: boolean | null;
  hd: boolean | null;
  fps: number | null;
  votes: number | null;
  ratings: number | null;
  from_trusted: boolean | null;
  foreign_parts_only: boolean | null;
  upload_date: string | null;
  file_hashes: string[] | null;
  moviehash_match: boolean | null;
  release: string | null;
  comments: string | null;
  legacy_subtitle_id: number | null;
  uploader: { uploader_id: number | null; name: string | null; rank: string | null } | null;
  feature_details: Record<string, unknown> | null;
  url: string;
  related_links: unknown[];
  files: OsFile[];
};

type OsSubtitleItem = {
  id: string;
  type: string;
  attributes: OsSubtitleAttributes;
};

type OsSearchResponse = {
  total_count: number;
  total_pages: number;
  page: number;
  data: OsSubtitleItem[];
};

export async function searchSubtitles(
  params: SearchParams
): Promise<SubtitleSearchResult[]> {
  const token = await getToken();
  const qs = new URLSearchParams();

  if (params.query) qs.set("query", params.query);
  if (params.imdbId) qs.set("imdb_id", params.imdbId);
  if (params.type) qs.set("type", params.type);
  if (params.seasonNumber != null)
    qs.set("season_number", String(params.seasonNumber));
  if (params.episodeNumber != null)
    qs.set("episode_number", String(params.episodeNumber));
  qs.set("languages", params.languages ?? "en");

  const url = `${BASE_URL}/subtitles?${qs.toString()}`;
  const response = await fetch(url, {
    headers: buildHeaders(token),
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 429) {
    throw new Error("OpenSubtitles rate limit exceeded. Please try again later.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(body?.message ?? `OpenSubtitles search failed (${response.status})`);
  }

  const data = (await response.json()) as OsSearchResponse;

  const results: SubtitleSearchResult[] = [];
  for (const item of data.data ?? []) {
    const attrs = item.attributes;
    for (const file of attrs.files ?? []) {
      if (!file.file_id || !file.file_name) continue;
      const ext = file.file_name.split(".").pop()?.toLowerCase() ?? "srt";
      results.push({
        fileId: file.file_id,
        fileName: file.file_name,
        language: attrs.language ?? "und",
        format: ext,
        releaseName: attrs.release ?? null,
        downloadCount: attrs.download_count ?? null,
        rating: attrs.ratings ?? null,
      });
    }
  }

  return results;
}

// ── Download ──────────────────────────────────────────────────────────────────

type OsDownloadResponse = {
  link: string;
  file_name: string;
  requests: number;
  remaining: number;
  message: string;
  reset_time_utc: string;
};

export type DownloadLinkResult = {
  link: string;
  fileName: string;
  remaining: number;
};

export async function getSubtitleDownloadLink(
  fileId: number
): Promise<DownloadLinkResult> {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}/download`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({ file_id: fileId }),
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 429) {
    throw new Error("OpenSubtitles rate limit exceeded. Please try again later.");
  }
  if (response.status === 406) {
    throw new Error(
      "OpenSubtitles daily download quota exceeded. Please try again tomorrow."
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      body?.message ?? `OpenSubtitles download failed (${response.status})`
    );
  }

  const data = (await response.json()) as OsDownloadResponse;
  if (!data.link) throw new Error("OpenSubtitles returned no download link.");

  return {
    link: data.link,
    fileName: data.file_name,
    remaining: data.remaining ?? 0,
  };
}
