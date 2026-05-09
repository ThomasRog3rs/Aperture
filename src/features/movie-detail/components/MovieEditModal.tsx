import { Image as ImageIcon, RefreshCw, Save, Tag, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { FolderImage } from "@/features/movie-detail/types";
import type { Movie } from "@/lib/types";

type MovieEditModalProps = {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onTitleChange: (value: string) => void;
  posterInput: string;
  onPosterInputChange: (value: string) => void;
  folderImages: FolderImage[];
  folderImagesLoading: boolean;
  folderImagesError: string | null;
  selectedFolderImage: string;
  onSelectedFolderImageChange: (value: string) => void;
  onUseSelectedFolderImage: () => void;
  saving: boolean;
  onSave: () => void;
  refreshing: boolean;
  onRefreshPoster: () => void;
  onClearPoster: () => void;
  userGenres: string[];
  savingGenres: boolean;
  onRemoveGenre: (genreName: string) => void;
  genreInput: string;
  onGenreInputChange: (value: string) => void;
  onAddGenre: () => void;
  savingXxxRated: boolean;
  onXxxRatedChange: (checked: boolean) => void;
  deleting: boolean;
  onDelete: () => void;
};

export function MovieEditModal({
  movie,
  isOpen,
  onClose,
  title,
  onTitleChange,
  posterInput,
  onPosterInputChange,
  folderImages,
  folderImagesLoading,
  folderImagesError,
  selectedFolderImage,
  onSelectedFolderImageChange,
  onUseSelectedFolderImage,
  saving,
  onSave,
  refreshing,
  onRefreshPoster,
  onClearPoster,
  userGenres,
  savingGenres,
  onRemoveGenre,
  genreInput,
  onGenreInputChange,
  onAddGenre,
  savingXxxRated,
  onXxxRatedChange,
  deleting,
  onDelete,
}: MovieEditModalProps) {
  if (!movie) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Movie">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm text-muted">
            <span className="text-xs uppercase tracking-[0.2em] text-faint">
              Display title
            </span>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
              placeholder="Movie title"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-muted">
            <span className="text-xs uppercase tracking-[0.2em] text-faint">
              Poster URL
            </span>
            <input
              value={posterInput}
              onChange={(event) => onPosterInputChange(event.target.value)}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
              placeholder="https://..."
            />
          </label>

          {folderImagesError ? (
            <div className="rounded-lg border border-border bg-background/40 px-4 py-3 text-xs text-muted">
              {folderImagesError}
            </div>
          ) : folderImagesLoading ? (
            <div className="rounded-lg border border-border bg-background/40 px-4 py-3 text-xs text-muted">
              Scanning folder for images...
            </div>
          ) : folderImages.length > 0 ? (
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-faint">
                <ImageIcon className="h-3.5 w-3.5" />
                Poster from folder
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  value={selectedFolderImage}
                  onChange={(event) =>
                    onSelectedFolderImageChange(event.target.value)
                  }
                  className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
                >
                  {folderImages.map((image) => (
                    <option key={image.url} value={image.url}>
                      {image.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onUseSelectedFolderImage}
                  disabled={!selectedFolderImage}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use selected
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              onClick={onRefreshPoster}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Fetching..." : "Fetch from OMDb"}
            </button>
            <button
              onClick={onClearPoster}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
            >
              Clear poster
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-accent" />
            <p className="font-serif text-lg font-medium text-foreground">Genres</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint">Your custom genres</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {userGenres.length > 0 ? (
                userGenres.map((genreName) => (
                  <span
                    key={genreName}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1 text-foreground"
                  >
                    {genreName}
                    <button
                      onClick={() => onRemoveGenre(genreName)}
                      disabled={savingGenres}
                      className="text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted">—</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                value={genreInput}
                onChange={(event) => onGenreInputChange(event.target.value)}
                className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
                placeholder="Add a genre (e.g. Noir)"
              />
              <button
                onClick={onAddGenre}
                disabled={savingGenres || !genreInput.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingGenres ? "Saving..." : "Add genre"}
              </button>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex flex-col gap-4">
          <p className="font-serif text-lg font-medium text-foreground">Options</p>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={movie.xxxRated ?? false}
              onChange={(event) => onXxxRatedChange(event.target.checked)}
              disabled={savingXxxRated}
              className="h-4 w-4 rounded border-border bg-background text-accent focus:ring-accent/40"
            />
            <span>
              XXX rated{" "}
              <span className="ml-1.5 text-xs text-faint">
                (blurred on main screen)
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-transparent px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Removing..." : "Remove from library"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

