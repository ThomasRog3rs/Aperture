import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getMovieById } from "@/lib/storage";

export const runtime = "nodejs";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const PREFERRED_NAMES = ["poster", "cover", "folder", "front"];

function rankFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  const base = path.parse(lower).name;
  if (PREFERRED_NAMES.includes(base)) return 0;
  if (PREFERRED_NAMES.some((keyword) => lower.includes(keyword))) return 1;
  return 2;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const movie = getMovieById(id);
  if (!movie) {
    return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  }

  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(movie.folderPath, { withFileTypes: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to read movie folder." },
      { status: 500 }
    );
  }

  const images = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name && !name.startsWith("."))
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => {
      const rankDiff = rankFileName(a) - rankFileName(b);
      if (rankDiff !== 0) return rankDiff;
      return a.localeCompare(b);
    })
    .map((name) => ({
      name,
      url: `/api/movies/${id}/folder-image?name=${encodeURIComponent(name)}`,
    }));

  return NextResponse.json({ images });
}
