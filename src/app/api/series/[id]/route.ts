import { NextResponse } from "next/server";
import {
  getEpisodesBySeasonId,
  listSeriesFolderPaths,
  listSeasonsBySeriesFolderPath,
} from "@/lib/storage";
import { getSeriesId, getSeriesTitle } from "@/lib/series";
import type { Episode, Season, SeasonWithEpisodes, Series } from "@/lib/types";

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

function mapRowToSeason(row: ReturnType<typeof listSeasonsBySeriesFolderPath>[number]): Season {
  const { genresJson, userGenresJson, xxxRated, watched, ...rest } = row;
  const omdbGenres = parseGenres(genresJson);
  const userGenres = parseGenres(userGenresJson);
  const genres = mergeGenres(omdbGenres, userGenres);
  return {
    ...rest,
    seriesId: getSeriesId(rest.seriesFolderPath),
    genres,
    omdbGenres,
    userGenres,
    xxxRated: Boolean(xxxRated),
    watched: Boolean(watched),
  };
}

function mapEpisodes(rows: ReturnType<typeof getEpisodesBySeasonId>): Episode[] {
  return rows.map((row) => ({
    ...row,
  }));
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

function resolveSeriesFolderPath(seriesId: string): string | null {
  const folders = listSeriesFolderPaths();
  for (const folder of folders) {
    if (getSeriesId(folder) === seriesId) return folder;
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const seriesFolderPath = resolveSeriesFolderPath(id);
  if (!seriesFolderPath) {
    return NextResponse.json({ error: "Series not found." }, { status: 404 });
  }

  const seasonRows = listSeasonsBySeriesFolderPath(seriesFolderPath);
  const seasons = seasonRows.map((row) => mapRowToSeason(row));
  sortSeasons(seasons);

  const seasonsWithEpisodes: SeasonWithEpisodes[] = seasons.map((season) => {
    const episodes = mapEpisodes(getEpisodesBySeasonId(season.id));
    return {
      ...season,
      episodeCount: episodes.length,
      episodes,
    };
  });

  const { titleClean } = getSeriesTitle(seriesFolderPath);
  const series: Series = {
    id: getSeriesId(seriesFolderPath),
    titleClean,
    seasonCount: seasonsWithEpisodes.length,
    posterPath: pickSeriesPoster(seasonsWithEpisodes),
    seasons: seasonsWithEpisodes,
  };

  return NextResponse.json({ series, seasons: seasonsWithEpisodes });
}
