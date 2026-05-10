"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Layers, Video } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { tmdbImageUrl } from "@/lib/format";
import type { Series } from "@/lib/types";

function formatPeopleLabel(people: string[], singular: string, plural: string) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 2);
  const suffix =
    people.length > shown.length ? ` +${people.length - shown.length}` : "";
  const label = people.length === 1 ? singular : plural;
  return `${label}: ${shown.join(", ")}${suffix}`;
}

const posterVariants = {
  hidden: { scale: 1 },
  show: { scale: 1 },
  hovered: { scale: 1 },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 0 },
  hovered: { opacity: 1, transition: { duration: 0.25 } },
};

const restingTitleVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
  hovered: { opacity: 0, transition: { duration: 0.15 } },
};

const panelVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 20, opacity: 0 },
  hovered: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 320, damping: 32, delay: 0.04 },
  },
};

type SeriesCardProps = {
  series: Series;
  /** When true, blur the card if any season is XXX rated (e.g. on main browse). */
  blurIfXxxRated?: boolean;
  variant?: "full" | "compact";
};

export function SeriesCard({ series, blurIfXxxRated = false, variant = "full" }: SeriesCardProps) {
  const isLargeScreen = useMediaQuery("(min-width: 1536px)");
  const posterSize = isLargeScreen ? "w780" : "w342";
  const posterUrl = tmdbImageUrl(series.posterPath, posterSize);
  const seasonsLabel = `${series.seasonCount} ${
    series.seasonCount === 1 ? "season" : "seasons"
  }`;
  const shouldBlur =
    blurIfXxxRated && series.seasons.some((season) => season.xxxRated);
  const directorLabel = formatPeopleLabel(
    Array.from(
      new Map(
        series.seasons
          .flatMap((season) => season.directors ?? [])
          .map((name) => [name.toLowerCase(), name])
      ).values()
    ),
    "Director",
    "Directors"
  );

  // Collect unique genres across all seasons
  const genres = Array.from(
    new Set(series.seasons.flatMap((s) => s.genres ?? []))
  ).slice(0, 3);

  // ── Compact variant (ContentRow) ──────────────────────────────────────────
  if (variant === "compact") {
    return (
      <motion.div
        className={`group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border border-white/5 shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-200 hover:border-white/20 hover:shadow-[0_8px_20px_rgba(0,0,0,0.55)] ${shouldBlur ? "blur-xl select-none" : ""}`}
      >
        <Link
          href={`/series/${series.id}`}
          aria-label={`Open series details for ${series.titleClean}`}
          className="absolute inset-0 z-20"
        />

        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={series.titleClean}
            fill
            sizes="(max-width: 768px) 45vw, (max-width: 1200px) 22vw, 18vw"
            className="pointer-events-none object-cover"
          />
        ) : (
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-strong text-faint">
            <Video className="h-8 w-8" />
            <span className="text-xs uppercase tracking-[0.2em]">No Poster</span>
          </div>
        )}

        {/* Bottom gradient + title */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2.5 pb-2.5 pt-10">
          <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">
            {series.titleClean}
          </h3>
        </div>

        {/* Season count badge — top right */}
        <div className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
          <Layers className="h-2.5 w-2.5" />
          {series.seasonCount}
        </div>
      </motion.div>
    );
  }

  // ── Full variant (MovieGrid) ───────────────────────────────────────────────
  return (
    <motion.div
      initial="show"
      animate="show"
      whileHover="hovered"
      className={`group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-200 hover:border-white/20 hover:shadow-[0_14px_36px_rgba(0,0,0,0.6)] ${shouldBlur ? "blur-xl select-none" : ""}`}
    >
      <Link
        href={`/series/${series.id}`}
        aria-label={`Open series details for ${series.titleClean}`}
        className="absolute inset-0 z-10"
      />

      {/* Poster */}
      {posterUrl ? (
        <motion.div
          className="pointer-events-none absolute inset-0"
          variants={posterVariants}
          transition={{ duration: 0.5 }}
        >
          <Image
            src={posterUrl}
            alt={series.titleClean}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, (min-width: 1536px) 20vw, 18vw"
            className="object-cover"
          />
        </motion.div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-strong text-faint">
          <Video className="h-8 w-8" />
          <span className="text-xs uppercase tracking-[0.2em]">No Poster</span>
        </div>
      )}

      {/* Permanent thin base gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />

      {/* Season count badge — top right */}
      <div className="pointer-events-none absolute right-2 top-2 z-30 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
        <Layers className="h-3 w-3" />
        {seasonsLabel}
      </div>

      {/* Resting title */}
      <motion.div
        variants={restingTitleVariants}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-12"
      >
        <h3 className="line-clamp-2 font-serif text-sm font-bold leading-snug text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] 2xl:text-base">
          {series.titleClean}
        </h3>
      </motion.div>

      {/* Hover: darkening overlay */}
      <motion.div
        variants={overlayVariants}
        className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/95 via-black/65 to-black/25"
      />

      {/* Hover: metadata panel */}
      <motion.div
        variants={panelVariants}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2.5 px-3 pb-3 pt-4 group-hover:pointer-events-auto"
      >
        <Link
          href={`/series/${series.id}`}
          aria-label={`Open series details for ${series.titleClean}`}
          className="block min-w-0"
          tabIndex={-1}
        >
          <h3 className="line-clamp-2 font-serif text-sm font-bold leading-snug text-white 2xl:text-base">
            {series.titleClean}
          </h3>
          {directorLabel ? (
            <p className="mt-0.5 text-[11px] text-white/50 2xl:text-xs">{directorLabel}</p>
          ) : null}
        </Link>

        {/* Genre pills */}
        {genres.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur-sm ring-1 ring-white/15"
              >
                {genre}
              </span>
            ))}
          </div>
        ) : null}

        {/* Action */}
        <div className="flex items-center gap-2">
          <Link
            href={`/series/${series.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-h-[36px] flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-accent-hover 2xl:text-xs"
          >
            View seasons
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
