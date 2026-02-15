import { NextResponse } from "next/server";
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
  const { genresJson, userGenresJson, ...rest } = row;
  const omdbGenres = parseGenres(genresJson);
  const userGenres = parseGenres(userGenresJson);
  const genres = mergeGenres(omdbGenres, userGenres);
  return { ...rest, genres, omdbGenres, userGenres };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const movie = mapRowToMovie(getMovieById(id));
  if (!movie) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  return NextResponse.json({ movie });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        titleClean?: string;
        titleRaw?: string;
        posterPath?: string | null;
        userGenres?: string[];
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const updates: {
    titleClean?: string;
    titleRaw?: string;
    posterPath?: string | null;
    titleEditedAt?: number;
    userGenresJson?: string;
  } = {};

  if (body.titleClean !== undefined) {
    if (typeof body.titleClean !== "string" || !body.titleClean.trim()) {
      return NextResponse.json(
        { error: "titleClean must be a non-empty string." },
        { status: 400 }
      );
    }
    updates.titleClean = body.titleClean.trim();
  }

  if (body.titleRaw !== undefined) {
    if (typeof body.titleRaw !== "string" || !body.titleRaw.trim()) {
      return NextResponse.json(
        { error: "titleRaw must be a non-empty string." },
        { status: 400 }
      );
    }
    updates.titleRaw = body.titleRaw.trim();
  }

  if (body.posterPath !== undefined) {
    if (body.posterPath === null) {
      updates.posterPath = null;
    } else if (typeof body.posterPath === "string") {
      updates.posterPath = body.posterPath.trim() || null;
    } else {
      return NextResponse.json(
        { error: "posterPath must be a string or null." },
        { status: 400 }
      );
    }
  }

  if (body.userGenres !== undefined) {
    if (!Array.isArray(body.userGenres)) {
      return NextResponse.json(
        { error: "userGenres must be an array of strings." },
        { status: 400 }
      );
    }
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const entry of body.userGenres) {
      if (typeof entry !== "string") {
        return NextResponse.json(
          { error: "userGenres must be an array of strings." },
          { status: 400 }
        );
      }
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(trimmed);
    }
    updates.userGenresJson = JSON.stringify(normalized);
  }

  if (updates.titleClean || updates.titleRaw) {
    updates.titleEditedAt = Date.now();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided." },
      { status: 400 }
    );
  }

  updateMovie(id, updates);

  const movie = mapRowToMovie(getMovieById(id));
  if (!movie) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  return NextResponse.json({ movie });
}
