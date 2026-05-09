import { Modal } from "@/components/Modal";
import { formatTimestamp } from "@/features/movie-detail/domain";
import type { Movie } from "@/lib/types";

type MovieInfoModalProps = {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
};

export function MovieInfoModal({ movie, isOpen, onClose }: MovieInfoModalProps) {
  if (!movie) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Database Details">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">id</dt>
          <dd className="mt-1 break-all text-foreground">{movie.id}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">tmdbId</dt>
          <dd className="mt-1 text-foreground">{movie.tmdbId ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">titleClean</dt>
          <dd className="mt-1 break-words text-foreground">{movie.titleClean}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">titleRaw</dt>
          <dd className="mt-1 break-words text-foreground">{movie.titleRaw}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">year</dt>
          <dd className="mt-1 text-foreground">{movie.year ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">runtimeMinutes</dt>
          <dd className="mt-1 text-foreground">{movie.runtimeMinutes ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">tmdbRating</dt>
          <dd className="mt-1 text-foreground">{movie.tmdbRating ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">youtubeTrailerKey</dt>
          <dd className="mt-1 break-all text-foreground">{movie.youtubeTrailerKey ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">folderPath</dt>
          <dd className="mt-1 break-all text-foreground">{movie.folderPath}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">filePath</dt>
          <dd className="mt-1 break-all text-foreground">{movie.filePath}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">fileSizeBytes</dt>
          <dd className="mt-1 text-foreground">{movie.fileSizeBytes}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">titleEditedAt</dt>
          <dd className="mt-1 text-foreground">{formatTimestamp(movie.titleEditedAt)}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">lastSyncedAt</dt>
          <dd className="mt-1 text-foreground">{formatTimestamp(movie.lastSyncedAt)}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">errorMessage</dt>
          <dd className="mt-1 break-words text-foreground">{movie.errorMessage ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">posterPath</dt>
          <dd className="mt-1 break-all text-foreground">{movie.posterPath ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">backdropPath</dt>
          <dd className="mt-1 break-all text-foreground">{movie.backdropPath ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">genres (combined)</dt>
          <dd className="mt-1 break-words text-foreground">
            {movie.genres.length > 0 ? movie.genres.join(", ") : "—"}
          </dd>
        </div>
      </dl>
    </Modal>
  );
}

