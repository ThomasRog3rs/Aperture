export type SeriesCastCrewCardProps = {
  directors: string[];
  writers: string[];
  actors: string[];
};

export function SeriesCastCrewCard({
  directors,
  writers,
  actors,
}: SeriesCastCrewCardProps) {
  if (directors.length === 0 && writers.length === 0 && actors.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
      <p className="font-serif text-lg font-medium text-foreground">Cast & Crew</p>
      <div className="mt-4 space-y-4">
        {directors.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Director</p>
            <p className="text-foreground">{directors.join(", ")}</p>
          </div>
        ) : null}
        {writers.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Writer</p>
            <p className="text-foreground">{writers.join(", ")}</p>
          </div>
        ) : null}
        {actors.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Cast</p>
            <p className="text-foreground">{actors.join(", ")}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
