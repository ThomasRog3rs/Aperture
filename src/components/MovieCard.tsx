"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Play, Star, AlertTriangle, Video } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatRating, formatRuntime, tmdbImageUrl } from "@/lib/format";
import type { Movie } from "@/lib/types";

function formatPeopleLabel(people: string[], singular: string, plural: string) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 2);
  const suffix = people.length > shown.length ? ` +${people.length - shown.length}` : "";
  const label = people.length === 1 ? singular : plural;
  return `${label}: ${shown.join(", ")}${suffix}`;
}

// Variant definitions — "hidden"/"show" map to the MovieGrid stagger states so
// the card's children inherit the entrance animation while still responding to
// the card-level "hovered" variant propagated by whileHover.
const posterVariants = {
  hidden: { scale: 1 },
  show: { scale: 1 },
  hovered: { scale: 1 },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 0 },
  hovered: { opacity: 1, transition: { duration: 0.25 } },
};

const restingTitleVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
  hovered: { opacity: 0, transition: { duration: 0.15 } },
};

const panelVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 20, opacity: 0 },
  hovered: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 320, damping: 32, delay: 0.04 },
  },
};

type MovieCardProps = {
  movie: Movie;
  onPlay: (movie: Movie) => void;
  onWatched?: (id: string, watched: boolean) => void;
  /** When true, blur the card if movie is XXX rated (e.g. on main browse, not when searching/filtering). */
  blurIfXxxRated?: boolean;
  variant?: "full" | "compact";
};

export function MovieCard({ movie, onPlay, onWatched, blurIfXxxRated = false, variant = "full" }: MovieCardProps) {
  const isLargeScreen = useMediaQuery("(min-width: 1536px)");
  const posterSize = isLargeScreen ? "w780" : "w342";
  const posterUrl = tmdbImageUrl(movie.posterPath, posterSize);
  const shouldBlur = blurIfXxxRated && movie.xxxRated;
  const fileMissing = movie.errorMessage?.toLowerCase().includes("no video file") ?? false;
  const playDisabled = !movie.filePath || fileMissing;
  const notFound = !movie.tmdbId;
  const errorLabel = fileMissing ? "Missing file" : "Metadata unavailable";
  const directorLabel = formatPeopleLabel(movie.directors ?? [], "Director", "Directors");

  const handlePosterError = () => {
    console.warn("[Aperture] Poster failed to load", {
      title: movie.titleClean,
      posterPath: movie.posterPath,
      posterUrl,
      tmdbId: movie.tmdbId,
    });
  };

  // ── Compact variant (ContentRow) ──────────────────────────────────────────
  // Poster + title + badges only. Hover = subtle red border glow, no panel reveal.
  if (variant === "compact") {
    return (
      <motion.div
        className={`group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border border-white/5 shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-200 hover:border-white/20 hover:shadow-[0_8px_20px_rgba(0,0,0,0.55)] ${shouldBlur ? "blur-xl select-none" : ""}`}
      >
        <Link
          href={`/movies/${movie.id}`}
          aria-label={`Open details for ${movie.titleClean}`}
          className="absolute inset-0 z-20"
        />

        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.titleClean}
            fill
            sizes="(max-width: 768px) 45vw, (max-width: 1200px) 22vw, 18vw"
            className="pointer-events-none object-cover"
            onError={handlePosterError}
          />
        ) : (
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-strong text-faint">
            <Video className="h-8 w-8" />
            <span className="text-xs uppercase tracking-[0.2em]">No Poster</span>
          </div>
        )}

        {/* Bottom gradient + title */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2.5 pb-2.5 pt-10">
          <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">
            {movie.titleClean}
          </h3>
        </div>

        {/* Rating badge — top right */}
        {movie.tmdbRating ? (
          <div className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
            <Star className="h-2.5 w-2.5 text-amber-400" />
            {formatRating(movie.tmdbRating)}
          </div>
        ) : null}

        {/* Watched indicator — top left */}
        {movie.watched ? (
          <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex items-center justify-center rounded-full bg-emerald-500/20 p-1 backdrop-blur-md ring-1 ring-emerald-500/30">
            <Check className="h-2.5 w-2.5 text-emerald-400" />
          </div>
        ) : null}
      </motion.div>
    );
  }

  // ── Full variant (MovieGrid) ───────────────────────────────────────────────
  // Full-bleed poster. Hover reveals darkened overlay + sliding metadata panel.
  // whileHover="hovered" propagates to children that define a "hovered" variant.
  return (
    <motion.div
      initial="show"
      animate="show"
      whileHover="hovered"
      className={`group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-200 hover:border-white/20 hover:shadow-[0_14px_36px_rgba(0,0,0,0.6)] ${shouldBlur ? "blur-xl select-none" : ""}`}
    >
      {/* Full-card navigation link (below all interactive children) */}
      <Link
        href={`/movies/${movie.id}`}
        aria-label={`Open details for ${movie.titleClean}`}
        className="absolute inset-0 z-10"
      />

      {/* Poster — scales on hover */}
      {posterUrl ? (
        <motion.div
          className="pointer-events-none absolute inset-0 transition-transform duration-500"
          variants={posterVariants}
          transition={{ duration: 0.5 }}
        >
          <Image
            src={posterUrl}
            alt={movie.titleClean}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, (min-width: 1536px) 20vw, 18vw"
            className="object-cover"
            onError={handlePosterError}
          />
        </motion.div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-strong text-faint">
          <Video className="h-8 w-8" />
          <span className="text-xs uppercase tracking-[0.2em]">No Poster</span>
        </div>
      )}

      {/* Permanent thin base gradient — title always readable at rest */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />

      {/* Watched badge — top left */}
      {movie.watched ? (
        <div className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 backdrop-blur-md ring-1 ring-emerald-500/30">
          <Check className="h-3 w-3" />
          Watched
        </div>
      ) : null}

      {/* Rating badge — top right */}
      {movie.tmdbRating ? (
        <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
          <Star className="h-3 w-3 text-amber-400" />
          {formatRating(movie.tmdbRating)}
        </div>
      ) : null}

      {/* Resting title — fades out when hovered so the panel takes over */}
      <motion.div
        variants={restingTitleVariants}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-12"
      >
        <h3 className="line-clamp-2 font-serif text-sm font-bold leading-snug text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] 2xl:text-base">
          {movie.titleClean}
        </h3>
      </motion.div>

      {/* Hover: darkening overlay */}
      <motion.div
        variants={overlayVariants}
        className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/95 via-black/65 to-black/25"
      />

      {/* Hover: metadata panel slides up */}
      <motion.div
        variants={panelVariants}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2.5 px-3 pb-3 pt-4 group-hover:pointer-events-auto"
      >
        <Link
          href={`/movies/${movie.id}`}
          aria-label={`Open details for ${movie.titleClean}`}
          className="block min-w-0"
          tabIndex={-1}
        >
          <h3 className="line-clamp-2 font-serif text-sm font-bold leading-snug text-white 2xl:text-base">
            {movie.titleClean}
          </h3>
          <p className="mt-0.5 text-[11px] text-white/60 2xl:text-xs">
            {movie.year ?? "—"} · {formatRuntime(movie.runtimeMinutes)}
          </p>
          {directorLabel ? (
            <p className="text-[11px] text-white/50 2xl:text-xs">{directorLabel}</p>
          ) : null}
        </Link>

        {/* Genre pills — glassmorphism style */}
        {(movie.genres.length > 0 || notFound || movie.errorMessage) ? (
          <div className="flex flex-wrap gap-1">
            {movie.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur-sm ring-1 ring-white/15"
              >
                {genre}
              </span>
            ))}
            {notFound ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent backdrop-blur-sm ring-1 ring-accent/30">
                Not found
              </span>
            ) : null}
            {movie.errorMessage ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-medium text-error backdrop-blur-sm ring-1 ring-error/30"
                title={movie.errorMessage}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {errorLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPlay(movie); }}
            disabled={playDisabled}
            aria-label={`Play ${movie.titleClean}`}
            className="flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 2xl:text-xs"
          >
            <Play className="h-3 w-3 fill-current" />
            Play
          </button>

          {onWatched ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onWatched(movie.id, !movie.watched); }}
              aria-label={movie.watched ? "Mark as unwatched" : "Mark as watched"}
              title={movie.watched ? "Mark as unwatched" : "Mark as watched"}
              className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg transition-colors duration-200 ${
                movie.watched
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30"
                  : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {movie.youtubeTrailerKey ? (
            <a
              href={`https://www.youtube.com/watch?v=${movie.youtubeTrailerKey}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Watch trailer for ${movie.titleClean}`}
              className="flex min-h-[36px] items-center rounded-lg bg-white/10 px-2.5 py-2 text-[11px] text-white/60 transition-colors hover:bg-white/20 hover:text-white 2xl:text-xs"
            >
              Trailer
            </a>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
