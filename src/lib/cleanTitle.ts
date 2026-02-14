const TOKEN_REGEX =
  /\b(480p|720p|1080p|2160p|4k|8k|x264|x265|h264|h265|hevc|xvid|avc|hdr|uhd|sdr|10bit|8bit|bluray|brrip|bdrip|webrip|web-?dl|hdrip|dvdrip|remux|repack|proper|extended|uncut|remastered|unrated|limited|dubbed|subbed|multi|dual|pal|ntsc|version|us|uk)\b/gi;

const AUDIO_REGEX =
  /\b(ddp\d(?:\.\d)?|aac|dts(?:-?hd)?|truehd|atmos)\b/gi;

const GROUP_REGEX =
  /\b(yify|rarbg|tgx|galaxyrg|classi[c]?|bokutox)\b/gi;

const GROUP_WITH_NUMBERS_REGEX = /\b[A-Za-z]{2,12}RG\d+\b/g;

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2) {
        return word.toUpperCase();
      }
      return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

export function cleanTitle(raw: string): { titleClean: string; year: number | null } {
  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  let cleaned = raw;
  cleaned = cleaned.replace(/[\._]/g, " ");
  cleaned = cleaned.replace(/\[[^\]]*]/g, " ");
  cleaned = cleaned.replace(/\{[^}]*}/g, " ");
  cleaned = cleaned.replace(/\([^)]*\)/g, " ");
  cleaned = cleaned.replace(TOKEN_REGEX, " ");
  cleaned = cleaned.replace(AUDIO_REGEX, " ");
  cleaned = cleaned.replace(GROUP_REGEX, " ");
  cleaned = cleaned.replace(GROUP_WITH_NUMBERS_REGEX, " ");
  cleaned = cleaned.replace(/\b(19\d{2}|20\d{2})\b/g, " ");
  cleaned = cleaned.replace(/\s*-\s*[A-Za-z0-9]+$/g, " ");
  cleaned = cleaned.replace(/[^A-Za-z0-9\s:'-]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  const titleClean = cleaned.length > 0 ? toTitleCase(cleaned) : raw;

  return { titleClean, year };
}

