import { NextResponse } from "next/server";
import {
  getEpisodeCountsBySeasonIds,
  getSeriesByFolderPath,
  listSeasons,
} from "@/lib/storage";
import { getSeriesId, getSeriesTitle } from "@/lib/series";
import type { Season, Series } from "@/lib/types";

export const runtime = "nodejs";

function parseGenres(genresJson: string | null) {
  if (!genresJson) return [];
  try {
    const parsed = JSON.parse(genresJson) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePeople(peopleJson: string | null) {
  if (!peopleJson) return [];
  try {
    const parsed = JSON.parse(peopleJson) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeGenres(omdbGenres: string[], userGenres: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const genre of [...omdbGenres, ...userGenres]) {
    const trimmed = genre.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }
  return merged;
}

function mapRowToSeason(
  row: ReturnType<typeof listSeasons>[number],
  episodeCount: number
): Season {
  const {
    genresJson,
    userGenresJson,
    directorsJson,
    writersJson,
    actorsJson,
    xxxRated,
    watched,
    ...rest
  } = row;
  const omdbGenres = parseGenres(genresJson);
  const userGenres = parseGenres(userGenresJson);
  const genres = mergeGenres(omdbGenres, userGenres);
  const directors = parsePeople(directorsJson);
  const writers = parsePeople(writersJson);
  const actors = parsePeople(actorsJson);
  return {
    ...rest,
    seriesId: getSeriesId(rest.seriesFolderPath),
    genres,
    omdbGenres,
    directors,
    writers,
    actors,
    userGenres,
    xxxRated: Boolean(xxxRated),
    watched: Boolean(watched),
    episodeCount,
  };
}

function sortSeasons(seasons: Season[]) {
  seasons.sort((a, b) => {
    const aNumber = a.seasonNumber ?? Number.POSITIVE_INFINITY;
    const bNumber = b.seasonNumber ?? Number.POSITIVE_INFINITY;
    if (aNumber !== bNumber) return aNumber - bNumber;
    return a.titleClean.localeCompare(b.titleClean);
  });
}

function pickSeriesPoster(seasons: Season[]): string | null {
  const withPoster = seasons.filter((season) => season.posterPath);
  if (withPoster.length === 0) return null;
  const sorted = [...withPoster];
  sortSeasons(sorted);
  return sorted[0].posterPath ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? undefined;
  const genreParam = searchParams.get("genre")?.trim();
  const genre =
    genreParam && genreParam.toLowerCase() !== "all" ? genreParam : undefined;
  const personParam = searchParams.get("person")?.trim();
  const person = personParam ? personParam : undefined;
  const minRatingParam = searchParams.get("minPersonalRating");
  const minPersonalRating =
    minRatingParam && !Number.isNaN(Number(minRatingParam))
      ? Number(minRatingParam)
      : undefined;
  const sortParam = searchParams.get("sort")?.trim() ?? "rating";
  const sort =
    sortParam === "rating" || sortParam === "recent" ? sortParam : "title";
  const watchedParam = searchParams.get("watched")?.trim()?.toLowerCase();
  const watched =
    watchedParam === "watched" || watchedParam === "unwatched"
      ? watchedParam
      : "all";

  const rows = listSeasons({ q, genre, person, minPersonalRating, watched, sort });
  const counts = getEpisodeCountsBySeasonIds(rows.map((row) => row.id));
  const seasons = rows.map((row) =>
    mapRowToSeason(row, counts.get(row.id) ?? 0)
  );

  const grouped = new Map<string, Season[]>();
  for (const season of seasons) {
    const existing = grouped.get(season.seriesFolderPath);
    if (existing) {
      existing.push(season);
    } else {
      grouped.set(season.seriesFolderPath, [season]);
    }
  }

  const series: Series[] = [];
  for (const [seriesFolderPath, seriesSeasons] of grouped.entries()) {
    sortSeasons(seriesSeasons);
    const seriesRow = getSeriesByFolderPath(seriesFolderPath);
    const { titleClean } = seriesRow
      ? { titleClean: seriesRow.titleClean }
      : getSeriesTitle(seriesFolderPath);
    series.push({
      id: getSeriesId(seriesFolderPath),
      titleClean,
      seasonCount: seriesSeasons.length,
      posterPath: seriesRow?.posterPath ?? pickSeriesPoster(seriesSeasons),
      seasons: seriesSeasons,
    });
  }

  series.sort((a, b) => a.titleClean.localeCompare(b.titleClean));

  return NextResponse.json({ series });
}
