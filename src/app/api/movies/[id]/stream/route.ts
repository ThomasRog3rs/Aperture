import fs from "node:fs";
import { NextResponse } from "next/server";
import { getMovieById } from "@/lib/storage";
import {
  validateLibraryPath,
  getVideoContentType,
  createStreamResponse,
} from "@/lib/streaming";
import { getTranscodedPath } from "@/lib/transcoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
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

  if (!movie.filePath) {
    return NextResponse.json(
      { error: "No file path for this movie." },
      { status: 404 }
    );
  }

  // Prefer transcoded file if available
  const transcodedPath = getTranscodedPath(id);
  if (transcodedPath) {
    const rangeHeader = request.headers.get("range");
    return createStreamResponse(transcodedPath, rangeHeader);
  }

  const contentType = getVideoContentType(movie.filePath);
  if (!contentType) {
    return NextResponse.json(
      { error: "Unsupported video format." },
      { status: 400 }
    );
  }

  const result = validateLibraryPath(movie.filePath);
  if (result instanceof NextResponse) {
    return result;
  }
  const resolvedFile = result;

  if (!fs.existsSync(resolvedFile)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  return createStreamResponse(resolvedFile, rangeHeader);
}
