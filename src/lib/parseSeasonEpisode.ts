import path from "node:path";
import { cleanTitle } from "@/lib/cleanTitle";

const SEASON_FOLDER_REGEXES = [
  /season[\s._-]*(\d{1,2})/i,
  /series[\s._-]*(\d{1,2})/i,
  /\bS(\d{1,2})\b/i,
  /^(\d{1,2})$/,
];

const EPISODE_REGEXES = [
  /[sS](\d{1,2})[ ._-]*[eE](\d{1,2})/,
  /(\d{1,2})x(\d{1,2})/i,
  /[eE](\d{1,2})/,
  /(?:^|[._\s-])(\d{3,4})(?:$|[._\s-])/,
];

function normalizeNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSeasonNumberFromFolder(folderName: string): number | null {
  const trimmed = folderName.trim();
  for (const regex of SEASON_FOLDER_REGEXES) {
    const match = trimmed.match(regex);
    if (!match) continue;
    const parsed = normalizeNumber(match[1]);
    if (parsed === null) continue;
    return parsed;
  }
  return null;
}

function stripEpisodeTokens(raw: string) {
  return raw
    .replace(/[sS]\d{1,2}[ ._-]*[eE]\d{1,2}/g, " ")
    .replace(/\d{1,2}x\d{1,2}/gi, " ")
    .replace(/\b[Ee]\d{1,2}\b/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ParsedEpisode = {
  seasonNumber: number | null;
  episodeNumber: number | null;
  titleClean: string | null;
};

export function parseEpisodeFromFilename(
  fileName: string,
  fallbackSeasonNumber?: number | null
): ParsedEpisode {
  const baseName = path.parse(fileName).name;
  let seasonNumber: number | null = null;
  let episodeNumber: number | null = null;
  let matchedToken: string | null = null;

  for (const regex of EPISODE_REGEXES) {
    const match = baseName.match(regex);
    if (!match) continue;
    matchedToken = match[0];

    if (regex === EPISODE_REGEXES[0] || regex === EPISODE_REGEXES[1]) {
      seasonNumber = normalizeNumber(match[1]);
      episodeNumber = normalizeNumber(match[2]);
    } else if (regex === EPISODE_REGEXES[2]) {
      seasonNumber = fallbackSeasonNumber ?? null;
      episodeNumber = normalizeNumber(match[1]);
    } else if (regex === EPISODE_REGEXES[3]) {
      const digits = match[1];
      if (digits.length === 3) {
        seasonNumber = normalizeNumber(digits[0]);
        episodeNumber = normalizeNumber(digits.slice(1));
      } else if (digits.length === 4) {
        seasonNumber = normalizeNumber(digits.slice(0, 2));
        episodeNumber = normalizeNumber(digits.slice(2));
      }
    }
    break;
  }

  if (seasonNumber === null) {
    seasonNumber = fallbackSeasonNumber ?? null;
  }

  let titleSource = baseName;
  if (matchedToken) {
    titleSource = titleSource.replace(matchedToken, " ");
  }
  titleSource = stripEpisodeTokens(titleSource);
  const cleaned = titleSource ? cleanTitle(titleSource).titleClean : "";

  return {
    seasonNumber,
    episodeNumber,
    titleClean: cleaned || null,
  };
}
