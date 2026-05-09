import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  Info,
  Loader2,
  Play,
  Shuffle,
} from "lucide-react";
import { formatRating, tmdbImageUrl } from "@/lib/format";
import type { Episode, Series } from "@/lib/types";
import type {
  RandomSessionAction,
  RandomSessionSummary,
} from "./series-detail.types";

type SeriesDetailHeroProps = {
  series: Series | null;
  loading: boolean;
  seasonSummary: string;
  seriesRating: number | null;
  continueEpisode: Episode | null;
  allWatched: boolean;
  hasEpisodes: boolean;
  randomSession: RandomSessionSummary | null;
  randomSessionLoading: boolean;
  randomAction: RandomSessionAction | null;
  onPlayContinue: () => void;
  onPlayRandom: (action: "start_new" | "continue") => void;
  onOpenEdit: () => void;
  onOpenInfo: () => void;
};

export function SeriesDetailHero({
  series,
  loading,
  seasonSummary,
  seriesRating,
  continueEpisode,
  allWatched,
  hasEpisodes,
  randomSession,
  randomSessionLoading,
  randomAction,
  onPlayContinue,
  onPlayRandom,
  onOpenEdit,
  onOpenInfo,
}: SeriesDetailHeroProps) {
  if (loading || !series) {
    return (
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-6 py-5 2xl:max-w-screen-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Link>
        </div>
      </header>
    );
  }

  return (
    <div className="relative flex h-[50vh] w-full items-end pb-12 sm:h-[60vh]">
      {series.seasons[0]?.backdropPath ? (
        <div className="absolute inset-0 z-0">
          <Image
            src={tmdbImageUrl(series.seasons[0].backdropPath, "original") || ""}
            alt={series.titleClean}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-surface-strong">
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 lg:px-12">
        <Link
          href="/"
          className="mb-4 inline-flex w-fit items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to library
        </Link>

        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
          {series.titleClean}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/80 drop-shadow-md sm:text-base">
          {series.seasons[0]?.year ? <span>{series.seasons[0].year}</span> : null}
          <span>•</span>
          <span>{seasonSummary}</span>
          {series.seasons[0]?.genres && series.seasons[0].genres.length > 0 ? (
            <>
              <span>•</span>
              <span>{series.seasons[0].genres.slice(0, 3).join(", ")}</span>
            </>
          ) : null}
          {seriesRating ? (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                ★ {formatRating(seriesRating)}
              </span>
            </>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {continueEpisode ? (
            <button
              onClick={onPlayContinue}
              className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-semibold text-black shadow-lg transition-colors hover:bg-white/90"
            >
              <Play className="h-4 w-4 fill-current" />
              {allWatched ? "Watch Again" : "Continue"}
            </button>
          ) : null}

          {hasEpisodes ? (
            randomSessionLoading && !randomSession ? (
              <button
                disabled
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-strong/80 px-5 py-2.5 font-semibold text-white opacity-60 backdrop-blur-sm"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Random
              </button>
            ) : randomSession ? (
              <>
                <button
                  onClick={() => onPlayRandom("continue")}
                  disabled={randomAction !== null}
                  className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-semibold text-background shadow-lg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Shuffle className="h-4 w-4" />
                  {randomAction === "continue" ? "Continuing..." : "Continue Random"}
                </button>
                <button
                  onClick={() => onPlayRandom("start_new")}
                  disabled={randomAction !== null}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-strong/80 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Shuffle className="h-4 w-4" />
                  {randomAction === "start_new" ? "Starting..." : "Start New Random"}
                </button>
              </>
            ) : (
              <button
                onClick={() => onPlayRandom("start_new")}
                disabled={randomAction !== null}
                className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-semibold text-background shadow-lg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Shuffle className="h-4 w-4" />
                {randomAction === "start_new" ? "Starting..." : "Random"}
              </button>
            )
          ) : null}

          <div className="flex-1" />

          <button
            onClick={onOpenEdit}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-strong/80 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-surface-strong"
          >
            <Edit3 className="h-4 w-4" /> Edit
          </button>

          <button
            onClick={onOpenInfo}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-strong/80 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-surface-strong"
          >
            <Info className="h-4 w-4" /> Info
          </button>
        </div>
      </div>
    </div>
  );
}
