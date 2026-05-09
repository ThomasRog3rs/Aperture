"use client";

import type { VideoPlayerEpisodeTarget } from "@/components/video-player/types";

type PlayerHoverCardProps = {
  label: string;
  target?: VideoPlayerEpisodeTarget;
  align?: "left" | "right";
};

export function PlayerHoverCard({
  label,
  target,
  align = "right",
}: PlayerHoverCardProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-full z-30 mb-3 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface/95 p-4 text-left shadow-2xl backdrop-blur-xl transition-all duration-200 ${
        align === "left" ? "left-0" : "right-0"
      } translate-y-2 opacity-0 peer-hover:translate-y-0 peer-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100`}
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-faint">{label}</p>
      {target ? (
        <div className="mt-2 space-y-1">
          <p className="text-base font-semibold text-foreground">{target.title}</p>
          <p className="text-sm text-muted">{target.subtitle}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No episode available.</p>
      )}
    </div>
  );
}
