import { Image as ImageIcon, RefreshCw, Save, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { Series } from "@/lib/types";
import type { FolderImage } from "./series-detail.types";

type SeriesEditModalProps = {
  series: Series | null;
  isOpen: boolean;
  title: string;
  posterInput: string;
  folderImages: FolderImage[];
  folderImagesLoading: boolean;
  folderImagesError: string | null;
  selectedFolderImage: string;
  saving: boolean;
  refreshing: boolean;
  deleting: boolean;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onPosterInputChange: (value: string) => void;
  onSelectedFolderImageChange: (value: string) => void;
  onUseSelectedFolderImage: () => void;
  onSave: () => void;
  onRefreshPoster: () => void;
  onClearPoster: () => void;
  onDelete: () => void;
};

export function SeriesEditModal({
  series,
  isOpen,
  title,
  posterInput,
  folderImages,
  folderImagesLoading,
  folderImagesError,
  selectedFolderImage,
  saving,
  refreshing,
  deleting,
  onClose,
  onTitleChange,
  onPosterInputChange,
  onSelectedFolderImageChange,
  onUseSelectedFolderImage,
  onSave,
  onRefreshPoster,
  onClearPoster,
  onDelete,
}: SeriesEditModalProps) {
  if (!series) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Series">
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
              placeholder="Series title"
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
                  onChange={(event) => onSelectedFolderImageChange(event.target.value)}
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

          <div className="mt-2 flex flex-wrap items-center gap-3">
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
          <p className="font-serif text-lg font-medium text-foreground">Options</p>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-transparent px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Removing..." : "Remove from library"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
