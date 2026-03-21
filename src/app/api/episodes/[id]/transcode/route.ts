import { NextResponse } from "next/server";
import { getEpisodeById } from "@/lib/storage";
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

  const episode = getEpisodeById(id);
  if (!episode) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }

  if (!episode.filePath) {
    return NextResponse.json({ error: "No file path for this episode." }, { status: 404 });
  }

  const result = validateLibraryPath(episode.filePath);
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
