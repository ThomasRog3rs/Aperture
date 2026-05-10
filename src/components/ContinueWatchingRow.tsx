"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Video } from "lucide-react";
import { tmdbImageUrl } from "@/lib/format";
import type { ContinueWatchingItem } from "@/lib/types";

type ContinueWatchingRowProps = {
  items: ContinueWatchingItem[];
};

function formatTimeRemaining(progressSeconds: number, durationSeconds: number): string | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  const remaining = Math.max(0, durationSeconds - progressSeconds);
  const minutes = Math.round(remaining / 60);
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
}

function progressPercent(progressSeconds: number, durationSeconds: number): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Math.min(100, Math.round((progressSeconds / durationSeconds) * 100));
}

type ContinueWatchingCardProps = {
  item: ContinueWatchingItem;
};

function buildContinueWatchingHref(item: ContinueWatchingItem): string {
  if (item.type === "movie") {
    const params = new URLSearchParams({
      autoplay: "1",
      t: String(Math.max(0, Math.round(item.progressSeconds))),
    });
    return `/movies/${item.movie.id}?${params.toString()}`;
  }

  const params = new URLSearchParams({
    autoplay: "1",
    episodeId: item.episode.id,
    t: String(Math.max(0, Math.round(item.progressSeconds))),
  });
  return `/series/${item.series.id}?${params.toString()}`;
}

function ContinueWatchingCard({ item }: ContinueWatchingCardProps) {
  const isMovie = item.type === "movie";

  const posterPath = isMovie
    ? item.movie.posterPath
    : item.series.posterPath ?? item.season.posterPath;
  const posterUrl = tmdbImageUrl(posterPath, "w342");

  const title = isMovie ? item.movie.titleClean : item.series.titleClean;
  const subtitle = isMovie
    ? item.movie.year ? String(item.movie.year) : null
    : (() => {
        const sn = item.season.seasonNumber;
        const en = item.episode.episodeNumber;
        const epTitle = item.episode.titleClean;
        const prefix = sn != null && en != null ? `S${sn} E${en}` : null;
        if (prefix && epTitle) return `${prefix} · ${epTitle}`;
        return prefix ?? epTitle ?? null;
      })();

  const pct = progressPercent(item.progressSeconds, item.durationSeconds);
  const timeLeft = formatTimeRemaining(item.progressSeconds, item.durationSeconds);

  const href = buildContinueWatchingHref(item);

  const isXxx = isMovie ? item.movie.xxxRated : item.season.xxxRated;

  return (
    <div
      className={`group relative flex-none w-[160px] sm:w-[200px] 2xl:w-[240px] aspect-[2/3] overflow-hidden rounded-xl border border-white/5 shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-200 hover:border-white/20 hover:shadow-[0_8px_20px_rgba(0,0,0,0.55)] cursor-pointer ${isXxx ? "blur-xl select-none" : ""}`}
    >
      {/* Full-card link */}
      <Link href={href} className="absolute inset-0 z-20" aria-label={`Resume ${title}`} />

      {/* Poster */}
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={title}
          fill
          sizes="(max-width: 768px) 45vw, (max-width: 1200px) 22vw, 18vw"
          className="pointer-events-none object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-strong text-faint">
          <Video className="h-8 w-8" />
          <span className="text-xs uppercase tracking-[0.2em]">No Poster</span>
        </div>
      )}

      {/* Permanent bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

      {/* Title + subtitle */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[6px] z-10 px-2.5 pb-1.5">
        <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-white/90 drop-shadow">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-white/55 leading-tight">
            {subtitle}
          </p>
        )}
      </div>

      {/* Progress bar — sits above the title text, at the very bottom edge */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[4px] bg-white/15">
        {pct > 0 && (
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* Hover: Resume pill */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 text-[11px] font-bold text-black shadow-lg backdrop-blur-sm">
          <Play className="h-3 w-3 fill-current" />
          Resume
        </span>
      </div>

      {/* Time remaining badge — shown on hover, top-left */}
      {timeLeft && (
        <div className="pointer-events-none absolute left-1.5 top-1.5 z-30 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white/80 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
          {timeLeft}
        </div>
      )}
    </div>
  );
}

export function ContinueWatchingRow({ items }: ContinueWatchingRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const handleScroll = (direction: "left" | "right") => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth * 0.8
          : scrollLeft + clientWidth * 0.8;
      rowRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col w-full gap-3 py-4">
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 fill-accent text-accent" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Continue Watching
        </h2>
      </div>

      <div className="group relative w-full">
        {/* Left Arrow */}
        <button
          onClick={() => handleScroll("left")}
          className="pointer-events-none group-hover:pointer-events-auto absolute left-0 top-0 bottom-0 z-20 w-12 lg:w-16 bg-gradient-to-r from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start px-2 lg:px-4 text-white -ml-2 lg:-ml-4"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-8 w-8 drop-shadow-md transition-transform hover:scale-125" />
        </button>

        {/* Scroll Container */}
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto overflow-y-visible pb-8 pt-4 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <div
              key={item.type === "movie" ? item.movie.id : item.episode.id}
              className="snap-start"
            >
              <ContinueWatchingCard item={item} />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => handleScroll("right")}
          className="pointer-events-none group-hover:pointer-events-auto absolute right-0 top-0 bottom-0 z-20 w-12 lg:w-16 bg-gradient-to-l from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end px-2 lg:px-4 text-white -mr-2 lg:-mr-4"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-8 w-8 drop-shadow-md transition-transform hover:scale-125" />
        </button>
      </div>
    </div>
  );
}
