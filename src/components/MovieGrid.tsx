"use client";

import { motion } from "framer-motion";
import type { Movie } from "@/lib/types";
import { MovieCard } from "@/components/MovieCard";

type MovieGridProps = {
  movies: Movie[];
  onPlay: (movie: Movie) => void;
  onRate: (id: string, rating: number | null) => void;
  onWatched?: (id: string, watched: boolean) => void;
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

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export function MovieGrid({ movies, onPlay, onRate, onWatched, blurXxxRated = false }: MovieGridProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {movies.map((movie) => (
        <motion.div key={movie.id} variants={item}>
          <MovieCard
            movie={movie}
            onPlay={onPlay}
            onRate={onRate}
            onWatched={onWatched}
            blurIfXxxRated={blurXxxRated}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
