import { formatTimestamp } from "@/features/series-detail/domain";
import { Modal } from "@/components/Modal";
import type { Series } from "@/lib/types";

export type SeriesInfoModalProps = {
  series: Series | null;
  isOpen: boolean;
  onClose: () => void;
};

export function SeriesInfoModal({ series, isOpen, onClose }: SeriesInfoModalProps) {
  if (!series) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Database Details">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">id</dt>
          <dd className="mt-1 break-all text-foreground">{series.id}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">seasonCount</dt>
          <dd className="mt-1 text-foreground">{series.seasonCount}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">titleClean</dt>
          <dd className="mt-1 break-words text-foreground">{series.titleClean}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">posterPath</dt>
          <dd className="mt-1 break-all text-foreground">{series.posterPath ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">seasons</dt>
          <dd className="mt-1 text-foreground">{series.seasons.length}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">latestSeasonSync</dt>
          <dd className="mt-1 text-foreground">
            {series.seasons[0] ? formatTimestamp(series.seasons[0].lastSyncedAt) : "—"}
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
