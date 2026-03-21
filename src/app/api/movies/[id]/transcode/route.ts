import { NextResponse } from "next/server";
import { getMovieById } from "@/lib/storage";
import { validateLibraryPath } from "@/lib/streaming";
import { transcodeToH264, isDirectPlayCompatible } from "@/lib/transcoding";

export const dynamic = "force-dynamic";

export async function POST(
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

  if (!movie.filePath) {
    return NextResponse.json({ error: "No file path for this movie." }, { status: 404 });
  }

  const result = validateLibraryPath(movie.filePath);
  if (result instanceof NextResponse) return result;

  const compatible = await isDirectPlayCompatible(result);
  if (compatible) {
    return NextResponse.json({ status: "direct_play", message: "File is already browser-compatible." });
  }

  try {
    const jobId = await transcodeToH264(id, result);
    return NextResponse.json({ jobId, status: "started" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcode failed." },
      { status: 500 }
    );
  }
}
