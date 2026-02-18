import path from "node:path";
import { NextResponse } from "next/server";
import { cleanTitle } from "@/lib/cleanTitle";
import { resolveOmdbSeries } from "@/lib/omdb";
import {
  getSeriesByFolderPath,
  getSeriesFolderPathById,
  updateSeries,
  upsertSeries,
} from "@/lib/storage";
import { getSeriesId, getSeriesTitle } from "@/lib/series";
import type { Series } from "@/lib/types";

export const runtime = "nodejs";

function mapSeriesRow(row: ReturnType<typeof getSeriesByFolderPath>): Series | null {
  if (!row) return null;
  return {
    id: row.id,
    titleClean: row.titleClean,
    seasonCount: 0,
    posterPath: row.posterPath,
    seasons: [],
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

  const seriesFolderPath = getSeriesFolderPathById(id);
  if (!seriesFolderPath) {
    return NextResponse.json({ error: "Series not found." }, { status: 404 });
  }

  let existing = getSeriesByFolderPath(seriesFolderPath);
  const seriesTitleRaw = path.basename(seriesFolderPath);
  const derived = cleanTitle(seriesTitleRaw);
  const seriesTitleClean = existing?.titleClean ?? derived.titleClean;
  const year = existing?.year ?? derived.year;
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

  if (!existing) {
    const derived = getSeriesTitle(seriesFolderPath);
    upsertSeries({
      id: getSeriesId(seriesFolderPath),
      seriesFolderPath,
      titleClean: derived.titleClean,
      titleEditedAt: null,
      year: derived.year,
      tmdbId: null,
      posterPath: null,
      tmdbRating: null,
      genres: [],
      userGenres: [],
      errorMessage: null,
      lastSyncedAt: Date.now(),
    });
    existing = getSeriesByFolderPath(seriesFolderPath);
  }

  updateSeries(id, {
    tmdbId: omdbSeries.providerId ?? existing?.tmdbId ?? null,
    posterPath: omdbSeries.posterPath ?? undefined,
    tmdbRating: omdbSeries.tmdbRating ?? null,
    genresJson: JSON.stringify(omdbSeries.genres ?? []),
    errorMessage: null,
    lastSyncedAt: Date.now(),
  });

  const series = mapSeriesRow(getSeriesByFolderPath(seriesFolderPath));
  if (!series) {
    return NextResponse.json({ error: "Series not found." }, { status: 404 });
  }

  return NextResponse.json({ series });
}
