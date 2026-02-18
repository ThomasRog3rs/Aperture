"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronDown, Loader2, Play } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";
import { formatRating } from "@/lib/format";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";

type SeriesResponse = {
  series: Series;
  seasons: SeasonWithEpisodes[];
  error?: string;
};

export default function SeriesDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const seriesId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [series, setSeries] = useState<Series | null>(null);
  const [seasons, setSeasons] = useState<SeasonWithEpisodes[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const fetchSeries = useCallback(async () => {
    if (!seriesId) {
      setNotice({ tone: "error", message: "Missing series id in URL." });
      setSeries(null);
      setSeasons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/series/${seriesId}`);
      const data = (await response.json()) as SeriesResponse;
      if (!response.ok || !data.series) {
        throw new Error(data.error || "Series not found.");
      }
      setSeries(data.series);
      setSeasons(data.seasons ?? data.series.seasons ?? []);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to load series.",
      });
      setSeries(null);
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

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

  const seasonSummary = useMemo(() => {
    if (!series) return "";
    return `${series.seasonCount} ${series.seasonCount === 1 ? "season" : "seasons"}`;
  }, [series]);

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
              Series
            </p>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground 2xl:text-4xl">
              {series?.titleClean ?? "Loading..."}
            </h1>
            {series ? (
              <p className="mt-1 text-xs text-muted 2xl:text-sm">{seasonSummary}</p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 2xl:max-w-screen-2xl">
        {notice ? <StatusBanner tone={notice.tone} message={notice.message} /> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted 2xl:text-base">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Loading series...
          </div>
        ) : null}

        {!loading && !series ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center 2xl:p-16">
            <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
              Series not found
            </p>
            <p className="text-sm text-muted 2xl:text-base">
              The series you are looking for could not be loaded.
            </p>
            <Link
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground 2xl:py-2 2xl:text-base"
            >
              Return to library
            </Link>
          </div>
        ) : null}

        {!loading && series ? (
          <div className="flex flex-col gap-4">
            {seasons.map((season) => {
              const seasonLabel = season.seasonNumber
                ? `Season ${season.seasonNumber}`
                : "Season";
              const episodeCount = season.episodeCount ?? season.episodes.length;
              return (
                <details
                  key={season.id}
                  className="group rounded-2xl border border-border bg-surface"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-serif text-lg font-semibold text-foreground">
                        {seasonLabel}
                      </p>
                      <p className="text-xs text-muted 2xl:text-sm">
                        {season.titleClean}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted 2xl:text-sm">
                      <span>{episodeCount} ep</span>
                      <span>{formatRating(season.tmdbRating)}</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>

                  <div className="border-t border-border px-5 py-4">
                    <div className="flex justify-end">
                      <Link
                        href={`/seasons/${season.id}`}
                        className="text-xs font-semibold text-accent hover:text-accent-hover 2xl:text-sm"
                      >
                        Edit season
                      </Link>
                    </div>
                    {season.episodes.length === 0 ? (
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
                            {season.episodes.map((episode) => (
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
                </details>
              );
            })}
          </div>
        ) : null}
      </main>
    </div>
  );
}
