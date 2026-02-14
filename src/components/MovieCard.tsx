"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Play, Star, AlertTriangle, Video } from "lucide-react";
import { formatRating, formatRuntime, tmdbImageUrl } from "@/lib/format";
import type { Movie } from "@/lib/types";

type MovieCardProps = {
  movie: Movie;
  onPlay: (movie: Movie) => void;
  onRate: (id: string, rating: number | null) => void;
};

export function MovieCard({ movie, onPlay, onRate }: MovieCardProps) {
  const posterUrl = tmdbImageUrl(movie.posterPath, "w342");
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
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-900">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.titleClean}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 18vw"
            className="object-cover transition duration-500 group-hover:scale-105"
            onError={handlePosterError}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-neutral-800 to-neutral-900 text-neutral-400">
            <Video className="h-8 w-8" />
            <span className="text-xs uppercase tracking-[0.2em]">
              No Poster
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80" />
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              {movie.titleClean}
            </h3>
            <p className="text-xs text-neutral-400">
              {movie.year ?? "—"} · {formatRuntime(movie.runtimeMinutes)}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-neutral-200">
            <Star className="h-3.5 w-3.5 text-amber-300" />
            {formatRating(movie.tmdbRating)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          {movie.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              className="rounded-full border border-white/10 px-2 py-1"
            >
              {genre}
            </span>
          ))}
          {notFound ? (
            <span className="rounded-full border border-amber-500/40 px-2 py-1 text-amber-200">
              Not found
            </span>
          ) : null}
          {movie.errorMessage ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 px-2 py-1 text-rose-200"
              title={movie.errorMessage}
            >
              <AlertTriangle className="h-3 w-3" />
              {errorLabel}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => onPlay(movie)}
            disabled={playDisabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-200 hover:shadow-[0_12px_24px_rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:bg-white/40 disabled:shadow-none"
          >
            <Play className="h-3.5 w-3.5" />
            Play
          </button>
          {movie.youtubeTrailerKey ? (
            <a
              href={`https://www.youtube.com/watch?v=${movie.youtubeTrailerKey}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 px-3 py-2 text-xs text-neutral-200 transition hover:border-white/30"
            >
              Trailer
            </a>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Personal rating</span>
          <select
            value={movie.personalRating ?? ""}
            onChange={(event) =>
              onRate(
                movie.id,
                event.target.value === "" ? null : Number(event.target.value)
              )
            }
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-100"
          >
            <option value="">—</option>
            {Array.from({ length: 11 }).map((_, index) => (
              <option key={index} value={index}>
                {index}
              </option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  );
}

