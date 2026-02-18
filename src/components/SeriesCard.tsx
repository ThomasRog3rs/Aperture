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

type SeriesCardProps = {
  series: Series;
  /** When true, blur the card if any season is XXX rated (e.g. on main browse). */
  blurIfXxxRated?: boolean;
};

export function SeriesCard({ series, blurIfXxxRated = false }: SeriesCardProps) {
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

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(212,168,83,0.08)]"
    >
      <div className={`flex min-h-0 flex-1 flex-col ${shouldBlur ? "blur-xl select-none" : ""}`}>
        <Link
          href={`/series/${series.id}`}
          aria-label={`Open series details for ${series.titleClean}`}
          className="relative block aspect-[2/3] w-full shrink-0 overflow-hidden bg-background"
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={series.titleClean}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, (min-width: 1536px) 20vw, 18vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-strong text-faint">
              <Video className="h-8 w-8" />
              <span className="text-xs uppercase tracking-[0.2em]">
                No Poster
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c0a] via-[#0d0c0a]/20 to-transparent opacity-85" />
        </Link>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <Link
            href={`/series/${series.id}`}
            className="block min-w-0"
            aria-label={`Open series details for ${series.titleClean}`}
          >
            <h3 className="line-clamp-2 font-serif text-lg font-bold tracking-tight text-foreground 2xl:text-2xl">
              {series.titleClean}
            </h3>
          </Link>
          {directorLabel ? (
            <p className="text-xs text-faint 2xl:text-sm">{directorLabel}</p>
          ) : null}

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted 2xl:px-3 2xl:py-2 2xl:text-sm">
              <Layers className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
              {seasonsLabel}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <Link
              href={`/series/${series.id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-background transition-all duration-200 hover:bg-accent-hover 2xl:px-3 2xl:py-2 2xl:text-sm"
            >
              View seasons
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
