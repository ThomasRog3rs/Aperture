import { Modal } from "@/components/Modal";
import type { Series } from "@/lib/types";

type SeriesInfoModalProps = {
  series: Series | null;
  isOpen: boolean;
  onClose: () => void;
};

export function SeriesInfoModal({
  series,
  isOpen,
  onClose,
}: SeriesInfoModalProps) {
  if (!series) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Database Details">
      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">id</dt>
          <dd className="mt-1 break-all text-foreground">{series.id}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">
            titleClean
          </dt>
          <dd className="mt-1 break-words text-foreground">{series.titleClean}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">
            seasonCount
          </dt>
          <dd className="mt-1 text-foreground">{series.seasonCount}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-faint">
            posterPath
          </dt>
          <dd className="mt-1 break-all text-foreground">
            {series.posterPath ?? "—"}
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
