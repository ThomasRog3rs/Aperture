"use client";

import type { Movie } from "@/lib/types";
import { MovieCard } from "@/components/MovieCard";

type MovieGridProps = {
  movies: Movie[];
  onPlay: (movie: Movie) => void;
  onRate: (id: string, rating: number | null) => void;
};

export function MovieGrid({ movies, onPlay, onRate }: MovieGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onPlay={onPlay}
          onRate={onRate}
        />
      ))}
    </div>
  );
}

