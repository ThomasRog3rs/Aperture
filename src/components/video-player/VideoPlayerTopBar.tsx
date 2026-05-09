"use client";

import { Monitor, PictureInPicture2 } from "lucide-react";

type VideoPlayerTopBarProps = {
  title: string;
  showControls: boolean;
  onExternalPlayer?: () => void;
  isPipSupported: boolean;
  isPiP: boolean;
  onTogglePiP: () => void;
};

export function VideoPlayerTopBar({
  title,
  showControls,
  onExternalPlayer,
  isPipSupported,
  isPiP,
  onTogglePiP,
}: VideoPlayerTopBarProps) {
  return (
    <div
      className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 py-3 transition-opacity duration-300 ${
        showControls ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <span className="mr-4 truncate text-sm font-medium text-white">{title}</span>
      <div className="flex flex-shrink-0 items-center gap-1">
        {onExternalPlayer ? (
          <button
            onClick={onExternalPlayer}
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Open in external player"
          >
            <Monitor className="h-4 w-4" />
          </button>
        ) : null}
        {isPipSupported ? (
          <button
            onClick={onTogglePiP}
            className={`rounded-lg p-1.5 transition-colors ${
              isPiP
                ? "text-accent hover:bg-white/10"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
            title={isPiP ? "Exit picture-in-picture" : "Picture-in-picture"}
            aria-label={isPiP ? "Exit picture-in-picture" : "Picture-in-picture"}
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
