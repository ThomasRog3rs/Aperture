import { NextResponse } from "next/server";
import { resolveOmdbMovie } from "@/lib/omdb";
import { getMovieById, updateMovie } from "@/lib/storage";
import type { Movie } from "@/lib/types";

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

function mapRowToMovie(row: ReturnType<typeof getMovieById>): Movie | null {
  if (!row) return null;
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
    genres,
    omdbGenres,
    directors,
    writers,
    actors,
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

  const existing = getMovieById(id);
  if (!existing) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  const title = existing.titleClean || existing.titleRaw;
  let omdbMovie = null;
  try {
    omdbMovie = await resolveOmdbMovie(title, existing.year);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "OMDb lookup failed.",
      },
      { status: 500 }
    );
  }
  if (!omdbMovie) {
    return NextResponse.json(
      { error: "Movie not found in OMDb." },
      { status: 404 }
    );
  }

  const updates: Parameters<typeof updateMovie>[1] = {
    tmdbId: omdbMovie.providerId ?? existing.tmdbId ?? null,
    posterPath: omdbMovie.posterPath ?? undefined,
    runtimeMinutes: omdbMovie.runtimeMinutes ?? null,
    tmdbRating: omdbMovie.tmdbRating ?? null,
    genresJson: JSON.stringify(omdbMovie.genres ?? []),
    directorsJson: JSON.stringify(omdbMovie.directors ?? []),
    writersJson: JSON.stringify(omdbMovie.writers ?? []),
    actorsJson: JSON.stringify(omdbMovie.actors ?? []),
    errorMessage: null,
    lastSyncedAt: Date.now(),
  };
  updateMovie(id, updates);

  const movie = mapRowToMovie(getMovieById(id));
  if (!movie) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  return NextResponse.json({ movie });
}
