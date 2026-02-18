import path from "node:path";
import { NextResponse } from "next/server";
import { cleanTitle } from "@/lib/cleanTitle";
import { resolveOmdbSeries } from "@/lib/omdb";
import { getSeasonById, updateSeason } from "@/lib/storage";
import { getSeriesId } from "@/lib/series";
import type { Season } from "@/lib/types";

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

function mapRowToSeason(row: ReturnType<typeof getSeasonById>): Season | null {
  if (!row) return null;
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

export async function POST(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const existing = getSeasonById(id);
  if (!existing) {
    return NextResponse.json({ error: "Season not found." }, { status: 404 });
  }

  const seriesTitleRaw = path.basename(existing.seriesFolderPath);
  const { titleClean: seriesTitleClean, year } = cleanTitle(seriesTitleRaw);
  let omdbSeries = null;
  try {
    omdbSeries = await resolveOmdbSeries(seriesTitleClean, year);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "OMDb lookup failed.",
      },
      { status: 500 }
    );
  }
  if (!omdbSeries) {
    return NextResponse.json(
      { error: "Series not found in OMDb." },
      { status: 404 }
    );
  }

  const updates: Parameters<typeof updateSeason>[1] = {
    tmdbId: omdbSeries.providerId ?? existing.tmdbId ?? null,
    posterPath: omdbSeries.posterPath ?? undefined,
    tmdbRating: omdbSeries.tmdbRating ?? null,
    genresJson: JSON.stringify(omdbSeries.genres ?? []),
    errorMessage: null,
    lastSyncedAt: Date.now(),
  };
  updateSeason(id, updates);

  const season = mapRowToSeason(getSeasonById(id));
  if (!season) {
    return NextResponse.json({ error: "Season not found." }, { status: 404 });
  }

  return NextResponse.json({ season });
}
