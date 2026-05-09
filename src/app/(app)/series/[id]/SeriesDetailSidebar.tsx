import Image from "next/image";
import { RefreshCw, Video } from "lucide-react";
import type { Series } from "@/lib/types";
import type { SeriesCastCrew } from "./series-detail.selectors";

type SeriesDetailSidebarProps = {
  series: Series;
  posterUrl: string | null;
  hasMissingBasicInfo: boolean;
  refreshing: boolean;
  castCrew: SeriesCastCrew;
  onRefreshPoster: () => void;
};

export function SeriesDetailSidebar({
  series,
  posterUrl,
  hasMissingBasicInfo,
  refreshing,
  castCrew,
  onRefreshPoster,
}: SeriesDetailSidebarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={series.titleClean}
            fill
            sizes="(max-width: 1024px) 80vw, 40vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-faint">
            <Video className="h-10 w-10" />
            <span className="text-xs uppercase tracking-[0.2em]">No Poster</span>
          </div>
        )}
      </div>

      {hasMissingBasicInfo ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-500">Missing info</p>
          <p className="text-xs text-amber-500/80">
            Some details like year or rating are missing. Fetch from OMDb to update.
          </p>
          <button
            onClick={onRefreshPoster}
            disabled={refreshing}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-500 transition-colors hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Fetching..." : "Fetch from OMDb"}
          </button>
        </div>
      ) : null}

      {castCrew.directors.length > 0 ||
      castCrew.writers.length > 0 ||
      castCrew.actors.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          <p className="font-serif text-lg font-medium text-foreground">
            Cast & Crew
          </p>
          <div className="mt-4 space-y-4">
            {castCrew.directors.length > 0 ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-faint">
                  Director
                </p>
                <p className="text-foreground">{castCrew.directors.join(", ")}</p>
              </div>
            ) : null}
            {castCrew.writers.length > 0 ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-faint">
                  Writer
                </p>
                <p className="text-foreground">{castCrew.writers.join(", ")}</p>
              </div>
            ) : null}
            {castCrew.actors.length > 0 ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-faint">
                  Cast
                </p>
                <p className="text-foreground">{castCrew.actors.join(", ")}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
