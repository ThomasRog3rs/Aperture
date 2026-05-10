import { Check, ChevronDown, Monitor, Play } from "lucide-react";
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

export function SeriesSeasonsCard({
  seasons,
  playingEpisodeId,
  togglingWatchedEpisodeIds,
  onToggleEpisodeWatched,
  onPlayEpisode,
  onPlayExternalEpisode,
}: SeriesSeasonsCardProps) {
  return (
    <div className="flex flex-col gap-4">
      {seasons.map((season) => {
        const seasonLabel = getSeasonLabel(season);
        const episodeCount = season.episodeCount ?? season.episodes.length;

        return (
          <details
            key={season.id}
            className="group rounded-2xl border border-border bg-surface overflow-hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-surface-strong/30 transition-colors">
              <div className="min-w-0">
                <p className="font-serif text-lg font-semibold text-foreground">{seasonLabel}</p>
                <p className="text-xs text-muted 2xl:text-sm">{season.titleClean}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted 2xl:text-sm">
                <span>{episodeCount} ep</span>
                <span>{formatRating(season.tmdbRating)}</span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </div>
            </summary>

            <div className="border-t border-border bg-background/30">
              {season.episodes.length === 0 ? (
                <p className="p-5 text-sm text-muted">No episodes found for this season.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-muted">
                    <thead className="bg-surface-strong/50 text-xs uppercase tracking-[0.2em] text-faint">
                      <tr>
                        <th className="w-12 px-4 py-3 text-center">
                          <Check className="mx-auto h-3.5 w-3.5" />
                        </th>
                        <th className="px-4 py-3 text-left">Episode</th>
                        <th className="px-4 py-3 text-left">Title</th>
                        <th className="px-4 py-3 text-right">Play</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {season.episodes.map((episode) => (
                        <tr
                          key={episode.id}
                          className="hover:bg-surface-strong/30 transition-colors"
                        >
                          <td className="w-12 px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={episode.watched}
                              onChange={(event) =>
                                onToggleEpisodeWatched(episode, event.target.checked)
                              }
                              disabled={togglingWatchedEpisodeIds.has(episode.id)}
                              className="h-4 w-4 cursor-pointer rounded border-border bg-background text-accent focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-foreground whitespace-nowrap">
                            {getEpisodeNumberLabel(episode)}
                          </td>
                          <td
                            className={`px-4 py-3 ${
                              episode.watched ? "text-muted line-through" : "text-foreground"
                            }`}
                          >
                            {getEpisodeDisplayTitle(episode)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => onPlayEpisode(episode)}
                                className="inline-flex items-center gap-2 rounded-lg bg-accent/10 text-accent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Play
                              </button>
                              <button
                                onClick={() => onPlayExternalEpisode(episode)}
                                disabled={playingEpisodeId === episode.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                title="Play in external player"
                              >
                                <Monitor className="h-3 w-3" />
                              </button>
                            </div>
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
  );
}
