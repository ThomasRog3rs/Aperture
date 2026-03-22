import { NextResponse } from "next/server";
import { listDeletedMovies, listDeletedSeasons } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const movies = listDeletedMovies();
  const seasons = listDeletedSeasons();
  return NextResponse.json({ movies, seasons });
}
