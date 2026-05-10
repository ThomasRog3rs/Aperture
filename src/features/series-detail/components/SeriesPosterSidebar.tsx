import Image from "next/image";
import { RefreshCw, Video } from "lucide-react";
import type { Series } from "@/lib/types";

export type SeriesPosterSidebarProps = {
  series: Series;
  posterUrl: string | null;
  hasMissingBasicInfo: boolean;
  refreshing: boolean;
  onRefreshPoster: () => void;
};

export function SeriesPosterSidebar({
  series,
  posterUrl,
  hasMissingBasicInfo,
  refreshing,
  onRefreshPoster,
}: SeriesPosterSidebarProps) {
  return (
    <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 flex flex-col gap-4">
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
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-3">
          <p className="text-sm text-amber-500 font-medium">Missing info</p>
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
    </div>
  );
}
