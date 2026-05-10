"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Grid2X2, List, Monitor, Play } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  getEpisodeDisplayTitle,
  getEpisodeNumberLabel,
  getSeasonLabel,
} from "@/features/series-detail/domain";
import { formatRating } from "@/lib/format";
import type { Episode, SeasonWithEpisodes } from "@/lib/types";

export type SeriesSeasonsCardProps = {
  seasons: SeasonWithEpisodes[];
  playingEpisodeId: string | null;
  togglingWatchedEpisodeIds: ReadonlySet<string>;
  onToggleEpisodeWatched: (episode: Episode, checked: boolean) => void;
  onPlayEpisode: (episode: Episode) => void;
  onPlayExternalEpisode: (episode: Episode) => void;
};

type EpisodeViewMode = "cards" | "table";

export function SeriesSeasonsCard({
  seasons,
  playingEpisodeId,
  togglingWatchedEpisodeIds,
  onToggleEpisodeWatched,
  onPlayEpisode,
  onPlayExternalEpisode,
}: SeriesSeasonsCardProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [episodeViewMode, setEpisodeViewMode] =
    useState<EpisodeViewMode>("cards");
  const seasonTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const defaultSeasonId = useMemo(() => {
    const firstWithUnwatched = seasons.find((season) =>
      season.episodes.some((episode) => !episode.watched)
    );

    return firstWithUnwatched?.id ?? seasons[0]?.id ?? null;
  }, [seasons]);

  const selectedSeason = useMemo(() => {
    if (seasons.length === 0) return null;

    if (!selectedSeasonId) {
      return seasons.find((season) => season.id === defaultSeasonId) ?? seasons[0];
    }

    return (
      seasons.find((season) => season.id === selectedSeasonId) ??
      seasons.find((season) => season.id === defaultSeasonId) ??
      seasons[0]
    );
  }, [defaultSeasonId, seasons, selectedSeasonId]);

  const seasonEpisodeCount =
    selectedSeason?.episodeCount ?? selectedSeason?.episodes.length ?? 0;
  const effectiveViewMode: EpisodeViewMode = isDesktop ? episodeViewMode : "cards";
  const seasonEpisodesToMark = useMemo(
    () =>
      selectedSeason?.episodes.filter(
        (episode) => !episode.watched && !togglingWatchedEpisodeIds.has(episode.id)
      ) ?? [],
    [selectedSeason, togglingWatchedEpisodeIds]
  );
  const isSeasonActionPending = useMemo(
    () =>
      selectedSeason?.episodes.some((episode) => togglingWatchedEpisodeIds.has(episode.id)) ??
      false,
    [selectedSeason, togglingWatchedEpisodeIds]
  );

  const handleMarkSeasonWatched = () => {
    seasonEpisodesToMark.forEach((episode) => {
      onToggleEpisodeWatched(episode, true);
    });
  };

  useEffect(() => {
    if (!isDesktop || !selectedSeason?.id) return;

    seasonTabRefs.current[selectedSeason.id]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [isDesktop, selectedSeason?.id]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold text-foreground sm:text-xl">
              Episodes
            </h2>
            <div className="hidden items-center gap-1 rounded-lg border border-border bg-background/50 p-1 lg:inline-flex">
              <button
                type="button"
                onClick={() => setEpisodeViewMode("cards")}
                aria-pressed={episodeViewMode === "cards"}
                className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${
                  episodeViewMode === "cards"
                    ? "bg-accent text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Grid2X2 className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setEpisodeViewMode("table")}
                aria-pressed={episodeViewMode === "table"}
                className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${
                  episodeViewMode === "table"
                    ? "bg-accent text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
          </div>

          {seasons.length > 0 ? (
            <>
              <label htmlFor="season-select" className="sr-only">
                Select season
              </label>
              <select
                id="season-select"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 lg:hidden"
                value={selectedSeason?.id ?? ""}
                onChange={(event) => setSelectedSeasonId(event.target.value)}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {getSeasonLabel(season)}
                  </option>
                ))}
              </select>

              <div
                role="tablist"
                aria-label="Season selection"
                className="minimal-x-scroll hidden gap-2 overflow-x-auto pb-1 lg:flex"
              >
                {seasons.map((season) => {
                  const isSelected = season.id === selectedSeason?.id;

                  return (
                    <button
                      key={season.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls={`season-panel-${season.id}`}
                      id={`season-tab-${season.id}`}
                      ref={(element) => {
                        seasonTabRefs.current[season.id] = element;
                      }}
                      onClick={() => setSelectedSeasonId(season.id)}
                      className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/15 text-foreground"
                          : "border-border bg-background/40 text-muted hover:border-border-hover hover:text-foreground"
                      }`}
                    >
                      {getSeasonLabel(season)}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section
        id={selectedSeason ? `season-panel-${selectedSeason.id}` : undefined}
        aria-labelledby={selectedSeason ? `season-tab-${selectedSeason.id}` : undefined}
        role={selectedSeason ? "tabpanel" : undefined}
        className="overflow-hidden rounded-2xl border border-border bg-surface"
      >
        {selectedSeason ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-strong/40 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="font-serif text-base font-semibold text-foreground sm:text-lg">
                  {getSeasonLabel(selectedSeason)}
                </p>
                <p className="text-xs text-muted sm:text-sm">
                  {seasonEpisodeCount} episodes • {formatRating(selectedSeason.tmdbRating)}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {selectedSeason.titleClean ? (
                  <span className="text-xs text-faint sm:text-sm">
                    {selectedSeason.titleClean}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleMarkSeasonWatched}
                  disabled={seasonEpisodesToMark.length === 0 || isSeasonActionPending}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {isSeasonActionPending
                    ? "Updating season..."
                    : seasonEpisodesToMark.length > 0
                      ? `Mark season watched (${seasonEpisodesToMark.length})`
                      : "Season watched"}
                </button>
              </div>
            </header>

            {selectedSeason.episodes.length === 0 ? (
              <p className="p-5 text-sm text-muted">No episodes found for this season.</p>
            ) : effectiveViewMode === "cards" ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5 xl:grid-cols-3">
                {selectedSeason.episodes.map((episode) => {
                  const isPlaying = playingEpisodeId === episode.id;

                  return (
                    <article
                      key={episode.id}
                      className="flex min-h-[182px] flex-col justify-between rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-border-hover"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted">
                            Episode {getEpisodeNumberLabel(episode)}
                          </span>
                          {episode.watched ? (
                            <span className="inline-flex items-center rounded-full border border-success/50 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                              Watched
                            </span>
                          ) : null}
                        </div>
                        <h3
                          className={`text-sm font-medium leading-6 sm:text-base ${
                            episode.watched ? "text-muted line-through" : "text-foreground"
                          }`}
                        >
                          {getEpisodeDisplayTitle(episode)}
                        </h3>
                      </div>

                      <div className="mt-4 space-y-3">
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted sm:text-sm">
                          <input
                            type="checkbox"
                            checked={episode.watched}
                            onChange={(event) =>
                              onToggleEpisodeWatched(episode, event.target.checked)
                            }
                            disabled={togglingWatchedEpisodeIds.has(episode.id)}
                            className="h-5 w-5 rounded border-border bg-background text-accent focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          Mark as watched
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onPlayEpisode(episode)}
                            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Play className="h-3.5 w-3.5" />
                            {isPlaying ? "Playing" : "Play"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onPlayExternalEpisode(episode)}
                            disabled={isPlaying}
                            aria-label="Play episode in external player"
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            title="Play in external player"
                          >
                            <Monitor className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="minimal-x-scroll overflow-x-auto">
                <table className="w-full text-sm text-muted">
                  <thead className="bg-surface-strong/50 text-xs uppercase tracking-[0.2em] text-faint">
                    <tr>
                      <th scope="col" className="w-16 px-4 py-3 text-center">
                        <span className="sr-only">Watched</span>
                        <Check className="mx-auto h-3.5 w-3.5" />
                      </th>
                      <th scope="col" className="px-4 py-3 text-left">
                        Episode
                      </th>
                      <th scope="col" className="px-4 py-3 text-left">
                        Title
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Play
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {selectedSeason.episodes.map((episode) => {
                      const isPlaying = playingEpisodeId === episode.id;

                      return (
                        <tr
                          key={episode.id}
                          className="transition-colors hover:bg-surface-strong/30"
                        >
                          <td className="w-16 px-4 py-3 text-center">
                            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center">
                              <span className="sr-only">
                                Mark episode {getEpisodeNumberLabel(episode)} as watched
                              </span>
                              <input
                                type="checkbox"
                                checked={episode.watched}
                                onChange={(event) =>
                                  onToggleEpisodeWatched(episode, event.target.checked)
                                }
                                disabled={togglingWatchedEpisodeIds.has(episode.id)}
                                className="h-5 w-5 rounded border-border bg-background text-accent focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </label>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-foreground">
                            {getEpisodeNumberLabel(episode)}
                          </td>
                          <td
                            className={`px-4 py-3 ${
                              episode.watched ? "text-muted line-through" : "text-foreground"
                            }`}
                          >
                            {getEpisodeDisplayTitle(episode)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onPlayEpisode(episode)}
                                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Play className="h-3.5 w-3.5" />
                                {isPlaying ? "Playing" : "Play"}
                              </button>
                              <button
                                type="button"
                                onClick={() => onPlayExternalEpisode(episode)}
                                disabled={isPlaying}
                                aria-label="Play episode in external player"
                                className="inline-flex min-h-10 min-w-10 items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                title="Play in external player"
                              >
                                <Monitor className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="p-5 text-sm text-muted">No seasons found for this series.</p>
        )}
      </section>
    </div>
  );
}
