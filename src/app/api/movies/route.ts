import { NextResponse } from "next/server";
import { listMovies } from "@/lib/storage";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? undefined;
  const genreParam = searchParams.get("genre")?.trim();
  const genre =
    genreParam && genreParam.toLowerCase() !== "all" ? genreParam : undefined;
  const minRatingParam = searchParams.get("minPersonalRating");
  const minPersonalRating =
    minRatingParam && !Number.isNaN(Number(minRatingParam))
      ? Number(minRatingParam)
      : undefined;
  const sortParam = searchParams.get("sort")?.trim() ?? "rating";
  const sort =
    sortParam === "rating" || sortParam === "recent" ? sortParam : "title";

  const rows = listMovies({ q, genre, minPersonalRating, sort });
  const movies = rows.map((row) => {
    const { genresJson, userGenresJson, ...rest } = row;
    const omdbGenres = parseGenres(genresJson);
    const userGenres = parseGenres(userGenresJson);
    const genres = mergeGenres(omdbGenres, userGenres);
    return { ...rest, genres, omdbGenres, userGenres };
  });

  return NextResponse.json({ movies });
}

