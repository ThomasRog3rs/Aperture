import { NextResponse } from "next/server";
import { getEpisodeById, getSeasonById } from "@/lib/storage";
import { isOpenSubtitlesConfigured, searchSubtitles } from "@/lib/openSubtitlesApi";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (!isOpenSubtitlesConfigured()) {
    return NextResponse.json(
      { error: "OpenSubtitles is not configured. Add OPENSUBTITLES_API_KEY to your .env file." },
      { status: 503 }
    );
  }

  const episode = getEpisodeById(id);
  if (!episode) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }

  const season = getSeasonById(episode.seasonId);

  const body = (await request.json().catch(() => null)) as
    | { query?: string; language?: string }
    | null;

  const query = body?.query?.trim() || episode.titleClean || episode.titleRaw;
  const language = body?.language?.trim() || "en";

  try {
    const results = await searchSubtitles({
      query,
      type: "episode",
      seasonNumber: season?.seasonNumber ?? undefined,
      episodeNumber: episode.episodeNumber ?? undefined,
      languages: language,
    });
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 }
    );
  }
}
