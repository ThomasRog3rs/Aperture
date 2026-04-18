import { NextResponse } from "next/server";
import { getMovieById, updateMovieSubtitlePreference } from "@/lib/storage";

export const runtime = "nodejs";

export async function PATCH(
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

  const body = (await request.json().catch(() => null)) as
    | { selectedSubtitleId?: string | null; enabled?: boolean }
    | null;

  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const selectedSubtitleId =
    body.selectedSubtitleId !== undefined ? body.selectedSubtitleId ?? null : null;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : false;

  updateMovieSubtitlePreference(id, selectedSubtitleId, enabled);

  return NextResponse.json({ ok: true });
}
