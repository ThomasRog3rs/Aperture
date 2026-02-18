"use client";

import { motion } from "framer-motion";
import type { Movie, Season, Series } from "@/lib/types";
import { MovieCard } from "@/components/MovieCard";
import { SeasonCard } from "@/components/SeasonCard";
import { SeriesCard } from "@/components/SeriesCard";

type MovieGridProps = {
  items: Array<
    | { type: "movie"; movie: Movie }
    | { type: "season"; season: Season }
    | { type: "series"; series: Series }
  >;
  onPlayMovie: (movie: Movie) => void;
  onRateMovie: (id: string, rating: number | null) => void;
  onWatchedMovie?: (id: string, watched: boolean) => void;
  /** When true, blur cards marked as XXX rated (main browse only; unblurred when searching/filtering). */
  blurXxxRated?: boolean;
};

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemEase: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: itemEase },
  },
};

export function MovieGrid({
  items,
  onPlayMovie,
  onRateMovie,
  onWatchedMovie,
  blurXxxRated = false,
}: MovieGridProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 2xl:gap-8"
    >
      {items.map((entry) => (
        <motion.div
          key={
            entry.type === "movie"
              ? entry.movie.id
              : entry.type === "series"
                ? entry.series.id
                : entry.season.id
          }
          variants={item}
        >
          {entry.type === "movie" ? (
            <MovieCard
              movie={entry.movie}
              onPlay={onPlayMovie}
              onRate={onRateMovie}
              onWatched={onWatchedMovie}
              blurIfXxxRated={blurXxxRated}
            />
          ) : entry.type === "series" ? (
            <SeriesCard series={entry.series} blurIfXxxRated={blurXxxRated} />
          ) : (
            <SeasonCard season={entry.season} blurIfXxxRated={blurXxxRated} />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
