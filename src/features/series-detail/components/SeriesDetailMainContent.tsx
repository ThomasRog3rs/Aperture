import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";
import { SeriesCastCrewCard } from "@/features/series-detail/components/SeriesCastCrewCard";
import { SeriesPosterSidebar } from "@/features/series-detail/components/SeriesPosterSidebar";
import { SeriesSeasonsCard } from "@/features/series-detail/components/SeriesSeasonsCard";
import type { Notice } from "@/features/series-detail/types";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";

export type SeriesDetailMainContentProps = {
  notice: Notice | null;
  loading: boolean;
  series: Series | null;
  playerContent?: ReactNode;
  posterUrl: string | null;
  hasMissingBasicInfo: boolean;
  refreshing: boolean;
  onRefreshPoster: () => void;
  castCrew: {
    directors: string[];
    writers: string[];
    actors: string[];
  };
  seasons: SeasonWithEpisodes[];
  playingEpisodeId: string | null;
  togglingWatchedEpisodeIds: ReadonlySet<string>;
  onToggleEpisodeWatched: (episode: Episode, checked: boolean) => void;
  onPlayEpisode: (episode: Episode) => void;
  onPlayExternalEpisode: (episode: Episode) => void;
};

export function SeriesDetailMainContent({
  notice,
  loading,
  series,
  playerContent,
  posterUrl,
  hasMissingBasicInfo,
  refreshing,
  onRefreshPoster,
  castCrew,
  seasons,
  playingEpisodeId,
  togglingWatchedEpisodeIds,
  onToggleEpisodeWatched,
  onPlayEpisode,
  onPlayExternalEpisode,
}: SeriesDetailMainContentProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 2xl:max-w-screen-2xl">
      {notice ? <StatusBanner tone={notice.tone} message={notice.message} /> : null}

      {playerContent ?? null}

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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <SeriesPosterSidebar
            series={series}
            posterUrl={posterUrl}
            hasMissingBasicInfo={hasMissingBasicInfo}
            refreshing={refreshing}
            onRefreshPoster={onRefreshPoster}
          />

          <div className="flex flex-col gap-4">
            <SeriesCastCrewCard
              directors={castCrew.directors}
              writers={castCrew.writers}
              actors={castCrew.actors}
            />
            <SeriesSeasonsCard
              seasons={seasons}
              playingEpisodeId={playingEpisodeId}
              togglingWatchedEpisodeIds={togglingWatchedEpisodeIds}
              onToggleEpisodeWatched={onToggleEpisodeWatched}
              onPlayEpisode={onPlayEpisode}
              onPlayExternalEpisode={onPlayExternalEpisode}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
