"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Play, Star, AlertTriangle, Video } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatRating, formatRuntime, tmdbImageUrl } from "@/lib/format";
import type { Movie } from "@/lib/types";

type MovieCardProps = {
  movie: Movie;
  onPlay: (movie: Movie) => void;
  onWatched?: (id: string, watched: boolean) => void;
  /** When true, blur the card if movie is XXX rated (e.g. on main browse, not when searching/filtering). */
  blurIfXxxRated?: boolean;
};

export function MovieCard({ movie, onPlay, onWatched, blurIfXxxRated = false }: MovieCardProps) {
  const isLargeScreen = useMediaQuery("(min-width: 1536px)");
  const posterSize = isLargeScreen ? "w780" : "w342";
  const posterUrl = tmdbImageUrl(movie.posterPath, posterSize);
  const shouldBlur = blurIfXxxRated && movie.xxxRated;
  const fileMissing = movie.errorMessage
    ? movie.errorMessage.toLowerCase().includes("no video file")
    : false;
  const playDisabled = !movie.filePath || fileMissing;
  const notFound = !movie.tmdbId;
  const errorLabel = fileMissing ? "Missing file" : "Metadata unavailable";
  const handlePosterError = () => {
    console.warn("[Aperture] Poster failed to load", {
      title: movie.titleClean,
      posterPath: movie.posterPath,
      posterUrl,
      tmdbId: movie.tmdbId,
    });
  };

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(212,168,83,0.08)]"
    >
      <div className={`flex min-h-0 flex-1 flex-col ${shouldBlur ? "blur-xl select-none" : ""}`}>
        {/* ── Poster ─────────────────────── */}
        <Link
          href={`/movies/${movie.id}`}
          aria-label={`Open details for ${movie.titleClean}`}
          className="relative block aspect-[2/3] w-full shrink-0 overflow-hidden bg-background"
        >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.titleClean}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, (min-width: 1536px) 20vw, 18vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            onError={handlePosterError}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-strong text-faint">
            <Video className="h-8 w-8" />
            <span className="text-xs uppercase tracking-[0.2em]">
              No Poster
            </span>
          </div>
        )}
        {/* Warm cinematic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c0a] via-[#0d0c0a]/20 to-transparent opacity-85" />
        </Link>

        {/* ── Details ────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <Link
          href={`/movies/${movie.id}`}
          className="block min-w-0"
          aria-label={`Open details for ${movie.titleClean}`}
        >
          <h3 className="line-clamp-2 font-serif text-lg font-bold tracking-tight text-foreground 2xl:text-2xl">
            {movie.titleClean}
          </h3>
          <p className="mt-1 text-xs text-muted 2xl:text-sm">
            {movie.year ?? "\u2014"} · {formatRuntime(movie.runtimeMinutes)}
          </p>
        </Link>
        <div className="flex items-center gap-1.5">
            {onWatched ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onWatched(movie.id, !movie.watched);
                }}
                className={`cursor-pointer flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors 2xl:px-3 2xl:py-2 2xl:text-sm ${
                  movie.watched
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "border border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
                }`}
                title={movie.watched ? "Mark as unwatched" : "Mark as watched"}
                aria-label={movie.watched ? "Mark as unwatched" : "Mark as watched"}
              >
                <Check className={`h-3.5 w-3.5 2xl:h-4 2xl:w-4 ${movie.watched ? "" : "opacity-40"}`} />
                {movie.watched ? "Watched" : "Mark watched"}
              </button>
            ) : null}
            <div className="flex items-center gap-1 rounded-md bg-accent-muted px-2 py-1 text-xs font-medium text-accent 2xl:px-3 2xl:py-2 2xl:text-sm">
              <Star className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
              {formatRating(movie.tmdbRating)}
            </div>
        </div>

        {/* ── Genre pills ──────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted 2xl:text-sm">
          {movie.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              className="rounded-md border border-border px-2 py-0.5"
            >
              {genre}
            </span>
          ))}
          {notFound ? (
            <span className="rounded-md border border-accent-strong/40 px-2 py-0.5 text-accent">
              Not found
            </span>
          ) : null}
          {movie.errorMessage ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-error/30 px-2 py-0.5 text-error"
              title={movie.errorMessage}
            >
              <AlertTriangle className="h-3 w-3 2xl:h-4 2xl:w-4" />
              {errorLabel}
            </span>
          ) : null}
        </div>

        {/* ── Actions ──────────────────── */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => onPlay(movie)}
            disabled={playDisabled}
            className="cursor-pointer flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-background transition-all duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 2xl:px-3 2xl:py-2 2xl:text-sm"
          >
            <Play className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
            Play
          </button>
          {movie.youtubeTrailerKey ? (
            <a
              href={`https://www.youtube.com/watch?v=${movie.youtubeTrailerKey}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-border-hover hover:text-foreground 2xl:px-3 2xl:py-2 2xl:text-sm"
            >
              Trailer
            </a>
          ) : null}
        </div>
      </div>
      </div>
    </motion.div>
  );
}
