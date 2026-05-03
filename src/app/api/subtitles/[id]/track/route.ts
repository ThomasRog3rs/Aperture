import { NextResponse } from "next/server";
import { getSubtitleById } from "@/lib/storage";
import { validateLibraryPath } from "@/lib/streaming";
import { convertToVtt } from "@/lib/subtitles";
import fs from "node:fs";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const subtitle = getSubtitleById(id);
  if (!subtitle) {
    return NextResponse.json({ error: "Subtitle not found." }, { status: 404 });
  }

  // Security: validate the file path is inside library root
  const validated = validateLibraryPath(subtitle.filePath);
  if (validated instanceof NextResponse) return validated;

  if (!fs.existsSync(subtitle.filePath)) {
    return NextResponse.json({ error: "Subtitle file not found on disk." }, { status: 404 });
  }

  try {
    const vttContent = convertToVtt(subtitle.filePath);
    return new NextResponse(vttContent, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to serve subtitle." },
      { status: 500 }
    );
  }
}
