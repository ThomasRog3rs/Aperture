"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Plus, Info } from "lucide-react";
import { tmdbImageUrl, formatRuntime } from "@/lib/format";
import type { Movie, Series } from "@/lib/types";

type HeroFeaturedProps = {
  item: { type: "movie"; movie: Movie } | { type: "series"; series: Series } | null;
  onPlay: (movie: Movie) => void;
};

export function HeroFeatured({ item, onPlay }: HeroFeaturedProps) {
  if (!item) return null;

  const isMovie = item.type === "movie";
  const data = isMovie ? item.movie : item.series;
  
  // Try to use backdrop, fallback to poster
  const backdropUrl = tmdbImageUrl(isMovie ? item.movie.backdropPath : item.series.seasons[0]?.backdropPath, "original") || tmdbImageUrl(data.posterPath, "w780");
  
  const title = isMovie ? item.movie.titleClean : item.series.titleClean;
  const year = isMovie ? item.movie.year : item.series.seasons[0]?.year;
  const genres = isMovie ? item.movie.genres : item.series.seasons[0]?.genres || [];
  
  // Ensure we have a string ID for the link
  const detailUrl = isMovie ? `/movies/${data.id}` : `/series/${data.id}`;

  return (
    <div className="relative w-full h-[60vh] sm:h-[70vh] lg:h-[80vh] flex items-end pb-12 sm:pb-24">
      {/* Background Image */}
      {backdropUrl && (
        <div className="absolute inset-0 z-0">
          <Image
            src={backdropUrl}
            alt={title}
            fill
            priority
            className="object-cover"
          />
          {/* Gradients to fade into background */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 w-full px-6 lg:px-12 max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6">
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white max-w-3xl drop-shadow-lg">
          {title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base text-white/80 font-medium drop-shadow-md">
          {year && <span>{year}</span>}
          {isMovie && item.movie.runtimeMinutes && (
            <>
              <span>•</span>
              <span>{formatRuntime(item.movie.runtimeMinutes)}</span>
            </>
          )}
          {!isMovie && (
            <>
              <span>•</span>
              <span>{item.series.seasonCount} Season{item.series.seasonCount !== 1 && 's'}</span>
            </>
          )}
          {genres.length > 0 && (
            <>
              <span>•</span>
              <span>{genres.slice(0, 3).join(", ")}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2">
          {isMovie ? (
            <button
              onClick={() => onPlay(item.movie)}
              disabled={!item.movie.filePath}
              className="flex items-center gap-2 px-6 py-2.5 sm:px-8 sm:py-3 rounded-lg bg-white text-black font-semibold text-sm sm:text-base hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-5 w-5 fill-current" />
              Play
            </button>
          ) : (
            <Link
              href={detailUrl}
              className="flex items-center gap-2 px-6 py-2.5 sm:px-8 sm:py-3 rounded-lg bg-white text-black font-semibold text-sm sm:text-base hover:bg-white/90 transition-colors"
            >
              <Play className="h-5 w-5 fill-current" />
              View Seasons
            </Link>
          )}
          
          <Link
            href={detailUrl}
            className="flex items-center gap-2 px-6 py-2.5 sm:px-8 sm:py-3 rounded-lg bg-surface-strong/80 backdrop-blur-sm text-white font-semibold text-sm sm:text-base hover:bg-surface-strong transition-colors border border-white/10"
          >
            <Info className="h-5 w-5" />
            More Info
          </Link>
        </div>
      </div>
    </div>
  );
}
