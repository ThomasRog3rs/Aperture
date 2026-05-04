"use client";

import { X } from "lucide-react";

type FilterIndicatorProps = {
  query: string;
  genre: string;
  person: string;
  minRating: number | null;
  watched: "all" | "watched" | "unwatched";
  mediaType: "all" | "movies" | "series";
  sort: "title" | "rating" | "recent";
  onClearAll: () => void;
};

/**
 * Component that displays active filters and provides a quick "Clear All" action.
 * Shows a badge with the count of active filters when any are applied.
 * Note: Media type filter is not shown as it's always obvious from the page context.
 */
export function FilterIndicator({
  query,
  genre,
  person,
  minRating,
  watched,
  sort,
  onClearAll,
}: FilterIndicatorProps) {
  // Count active filters (excluding mediaType which is always obvious from page context)
  const activeFilters: string[] = [];
  
  if (query.trim()) activeFilters.push(`Search: "${query}"`);
  if (genre && genre !== "All") activeFilters.push(`Genre: ${genre}`);
  if (person.trim()) activeFilters.push(`Person: ${person}`);
  if (minRating !== null) activeFilters.push(`Rating: ${minRating}+`);
  if (watched !== "all") activeFilters.push(`${watched === "watched" ? "Watched" : "Unwatched"}`);
  if (sort !== "rating") activeFilters.push(`Sort: ${sort}`);

  const isFiltered = activeFilters.length > 0;

  if (!isFiltered) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Active Filters
          </span>
          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-accent text-white text-xs font-semibold">
            {activeFilters.length}
          </span>
        </div>
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear All
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {activeFilters.map((filter, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent border border-accent/30"
          >
            {filter}
          </span>
        ))}
      </div>
    </div>
  );
}
