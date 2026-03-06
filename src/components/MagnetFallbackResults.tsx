"use client";

import type { ComponentType } from "react";
import {
  CalendarDays,
  Copy,
  ExternalLink,
  HardDrive,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { MagnetSearchResult } from "@/lib/types";

type MagnetFallbackResultsProps = {
  query: string;
  results: MagnetSearchResult[];
  loading: boolean;
  error: string | null;
  onOpen: (result: MagnetSearchResult) => void;
  onCopy: (result: MagnetSearchResult) => void;
};

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
      <Icon className="h-3.5 w-3.5 text-accent" />
      <span className="text-faint">{label}:</span> {value}
    </span>
  );
}

export function MagnetFallbackResults({
  query,
  results,
  loading,
  error,
  onOpen,
  onCopy,
}: MagnetFallbackResultsProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_12px_36px_rgba(0,0,0,0.3)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-serif text-xl font-semibold text-foreground">
            No local matches for &quot;{query}&quot;
          </p>
          <p className="mt-1 text-sm text-muted">
            Showing Pirate Bay fallback results from MagnetAPI.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <ShieldAlert className="h-4 w-4" />
          Turn on your VPN before opening magnet links.
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-xl border border-border bg-background px-4 py-6 text-sm text-muted">
          Searching MagnetAPI for fallback results...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mt-6 rounded-xl border border-error/30 bg-error/10 px-4 py-6 text-sm text-error">
          {error}
        </div>
      ) : null}

      {!loading && !error && results.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-background px-4 py-6 text-sm text-muted">
          MagnetAPI did not return any fallback results for this search.
        </div>
      ) : null}

      {!loading && !error && results.length > 0 ? (
        <div className="mt-6 grid gap-4">
          {results.map((result) => (
            <article
              key={`${result.magnet}-${result.name}`}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-foreground">
                    {result.name}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                    <Detail icon={Users} label="Seeders" value={result.seeders} />
                    <Detail icon={Users} label="Leechers" value={result.leechers} />
                    <Detail icon={HardDrive} label="Size" value={result.size} />
                    <Detail icon={CalendarDays} label="Date" value={result.date} />
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCopy(result)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
                  >
                    <Copy className="h-4 w-4" />
                    Copy magnet
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpen(result)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open magnet
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
