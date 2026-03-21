import fs from "node:fs";
import { NextResponse } from "next/server";
import { getEpisodeById } from "@/lib/storage";
import {
  validateLibraryPath,
  getVideoContentType,
  createStreamResponse,
} from "@/lib/streaming";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const episode = getEpisodeById(id);
  if (!episode) {
    return NextResponse.json(
      { error: "Episode not found." },
      { status: 404 }
    );
  }

  if (!episode.filePath) {
    return NextResponse.json(
      { error: "No file path for this episode." },
      { status: 404 }
    );
  }

  const contentType = getVideoContentType(episode.filePath);
  if (!contentType) {
    return NextResponse.json(
      { error: "Unsupported video format." },
      { status: 400 }
    );
  }

  const result = validateLibraryPath(episode.filePath);
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
