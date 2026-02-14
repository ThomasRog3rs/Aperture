import { NextResponse } from "next/server";
import { listMovies } from "@/lib/storage";

export const runtime = "nodejs";

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
  const sortParam = searchParams.get("sort")?.trim() ?? "title";
  const sort =
    sortParam === "rating" || sortParam === "recent" ? sortParam : "title";

  const rows = listMovies({ q, genre, minPersonalRating, sort });
  const movies = rows.map((row) => {
    const { genresJson, ...rest } = row;
    const genres = (() => {
      try {
        const parsed = JSON.parse(genresJson) as string[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    return { ...rest, genres };
  });

  return NextResponse.json({ movies });
}

