"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Play, Video } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";
import { formatRating, tmdbImageUrl } from "@/lib/format";
import type { Episode, Season } from "@/lib/types";

type SeasonResponse = {
  season: Season;
  episodes: Episode[];
  error?: string;
};

export default function SeasonDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const seasonId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [season, setSeason] = useState<Season | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const fetchSeason = useCallback(async () => {
    if (!seasonId) {
      setNotice({ tone: "error", message: "Missing season id in URL." });
      setSeason(null);
      setEpisodes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/series/${seasonId}`);
      const data = (await response.json()) as SeasonResponse;
      if (!response.ok || !data.season) {
        throw new Error(data.error || "Season not found.");
      }
      setSeason(data.season);
      setEpisodes(data.episodes ?? []);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to load season.",
      });
      setSeason(null);
      setEpisodes([]);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    fetchSeason();
  }, [fetchSeason]);

  const handlePlay = useCallback(async (episode: Episode) => {
    if (!episode.filePath) {
      setNotice({ tone: "error", message: "File path missing for this episode." });
      return;
    }
    setPlaying(episode.id);
    setNotice(null);
    try {
      const response = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: episode.filePath }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to launch player.");
      }
      setNotice({
        tone: "success",
        message: `Playing ${episode.titleClean || episode.titleRaw}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to launch player.",
      });
    } finally {
      setPlaying(null);
    }
  }, []);

  const posterUrl = season ? tmdbImageUrl(season.posterPath, "w780") : null;
  const subtitle = useMemo(() => {
    if (!season) return "";
    if (season.seasonNumber) {
      return `Season ${season.seasonNumber}`;
    }
    return "Season";
  }, [season]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-6 py-5 2xl:max-w-screen-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground 2xl:py-2 2xl:text-base"
          >
            <ArrowLeft className="h-4 w-4 2xl:h-5 2xl:w-5" />
            Back to library
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-faint 2xl:text-sm">
              Season details
            </p>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground 2xl:text-4xl">
              {season?.titleClean ?? "Loading..."}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 2xl:max-w-screen-2xl">
        {notice ? <StatusBanner tone={notice.tone} message={notice.message} /> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted 2xl:text-base">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Loading season...
          </div>
        ) : null}

        {!loading && !season ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center 2xl:p-16">
            <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
              Season not found
            </p>
            <p className="text-sm text-muted 2xl:text-base">
              The season you are looking for could not be loaded.
            </p>
            <Link
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground 2xl:py-2 2xl:text-base"
            >
              Return to library
            </Link>
          </div>
        ) : null}

        {!loading && season ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="flex flex-col gap-4">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-border bg-surface">
                {posterUrl ? (
                  <Image
                    src={posterUrl}
                    alt={season.titleClean}
                    fill
                    sizes="(max-width: 1024px) 80vw, 40vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-faint">
                    <Video className="h-10 w-10" />
                    <span className="text-xs uppercase tracking-[0.2em]">
                      No Poster
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted 2xl:text-base">
                <p className="font-medium text-foreground">{subtitle}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted 2xl:text-sm">
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-faint">Episodes</p>
                    <p className="mt-1 text-sm text-foreground">
                      {episodes.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-faint">Rating</p>
                    <p className="mt-1 text-sm text-foreground">
                      {formatRating(season.tmdbRating)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h2 className="font-serif text-xl font-semibold text-foreground 2xl:text-2xl">
                  Episodes
                </h2>
                {episodes.length === 0 ? (
                  <p className="mt-4 text-sm text-muted 2xl:text-base">
                    No episodes found for this season.
                  </p>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm text-muted 2xl:text-base">
                      <thead className="bg-background/50 text-xs uppercase tracking-[0.2em] text-faint">
                        <tr>
                          <th className="px-4 py-3 text-left">Episode</th>
                          <th className="px-4 py-3 text-left">Title</th>
                          <th className="px-4 py-3 text-right">Play</th>
                        </tr>
                      </thead>
                      <tbody>
                        {episodes.map((episode) => (
                          <tr
                            key={episode.id}
                            className="border-t border-border"
                          >
                            <td className="px-4 py-3 text-foreground">
                              {episode.episodeNumber ?? "\u2014"}
                            </td>
                            <td className="px-4 py-3 text-foreground">
                              {episode.titleClean || episode.titleRaw}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handlePlay(episode)}
                                disabled={playing === episode.id}
                                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 2xl:text-sm"
                              >
                                <Play className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                                {playing === episode.id ? "Launching..." : "Play"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
