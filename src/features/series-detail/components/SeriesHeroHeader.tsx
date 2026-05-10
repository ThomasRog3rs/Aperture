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
import type { Series } from "@/lib/types";

export type SeriesHeroHeaderProps = {
  series: Series | null;
  loading: boolean;
  seasonSummary: string;
  topSeasonYear: number | null;
  topSeasonGenres: string[];
  seriesRating: number | null;
  continueEpisode: boolean;
  allWatched: boolean;
  totalEpisodeCount: number;
  randomSessionLoading: boolean;
  hasRandomSession: boolean;
  randomAction: "start_new" | "continue" | "next_random" | "mark_started" | null;
  onPlayContinue: () => void;
  onPlayRandomContinue: () => void;
  onPlayRandomStartNew: () => void;
  onOpenEdit: () => void;
  onOpenInfo: () => void;
};

export function SeriesHeroHeader({
  series,
  loading,
  seasonSummary,
  topSeasonYear,
  topSeasonGenres,
  seriesRating,
  continueEpisode,
  allWatched,
  totalEpisodeCount,
  randomSessionLoading,
  hasRandomSession,
  randomAction,
  onPlayContinue,
  onPlayRandomContinue,
  onPlayRandomStartNew,
  onOpenEdit,
  onOpenInfo,
}: SeriesHeroHeaderProps) {
  if (!loading && series) {
    const backdropPath = series.seasons[0]?.backdropPath;

    return (
      <div className="relative w-full h-[50vh] sm:h-[60vh] flex items-end pb-12">
        {backdropPath ? (
          <div className="absolute inset-0 z-0">
            <Image
              src={tmdbImageUrl(backdropPath, "original") || ""}
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

        <div className="relative z-10 w-full px-6 lg:px-12 max-w-7xl mx-auto flex flex-col gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors w-fit mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Link>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
            {series.titleClean}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base text-white/80 font-medium drop-shadow-md">
            {topSeasonYear ? <span>{topSeasonYear}</span> : null}
            <span>•</span>
            <span>{seasonSummary}</span>
            {topSeasonGenres.length > 0 ? (
              <>
                <span>•</span>
                <span>{topSeasonGenres.slice(0, 3).join(", ")}</span>
              </>
            ) : null}
            {seriesRating != null ? (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">★ {formatRating(seriesRating)}</span>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            {continueEpisode ? (
              <button
                onClick={onPlayContinue}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors shadow-lg"
              >
                <Play className="h-4 w-4 fill-current" />
                {allWatched ? "Watch Again" : "Continue"}
              </button>
            ) : null}

            {totalEpisodeCount > 0 ? (
              randomSessionLoading && !hasRandomSession ? (
                <button
                  disabled
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-strong/80 backdrop-blur-sm text-white font-semibold border border-white/10 opacity-60"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Random
                </button>
              ) : hasRandomSession ? (
                <>
                  <button
                    onClick={onPlayRandomContinue}
                    disabled={randomAction !== null}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background font-semibold hover:bg-accent-hover transition-colors shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Shuffle className="h-4 w-4" />
                    {randomAction === "continue" ? "Continuing..." : "Continue Random"}
                  </button>
                  <button
                    onClick={onPlayRandomStartNew}
                    disabled={randomAction !== null}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-strong/80 backdrop-blur-sm text-white font-semibold hover:bg-surface-strong transition-colors border border-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Shuffle className="h-4 w-4" />
                    {randomAction === "start_new" ? "Starting..." : "Start New Random"}
                  </button>
                </>
              ) : (
                <button
                  onClick={onPlayRandomStartNew}
                  disabled={randomAction !== null}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background font-semibold hover:bg-accent-hover transition-colors shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Shuffle className="h-4 w-4" />
                  {randomAction === "start_new" ? "Starting..." : "Random"}
                </button>
              )
            ) : null}

            <div className="flex-1" />

            <button
              onClick={onOpenEdit}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-strong/80 backdrop-blur-sm text-white font-semibold hover:bg-surface-strong transition-colors border border-white/10"
            >
              <Edit3 className="h-4 w-4" /> Edit
            </button>

            <button
              onClick={onOpenInfo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-strong/80 backdrop-blur-sm text-white font-semibold hover:bg-surface-strong transition-colors border border-white/10"
            >
              <Info className="h-4 w-4" /> Info
            </button>
          </div>
        </div>
      </div>
    );
  }

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
