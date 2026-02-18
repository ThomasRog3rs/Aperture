import { NextResponse } from "next/server";
import { getEpisodeById, updateEpisode } from "@/lib/storage";
import type { Episode } from "@/lib/types";

export const runtime = "nodejs";

function mapRow(
  row: NonNullable<ReturnType<typeof getEpisodeById>>
): Episode {
  const { watched, ...rest } = row;
  return { ...rest, watched: Boolean(watched) };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const existing = getEpisodeById(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Episode not found." },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { watched?: boolean }
    | null;

  if (!body) {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const updates: { watched?: number } = {};

  if (body.watched !== undefined) {
    updates.watched = body.watched ? 1 : 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided." },
      { status: 400 }
    );
  }

  try {
    updateEpisode(id, updates);

    const episode = getEpisodeById(id);
    if (!episode) {
      return NextResponse.json(
        { error: "Episode not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ episode: mapRow(episode) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update episode.",
      },
      { status: 500 }
    );
  }
}
