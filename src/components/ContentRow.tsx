"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MovieCard } from "./MovieCard";
import { SeriesCard } from "./SeriesCard";
import { SeasonCard } from "./SeasonCard";
import type { Movie, Season, Series } from "@/lib/types";

type ContentRowProps = {
  title: string;
  items: Array<
    | { type: "movie"; movie: Movie }
    | { type: "season"; season: Season }
    | { type: "series"; series: Series }
  >;
  onPlayMovie?: (movie: Movie) => void;
  onWatchedMovie?: (id: string, watched: boolean) => void;
  blurXxxRated?: boolean;
};

export function ContentRow({
  title,
  items,
  onPlayMovie,
  onWatchedMovie,
  blurXxxRated = false,
}: ContentRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: "left" | "right") => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === "left" ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      rowRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  if (items.length === 0) return null;

  return (
    <div className={`flex flex-col w-full ${title ? "gap-3 py-4" : "pt-0 pb-4"}`}>
      {title ? (
        <h2 className="px-6 lg:px-12 text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
      ) : null}
      <div className="group relative w-full">
        {/* Left Arrow */}
        <button
          onClick={() => handleScroll("left")}
          className="absolute left-0 top-0 bottom-0 z-20 w-12 lg:w-16 bg-gradient-to-r from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start px-2 lg:px-4 text-white disabled:opacity-0"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-8 w-8 drop-shadow-md transition-transform hover:scale-125" />
        </button>

        {/* Scroll Container */}
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto overflow-y-visible px-6 lg:px-12 pb-8 pt-4 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((entry) => (
            <div
              key={
                entry.type === "movie"
                  ? entry.movie.id
                  : entry.type === "series"
                  ? entry.series.id
                  : entry.season.id
              }
              className="w-[180px] sm:w-[220px] 2xl:w-[260px] flex-none snap-start"
            >
              {entry.type === "movie" ? (
                <MovieCard
                  movie={entry.movie}
                  onPlay={onPlayMovie || (() => {})}
                  onWatched={onWatchedMovie}
                  blurIfXxxRated={blurXxxRated}
                  variant="compact"
                />
              ) : entry.type === "series" ? (
                <SeriesCard
                  series={entry.series}
                  blurIfXxxRated={blurXxxRated}
                  variant="compact"
                />
              ) : (
                <SeasonCard
                  season={entry.season}
                  blurIfXxxRated={blurXxxRated}
                />
              )}
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => handleScroll("right")}
          className="absolute right-0 top-0 bottom-0 z-20 w-12 lg:w-16 bg-gradient-to-l from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end px-2 lg:px-4 text-white"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-8 w-8 drop-shadow-md transition-transform hover:scale-125" />
        </button>
      </div>
    </div>
  );
}
