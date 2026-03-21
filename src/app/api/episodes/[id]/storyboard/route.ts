import fs from "node:fs";
import { NextResponse } from "next/server";
import { getStoryboardPaths } from "@/lib/storyboards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const paths = getStoryboardPaths(id);
  if (!paths) {
    return NextResponse.json({ error: "Storyboard not generated." }, { status: 404 });
  }

  const buffer = fs.readFileSync(paths.imagePath);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
