"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Layers, Star, Video } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatRating, tmdbImageUrl } from "@/lib/format";
import type { Season } from "@/lib/types";

type SeasonCardProps = {
  season: Season;
  /** When true, blur the card if season is XXX rated (e.g. on main browse). */
  blurIfXxxRated?: boolean;
};

export function SeasonCard({ season, blurIfXxxRated = false }: SeasonCardProps) {
  const isLargeScreen = useMediaQuery("(min-width: 1536px)");
  const posterSize = isLargeScreen ? "w780" : "w342";
  const posterUrl = tmdbImageUrl(season.posterPath, posterSize);
  const shouldBlur = blurIfXxxRated && season.xxxRated;
  const episodeCount = season.episodeCount ?? null;
  const seriesTarget = season.seriesId ?? season.id;

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(212,168,83,0.08)]"
    >
      <div className={shouldBlur ? "blur-xl select-none" : ""}>
        <Link
          href={`/series/${seriesTarget}`}
          aria-label={`Open season details for ${season.titleClean}`}
          className="relative block aspect-[2/3] w-full overflow-hidden bg-background"
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={season.titleClean}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, (min-width: 1536px) 20vw, 18vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-strong text-faint">
              <Video className="h-8 w-8" />
              <span className="text-xs uppercase tracking-[0.2em]">
                No Poster
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c0a] via-[#0d0c0a]/20 to-transparent opacity-85" />
        </Link>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <Link
            href={`/series/${seriesTarget}`}
            className="block min-w-0"
            aria-label={`Open season details for ${season.titleClean}`}
          >
            <h3 className="line-clamp-2 font-serif text-lg font-bold tracking-tight text-foreground 2xl:text-2xl">
              {season.titleClean}
            </h3>
            <p className="mt-1 text-xs text-muted 2xl:text-sm">
              {season.seasonNumber ? `Season ${season.seasonNumber}` : "Season"}
              {season.year ? ` · ${season.year}` : ""}
            </p>
          </Link>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-md bg-accent-muted px-2 py-1 text-xs font-medium text-accent 2xl:px-3 2xl:py-2 2xl:text-sm">
              <Star className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
              {formatRating(season.tmdbRating)}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted 2xl:px-3 2xl:py-2 2xl:text-sm">
              <Layers className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
              {episodeCount !== null ? `${episodeCount} ep` : "Episodes"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted 2xl:text-sm">
            {season.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="rounded-md border border-border px-2 py-0.5"
              >
                {genre}
              </span>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <Link
              href={`/series/${seriesTarget}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-background transition-all duration-200 hover:bg-accent-hover 2xl:px-3 2xl:py-2 2xl:text-sm"
            >
              View episodes
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
