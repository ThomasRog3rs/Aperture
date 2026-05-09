import type { Movie } from "@/lib/types";

type MovieCastCrewCardProps = {
  movie: Movie;
};

export function MovieCastCrewCard({ movie }: MovieCastCrewCardProps) {
  if (
    (movie.directors ?? []).length === 0 &&
    (movie.writers ?? []).length === 0 &&
    (movie.actors ?? []).length === 0
  ) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted 2xl:text-base">
      <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
        Cast & Crew
      </p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {movie.directors.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">
              Director
            </p>
            <p className="text-foreground">{movie.directors.join(", ")}</p>
          </div>
        ) : null}
        {movie.writers.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Writer</p>
            <p className="text-foreground">{movie.writers.join(", ")}</p>
          </div>
        ) : null}
        {movie.actors.length > 0 ? (
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Cast</p>
            <p className="text-foreground leading-relaxed">{movie.actors.join(", ")}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

