"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Play, X } from "lucide-react";
import type { RefObject } from "react";
import type {
  VideoPlayerEpisodeListSeason,
} from "@/components/video-player/types";

type EpisodeSelectorPanelProps = {
  panelRef: RefObject<HTMLDivElement | null>;
  currentEpisodeRef: RefObject<HTMLButtonElement | null>;
  episodeSeasons?: VideoPlayerEpisodeListSeason[];
  openEpisodeSeasonId: string | null;
  onClose: () => void;
  onToggleSeason: (seasonId: string) => void;
  onSelectEpisode: (episodeId: string) => void;
};

export function EpisodeSelectorPanel({
  panelRef,
  currentEpisodeRef,
  episodeSeasons,
  openEpisodeSeasonId,
  onClose,
  onToggleSeason,
  onSelectEpisode,
}: EpisodeSelectorPanelProps) {
  return (
    <div
      ref={panelRef}
      className="absolute bottom-20 right-4 z-30 flex w-[min(30rem,calc(100%-2rem))] max-w-full flex-col overflow-hidden rounded-3xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border bg-surface/90 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-faint">
            Episode selector
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            Browse all seasons
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
          aria-label="Close episode selector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[min(60vh,34rem)] overflow-y-auto bg-background/90">
        {episodeSeasons?.map((season) => {
          const isSeasonOpen = season.id === openEpisodeSeasonId;
          const seasonPanelId = `episode-selector-season-${season.id.replace(
            /[^a-zA-Z0-9_-]/g,
            "-"
          )}`;

          return (
            <section
              key={season.id}
              className="border-t border-border/60 first:border-t-0"
            >
              <h3>
                <button
                  type="button"
                  onClick={() => onToggleSeason(season.id)}
                  aria-expanded={isSeasonOpen}
                  aria-controls={seasonPanelId}
                  className="flex w-full items-center justify-between gap-4 bg-surface/95 px-5 py-4 text-left transition-colors hover:bg-surface"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {season.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {season.subtitle ? <span>{season.subtitle}</span> : null}
                      <span>{season.episodes.length} episodes</span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 text-muted transition-transform ${
                      isSeasonOpen ? "rotate-180 text-foreground" : ""
                    }`}
                  />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isSeasonOpen ? (
                  <motion.div
                    key={seasonPanelId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div id={seasonPanelId} className="divide-y divide-border/40">
                      {season.episodes.map((episode) => (
                        <button
                          key={episode.id}
                          ref={episode.isCurrent ? currentEpisodeRef : undefined}
                          onClick={() => onSelectEpisode(episode.id)}
                          className={`flex w-full items-center gap-4 px-5 py-3 text-left transition-colors ${
                            episode.isCurrent
                              ? "bg-accent/10"
                              : "hover:bg-surface-strong/60"
                          }`}
                        >
                          <span className="w-8 flex-shrink-0 text-sm font-semibold text-faint">
                            {episode.numberLabel}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className={`truncate text-sm font-medium ${
                                  episode.isCurrent
                                    ? "text-foreground"
                                    : "text-white/90"
                                }`}
                              >
                                {episode.title}
                              </p>
                              {episode.isCurrent ? (
                                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                                  Playing
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted">{episode.subtitle}</p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            {episode.watched ? (
                              <span className="rounded-full border border-border/80 bg-surface/80 p-1.5 text-muted">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                            <span className="rounded-full border border-white/20 bg-white/5 p-2 text-white/80 transition-colors">
                              <Play className="h-3.5 w-3.5 fill-current" />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
    </div>
  );
}
