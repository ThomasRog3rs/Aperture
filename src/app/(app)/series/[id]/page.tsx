"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Play,
  Save,
  Video,
  Check,
} from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";
import { formatRating, tmdbImageUrl } from "@/lib/format";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";

type EpisodeResponse = {
  episode: Episode;
  error?: string;
};

type SeriesResponse = {
  series: Series;
  seasons: SeasonWithEpisodes[];
  error?: string;
};

type FolderImage = {
  name: string;
  url: string;
};

type FolderImagesResponse = {
  images: FolderImage[];
  error?: string;
};

export default function SeriesDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const seriesId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [series, setSeries] = useState<Series | null>(null);
  const [seasons, setSeasons] = useState<SeasonWithEpisodes[]>([]);
  const [title, setTitle] = useState("");
  const [posterInput, setPosterInput] = useState("");
  const [folderImages, setFolderImages] = useState<FolderImage[]>([]);
  const [folderImagesLoading, setFolderImagesLoading] = useState(false);
  const [folderImagesError, setFolderImagesError] = useState<string | null>(null);
  const [selectedFolderImage, setSelectedFolderImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [togglingWatched, setTogglingWatched] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const loadFolderImages = useCallback(
    async (id: string, currentPoster: string | null) => {
      setFolderImagesLoading(true);
      setFolderImagesError(null);
      try {
        const response = await fetch(`/api/series/${id}/folder-images`);
        const data = (await response.json()) as FolderImagesResponse;
        if (!response.ok || !Array.isArray(data.images)) {
          throw new Error(data.error || "Failed to load folder images.");
        }
        setFolderImages(data.images);
        const matched = data.images.find(
          (image) => image.url === (currentPoster ?? "")
        );
        setSelectedFolderImage(matched?.url ?? data.images[0]?.url ?? "");
      } catch (error) {
        setFolderImages([]);
        setSelectedFolderImage("");
        setFolderImagesError(
          error instanceof Error
            ? error.message
            : "Failed to load folder images."
        );
      } finally {
        setFolderImagesLoading(false);
      }
    },
    []
  );

  const fetchSeries = useCallback(async () => {
    if (!seriesId) {
      setNotice({ tone: "error", message: "Missing series id in URL." });
      setSeries(null);
      setSeasons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/series/${seriesId}`);
      const data = (await response.json()) as SeriesResponse;
      if (!response.ok || !data.series) {
        throw new Error(data.error || "Series not found.");
      }
      setSeries(data.series);
      setSeasons(data.seasons ?? data.series.seasons ?? []);
      setTitle(data.series.titleClean);
      setPosterInput(data.series.posterPath ?? "");
      loadFolderImages(data.series.id, data.series.posterPath ?? null);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to load series.",
      });
      setSeries(null);
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }, [loadFolderImages, seriesId]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  useEffect(() => {
    const trimmed = posterInput.trim();
    if (!trimmed) return;
    const matched = folderImages.find((image) => image.url === trimmed);
    if (matched && matched.url !== selectedFolderImage) {
      setSelectedFolderImage(matched.url);
    }
  }, [folderImages, posterInput, selectedFolderImage]);

  const handlePlay = useCallback(async (episode: Episode) => {
    if (!episode.filePath) {
      setNotice({ tone: "error", message: "File path missing for this episode." });
      return;
    }
    setPlaying(episode.id);
    setNotice(null);
    try {
      const response = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: episode.filePath }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to launch player.");
      }
      setNotice({
        tone: "success",
        message: `Playing ${episode.titleClean || episode.titleRaw}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to launch player.",
      });
    } finally {
      setPlaying(null);
    }
  }, []);

  const handleToggleEpisodeWatched = useCallback(
    async (episode: Episode, checked: boolean) => {
      setTogglingWatched((prev) => new Set(prev).add(episode.id));
      try {
        const response = await fetch(`/api/episodes/${episode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watched: checked }),
        });
        const data = (await response.json()) as EpisodeResponse;
        if (!response.ok || !data.episode) {
          throw new Error(data.error || "Failed to update episode.");
        }
        setSeasons((prev) =>
          prev.map((season) => ({
            ...season,
            episodes: season.episodes.map((ep) =>
              ep.id === episode.id ? { ...ep, watched: data.episode.watched } : ep
            ),
          }))
        );
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to update episode.",
        });
      } finally {
        setTogglingWatched((prev) => {
          const next = new Set(prev);
          next.delete(episode.id);
          return next;
        });
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!series) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setNotice({ tone: "error", message: "Title cannot be empty." });
      return;
    }

    const trimmedPoster = posterInput.trim();
    const nextPoster = trimmedPoster.length === 0 ? null : trimmedPoster;

    const updates: { titleClean?: string; posterPath?: string | null } = {};
    if (trimmedTitle !== series.titleClean) {
      updates.titleClean = trimmedTitle;
    }
    if (nextPoster !== (series.posterPath ?? null)) {
      updates.posterPath = nextPoster;
    }

    if (Object.keys(updates).length === 0) {
      setNotice({ tone: "info", message: "No changes to save." });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = (await response.json()) as SeriesResponse;
      if (!response.ok || !data.series) {
        throw new Error(data.error || "Failed to update series.");
      }
      setSeries(data.series);
      setSeasons(data.seasons ?? data.series.seasons ?? []);
      setTitle(data.series.titleClean);
      setPosterInput(data.series.posterPath ?? "");
      setNotice({ tone: "success", message: "Series updated." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to update series.",
      });
    } finally {
      setSaving(false);
    }
  }, [posterInput, series, title]);

  const handleRefreshPoster = useCallback(async () => {
    if (!series) return;
    setRefreshing(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/series/${series.id}/refresh-poster`,
        { method: "POST" }
      );
      const data = (await response.json()) as { series?: Series; error?: string };
      if (!response.ok || !data.series) {
        throw new Error(data.error || "Failed to refresh metadata.");
      }
      setSeries((prev) =>
        prev ? { ...prev, posterPath: data.series?.posterPath ?? null } : prev
      );
      setPosterInput(data.series.posterPath ?? "");
      setNotice({ tone: "success", message: "Metadata refreshed from OMDb." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to refresh metadata.",
      });
    } finally {
      setRefreshing(false);
    }
  }, [series]);

  const seasonSummary = useMemo(() => {
    if (!series) return "";
    return `${series.seasonCount} ${series.seasonCount === 1 ? "season" : "seasons"}`;
  }, [series]);

  const seriesRating = useMemo(() => {
    if (seasons.length === 0) return null;
    const ratings = seasons
      .map((season) => season.tmdbRating)
      .filter((value): value is number => typeof value === "number");
    if (ratings.length === 0) return null;
    return Math.max(...ratings);
  }, [seasons]);

  const castCrew = useMemo(() => {
    const unique = (names: string[]) => {
      const seen = new Map<string, string>();
      names.forEach((name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) return;
        seen.set(key, trimmed);
      });
      return Array.from(seen.values());
    };

    return {
      directors: unique(seasons.flatMap((season) => season.directors ?? [])),
      writers: unique(seasons.flatMap((season) => season.writers ?? [])),
      actors: unique(seasons.flatMap((season) => season.actors ?? [])),
    };
  }, [seasons]);

  const posterPreview = posterInput.trim().length > 0 ? posterInput.trim() : series?.posterPath ?? null;
  const posterUrl = tmdbImageUrl(posterPreview, "w780");

  return (
    <div className="min-h-screen">
      {!loading && series ? (
        <div className="relative w-full h-[50vh] sm:h-[60vh] flex items-end pb-12">
          {/* Background Image */}
          {series.seasons[0]?.backdropPath ? (
            <div className="absolute inset-0 z-0">
              <Image
                src={tmdbImageUrl(series.seasons[0]?.backdropPath, "original") || ""}
                alt={series.titleClean}
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
            </div>
          ) : (
            <div className="absolute inset-0 z-0 bg-surface-strong">
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>
          )}

          <div className="relative z-10 w-full px-6 lg:px-12 max-w-7xl mx-auto flex flex-col gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors w-fit mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to library
            </Link>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
              {series.titleClean}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base text-white/80 font-medium drop-shadow-md">
              {series.seasons[0]?.year && <span>{series.seasons[0].year}</span>}
              <span>•</span>
              <span>{seasonSummary}</span>
              {series.seasons[0]?.genres && series.seasons[0].genres.length > 0 && (
                <>
                  <span>•</span>
                  <span>{series.seasons[0].genres.slice(0, 3).join(", ")}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <header className="border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-6 py-5 2xl:max-w-screen-2xl">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to library
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 2xl:max-w-screen-2xl">
        {notice ? <StatusBanner tone={notice.tone} message={notice.message} /> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted 2xl:text-base">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Loading series...
          </div>
        ) : null}

        {!loading && !series ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center 2xl:p-16">
            <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
              Series not found
            </p>
            <p className="text-sm text-muted 2xl:text-base">
              The series you are looking for could not be loaded.
            </p>
            <Link
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground 2xl:py-2 2xl:text-base"
            >
              Return to library
            </Link>
          </div>
        ) : null}

        {!loading && series ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="flex flex-col gap-4">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-border bg-surface">
                {posterUrl ? (
                  <Image
                    src={posterUrl}
                    alt={series.titleClean}
                    fill
                    sizes="(max-width: 1024px) 80vw, 40vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-faint">
                    <Video className="h-10 w-10" />
                    <span className="text-xs uppercase tracking-[0.2em]">
                      No Poster
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted 2xl:text-base">
                <p className="font-medium text-foreground">{seasonSummary}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted 2xl:text-sm">
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-faint">Seasons</p>
                    <p className="mt-1 text-sm text-foreground">
                      {series.seasonCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-faint">Rating</p>
                    <p className="mt-1 text-sm text-foreground">
                      {formatRating(seriesRating)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-sm text-muted 2xl:text-base">
                    <span className="text-xs uppercase tracking-[0.2em] text-faint 2xl:text-sm">
                      Display title
                    </span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60 2xl:py-2 2xl:text-base"
                      placeholder="Series title"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm text-muted 2xl:text-base">
                    <span className="text-xs uppercase tracking-[0.2em] text-faint 2xl:text-sm">
                      Poster URL
                    </span>
                    <input
                      value={posterInput}
                      onChange={(event) => setPosterInput(event.target.value)}
                      className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60 2xl:py-2 2xl:text-base"
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
                          onChange={(event) =>
                            setSelectedFolderImage(event.target.value)
                          }
                          className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60 2xl:py-2 2xl:text-base"
                        >
                          {folderImages.map((image) => (
                            <option key={image.url} value={image.url}>
                              {image.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setPosterInput(selectedFolderImage)}
                          disabled={!selectedFolderImage}
                          className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 2xl:py-2 2xl:text-base"
                        >
                          Use selected
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        Select a file from the series folder to use as the poster.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-background/40 px-4 py-3 text-xs text-muted">
                      No poster images found in the series folder.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 2xl:py-2 2xl:text-base"
                    >
                      <Save className="h-4 w-4 2xl:h-5 2xl:w-5" />
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      onClick={handleRefreshPoster}
                      disabled={refreshing}
                      className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 2xl:py-2 2xl:text-base"
                    >
                      <ImageIcon
                        className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                      />
                      {refreshing ? "Fetching..." : "Fetch from OMDb"}
                    </button>
                    <button
                      onClick={() => setPosterInput("")}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground 2xl:py-2 2xl:text-base"
                    >
                      Clear poster
                    </button>
                  </div>
                </div>
              </div>

              {(castCrew.directors.length > 0 ||
                castCrew.writers.length > 0 ||
                castCrew.actors.length > 0) && (
                <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted 2xl:text-base">
                  <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
                    Cast & Crew
                  </p>
                  <div className="mt-4 space-y-3">
                    {castCrew.directors.length > 0 ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-faint">
                          Director
                        </p>
                        <p className="mt-1 text-foreground">
                          {castCrew.directors.join(", ")}
                        </p>
                      </div>
                    ) : null}
                    {castCrew.writers.length > 0 ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-faint">
                          Writer
                        </p>
                        <p className="mt-1 text-foreground">
                          {castCrew.writers.join(", ")}
                        </p>
                      </div>
                    ) : null}
                    {castCrew.actors.length > 0 ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-faint">
                          Cast
                        </p>
                        <p className="mt-1 text-foreground">
                          {castCrew.actors.join(", ")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {seasons.map((season) => {
                  const seasonLabel = season.seasonNumber
                    ? `Season ${season.seasonNumber}`
                    : "Season";
                  const episodeCount = season.episodeCount ?? season.episodes.length;
                  return (
                    <details
                      key={season.id}
                      className="group rounded-2xl border border-border bg-surface"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                        <div className="min-w-0">
                          <p className="font-serif text-lg font-semibold text-foreground">
                            {seasonLabel}
                          </p>
                          <p className="text-xs text-muted 2xl:text-sm">
                            {season.titleClean}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted 2xl:text-sm">
                          <span>{episodeCount} ep</span>
                          <span>{formatRating(season.tmdbRating)}</span>
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </div>
                      </summary>

                      <div className="border-t border-border px-5 py-4">
                        {season.episodes.length === 0 ? (
                          <p className="mt-4 text-sm text-muted 2xl:text-base">
                            No episodes found for this season.
                          </p>
                        ) : (
                          <div className="mt-4 overflow-hidden rounded-xl border border-border">
                            <table className="w-full text-sm text-muted 2xl:text-base">
                              <thead className="bg-background/50 text-xs uppercase tracking-[0.2em] text-faint">
                                <tr>
                                  <th className="w-12 px-4 py-3 text-center">
                                    <Check className="mx-auto h-3.5 w-3.5" />
                                  </th>
                                  <th className="px-4 py-3 text-left">Episode</th>
                                  <th className="px-4 py-3 text-left">Title</th>
                                  <th className="px-4 py-3 text-right">Play</th>
                                </tr>
                              </thead>
                              <tbody>
                                {season.episodes.map((episode) => (
                                  <tr
                                    key={episode.id}
                                    className="border-t border-border"
                                  >
                                    <td className="w-12 px-4 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={episode.watched}
                                        onChange={(e) =>
                                          handleToggleEpisodeWatched(
                                            episode,
                                            e.target.checked
                                          )
                                        }
                                        disabled={togglingWatched.has(episode.id)}
                                        className="h-4 w-4 cursor-pointer rounded border-border bg-background text-accent focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-foreground">
                                      {episode.episodeNumber ?? "\u2014"}
                                    </td>
                                    <td className={`px-4 py-3 ${episode.watched ? "text-muted line-through" : "text-foreground"}`}>
                                      {episode.titleClean || episode.titleRaw}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        onClick={() => handlePlay(episode)}
                                        disabled={playing === episode.id}
                                        className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 2xl:text-sm"
                                      >
                                        <Play className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                                        {playing === episode.id ? "Launching..." : "Play"}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
