import { NextResponse } from "next/server";
import {
  deleteSeriesRandomSession,
  getEpisodesBySeasonId,
  getSeriesFolderPathById,
  getSeriesRandomSession,
  listSeasonsBySeriesFolderPath,
  markSeriesRandomSessionEpisodeStarted,
  replaceSeriesRandomSession,
} from "@/lib/storage";
import type { Episode } from "@/lib/types";

export const runtime = "nodejs";

type RandomSessionSummary = {
  seriesId: string;
  startedEpisodeIds: string[];
  currentEpisodeId: string | null;
  startedEpisodeCount: number;
  createdAt: number;
  updatedAt: number;
  totalEpisodeCount: number;
  remainingEpisodeCount: number;
  unwatchedRemainingEpisodeCount: number;
  watchedRemainingEpisodeCount: number;
  exhausted: boolean;
};

type RandomSessionAction =
  | { action: "start_new" | "continue" | "next_random" }
  | { action: "mark_started"; episodeId?: string };

function mapEpisodeRow(
  row: ReturnType<typeof getEpisodesBySeasonId>[number]
): Episode {
  const { watched, subtitlesEnabled, ...rest } = row;
  return {
    ...rest,
    watched: Boolean(watched),
    subtitlesEnabled: Boolean(subtitlesEnabled),
  };
}

function getSeriesEpisodes(seriesId: string): Episode[] | null {
  const seriesFolderPath = getSeriesFolderPathById(seriesId);
  if (!seriesFolderPath) return null;
  const seasons = listSeasonsBySeriesFolderPath(seriesFolderPath);
  return seasons.flatMap((season) =>
    getEpisodesBySeasonId(season.id).map((episode) => mapEpisodeRow(episode))
  );
}

function buildSessionSummary(
  seriesId: string,
  episodes: Episode[],
  session = getSeriesRandomSession(seriesId)
): RandomSessionSummary | null {
  if (!session) return null;

  const startedEpisodeIds = session.startedEpisodeIds;
  const startedIds = new Set(startedEpisodeIds);
  const remainingEpisodes = episodes.filter((episode) => !startedIds.has(episode.id));
  const unwatchedRemainingEpisodeCount = remainingEpisodes.filter(
    (episode) => !episode.watched
  ).length;
  const watchedRemainingEpisodeCount =
    remainingEpisodes.length - unwatchedRemainingEpisodeCount;

  return {
    seriesId: session.seriesId,
    startedEpisodeIds,
    currentEpisodeId: session.currentEpisodeId,
    startedEpisodeCount: startedEpisodeIds.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    totalEpisodeCount: episodes.length,
    remainingEpisodeCount: remainingEpisodes.length,
    unwatchedRemainingEpisodeCount,
    watchedRemainingEpisodeCount,
    exhausted: remainingEpisodes.length === 0,
  };
}

function chooseWeightedRandomEpisode(episodes: Episode[]): Episode | null {
  if (episodes.length === 0) return null;
  if (episodes.length === 1) return episodes[0];

  const totalWeight = episodes.reduce(
    (sum, episode) => sum + (episode.watched ? 1 : 4),
    0
  );
  let target = Math.random() * totalWeight;
  for (const episode of episodes) {
    target -= episode.watched ? 1 : 4;
    if (target <= 0) {
      return episode;
    }
  }

  return episodes[episodes.length - 1];
}

function selectAndStartEpisode(seriesId: string, episodes: Episode[]) {
  const session = getSeriesRandomSession(seriesId);
  if (!session) {
    return NextResponse.json(
      { error: "Random session not found." },
      { status: 409 }
    );
  }

  const startedIds = new Set(session.startedEpisodeIds);
  const candidates = episodes.filter((episode) => !startedIds.has(episode.id));
  const selectedEpisode = chooseWeightedRandomEpisode(candidates);

  if (!selectedEpisode) {
    return NextResponse.json({
      session: buildSessionSummary(seriesId, episodes, session),
      episode: null,
      exhausted: true,
    });
  }

  const updatedSession = markSeriesRandomSessionEpisodeStarted(
    seriesId,
    selectedEpisode.id
  );

  return NextResponse.json({
    session: buildSessionSummary(seriesId, episodes, updatedSession),
    episode: selectedEpisode,
    exhausted: false,
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const episodes = getSeriesEpisodes(id);
  if (!episodes) {
    return NextResponse.json({ error: "Series not found." }, { status: 404 });
  }

  return NextResponse.json({
    session: buildSessionSummary(id, episodes),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const episodes = getSeriesEpisodes(id);
  if (!episodes) {
    return NextResponse.json({ error: "Series not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as RandomSessionAction | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  switch (body.action) {
    case "start_new":
      replaceSeriesRandomSession(id, []);
      return selectAndStartEpisode(id, episodes);
    case "continue": {
      const session = getSeriesRandomSession(id);
      if (!session) {
        return NextResponse.json(
          { error: "Random session not found." },
          { status: 409 }
        );
      }

      const currentEpisode = session.currentEpisodeId
        ? episodes.find((episode) => episode.id === session.currentEpisodeId) ?? null
        : null;
      if (currentEpisode) {
        return NextResponse.json(
          {
            session: buildSessionSummary(id, episodes, session),
            episode: currentEpisode,
            exhausted: false,
          }
        );
      }

      return selectAndStartEpisode(id, episodes);
    }
    case "next_random":
      if (!getSeriesRandomSession(id)) {
        return NextResponse.json(
          { error: "Random session not found." },
          { status: 409 }
        );
      }
      return selectAndStartEpisode(id, episodes);
    case "mark_started": {
      if (typeof body.episodeId !== "string" || !body.episodeId.trim()) {
        return NextResponse.json(
          { error: "episodeId is required." },
          { status: 400 }
        );
      }

      const episode = episodes.find((entry) => entry.id === body.episodeId);
      if (!episode) {
        return NextResponse.json(
          { error: "Episode not found in this series." },
          { status: 404 }
        );
      }

      const session = markSeriesRandomSessionEpisodeStarted(id, body.episodeId);
      return NextResponse.json({
        session: buildSessionSummary(id, episodes, session),
      });
    }
    default:
      return NextResponse.json(
        { error: "Unsupported random session action." },
        { status: 400 }
      );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const episodes = getSeriesEpisodes(id);
  if (!episodes) {
    return NextResponse.json({ error: "Series not found." }, { status: 404 });
  }

  deleteSeriesRandomSession(id);
  return NextResponse.json({ ok: true });
}
