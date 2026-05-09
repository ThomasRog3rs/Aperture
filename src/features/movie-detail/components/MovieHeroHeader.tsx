import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Edit3,
  Info,
  Monitor,
  Play,
  Video,
} from "lucide-react";
import { formatRating, formatRuntime, tmdbImageUrl } from "@/lib/format";
import type { Movie } from "@/lib/types";

type MovieHeroHeaderProps = {
  movie: Movie | null;
  loading: boolean;
  playing: boolean;
  savingWatched: boolean;
  onPlay: () => void;
  onPlayExternal: () => void;
  onWatchedToggle: (checked: boolean) => void;
  onOpenEdit: () => void;
  onOpenInfo: () => void;
};

export function MovieHeroHeader({
  movie,
  loading,
  playing,
  savingWatched,
  onPlay,
  onPlayExternal,
  onWatchedToggle,
  onOpenEdit,
  onOpenInfo,
}: MovieHeroHeaderProps) {
  if (!loading && movie) {
    return (
      <div className="relative w-full h-[50vh] sm:h-[60vh] flex items-end pb-12">
        {movie.backdropPath ? (
          <div className="absolute inset-0 z-0">
            <Image
              src={tmdbImageUrl(movie.backdropPath, "original") || ""}
              alt={movie.titleClean}
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
            {movie.titleClean}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base text-white/80 font-medium drop-shadow-md">
            {movie.year && <span>{movie.year}</span>}
            {movie.runtimeMinutes && (
              <>
                <span>•</span>
                <span>{formatRuntime(movie.runtimeMinutes)}</span>
              </>
            )}
            {movie.genres.length > 0 && (
              <>
                <span>•</span>
                <span>{movie.genres.join(", ")}</span>
              </>
            )}
            {movie.tmdbRating && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">★ {formatRating(movie.tmdbRating)}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              onClick={onPlay}
              disabled={!movie.filePath}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              <Play className="h-5 w-5 fill-current" />
              Play
            </button>

            <button
              onClick={onPlayExternal}
              disabled={playing || !movie.filePath}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-strong/80 backdrop-blur-sm text-white font-semibold hover:bg-surface-strong transition-colors border border-white/10 disabled:opacity-50"
            >
              <Monitor className="h-4 w-4" />
              {playing ? "Launching..." : "External player"}
            </button>

            <button
              onClick={() => onWatchedToggle(!movie.watched)}
              disabled={savingWatched}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-colors border ${
                movie.watched
                  ? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
                  : "bg-surface-strong/80 backdrop-blur-sm text-white border-white/10 hover:bg-surface-strong"
              } disabled:opacity-50`}
            >
              {movie.watched ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
              {movie.watched ? "Watched" : "Mark as watched"}
            </button>

            {movie.youtubeTrailerKey && (
              <a
                href={`https://www.youtube.com/watch?v=${movie.youtubeTrailerKey}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-surface-strong/80 backdrop-blur-sm text-white font-semibold hover:bg-surface-strong transition-colors border border-white/10"
              >
                <Video className="h-5 w-5" />
                Trailer
              </a>
            )}

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

