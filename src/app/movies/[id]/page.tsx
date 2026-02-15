"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  Video,
} from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";
import { formatRating, formatRuntime, tmdbImageUrl } from "@/lib/format";
import type { Movie } from "@/lib/types";

type MovieResponse = {
  movie: Movie;
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

function formatTimestamp(value: number | null) {
  if (!value) return "\u2014";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function dedupeGenres(genres: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of genres) {
    const trimmed = g.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export default function MovieDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const movieId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [movie, setMovie] = useState<Movie | null>(null);
  const [title, setTitle] = useState("");
  const [posterInput, setPosterInput] = useState("");
  const [folderImages, setFolderImages] = useState<FolderImage[]>([]);
  const [folderImagesLoading, setFolderImagesLoading] = useState(false);
  const [folderImagesError, setFolderImagesError] = useState<string | null>(null);
  const [selectedFolderImage, setSelectedFolderImage] = useState("");
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [genreInput, setGenreInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [savingGenres, setSavingGenres] = useState(false);
  const [savingXxxRated, setSavingXxxRated] = useState(false);
  const [savingWatched, setSavingWatched] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const loadFolderImages = useCallback(
    async (id: string, currentPoster: string | null) => {
      setFolderImagesLoading(true);
      setFolderImagesError(null);
      try {
        const response = await fetch(`/api/movies/${id}/folder-images`);
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

  const fetchMovie = useCallback(async () => {
    if (!movieId) {
      setNotice({ tone: "error", message: "Missing movie id in URL." });
      setMovie(null);
      setFolderImages([]);
      setSelectedFolderImage("");
      setFolderImagesError(null);
      setFolderImagesLoading(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/movies/${movieId}`);
      const data = (await response.json()) as MovieResponse;
      if (!response.ok || !data.movie) {
        throw new Error(data.error || "Movie not found.");
      }
      setMovie(data.movie);
      setTitle(data.movie.titleClean);
      setPosterInput(data.movie.posterPath ?? "");
      setUserGenres(dedupeGenres(data.movie.userGenres ?? []));
      loadFolderImages(data.movie.id, data.movie.posterPath ?? null);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to load movie.",
      });
      setMovie(null);
      setFolderImages([]);
      setSelectedFolderImage("");
      setFolderImagesError(null);
      setFolderImagesLoading(false);
    } finally {
      setLoading(false);
    }
  }, [loadFolderImages, movieId]);

  useEffect(() => {
    fetchMovie();
  }, [fetchMovie]);

  useEffect(() => {
    const trimmed = posterInput.trim();
    if (!trimmed) return;
    const matched = folderImages.find((image) => image.url === trimmed);
    if (matched && matched.url !== selectedFolderImage) {
      setSelectedFolderImage(matched.url);
    }
  }, [folderImages, posterInput, selectedFolderImage]);

  const handleSave = useCallback(async () => {
    if (!movie) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setNotice({ tone: "error", message: "Title cannot be empty." });
      return;
    }

    const trimmedPoster = posterInput.trim();
    const nextPoster = trimmedPoster.length === 0 ? null : trimmedPoster;

    const updates: { titleClean?: string; posterPath?: string | null } = {};
    if (trimmedTitle !== movie.titleClean) {
      updates.titleClean = trimmedTitle;
    }
    if (nextPoster !== (movie.posterPath ?? null)) {
      updates.posterPath = nextPoster;
    }

    if (Object.keys(updates).length === 0) {
      setNotice({ tone: "info", message: "No changes to save." });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/movies/${movie.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = (await response.json()) as MovieResponse;
      if (!response.ok || !data.movie) {
        throw new Error(data.error || "Failed to update movie.");
      }
      setMovie(data.movie);
      setTitle(data.movie.titleClean);
      setPosterInput(data.movie.posterPath ?? "");
      setUserGenres(dedupeGenres(data.movie.userGenres ?? []));
      setNotice({ tone: "success", message: "Movie updated." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to update movie.",
      });
    } finally {
      setSaving(false);
    }
  }, [movie, title, posterInput]);

  const handleXxxRatedChange = useCallback(
    async (checked: boolean) => {
      if (!movie) return;
      setSavingXxxRated(true);
      setNotice(null);
      try {
        const response = await fetch(`/api/movies/${movie.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xxxRated: checked }),
        });
        const data = (await response.json()) as MovieResponse;
        if (!response.ok || !data.movie) {
          throw new Error(data.error || "Failed to update.");
        }
        setMovie(data.movie);
        setNotice({
          tone: "success",
          message: checked
            ? "Marked as XXX rated (blurred on main screen)."
            : "Removed XXX rated mark.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to update.",
        });
      } finally {
        setSavingXxxRated(false);
      }
    },
    [movie]
  );

  const handleWatchedChange = useCallback(
    async (checked: boolean) => {
      if (!movie) return;
      setSavingWatched(true);
      setNotice(null);
      try {
        const response = await fetch(`/api/movies/${movie.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watched: checked }),
        });
        const data = (await response.json()) as MovieResponse;
        if (!response.ok || !data.movie) {
          throw new Error(data.error || "Failed to update.");
        }
        setMovie(data.movie);
        setNotice({
          tone: "success",
          message: checked
            ? "Marked as watched."
            : "Marked as unwatched.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to update.",
        });
      } finally {
        setSavingWatched(false);
      }
    },
    [movie]
  );

  const handleSaveGenres = useCallback(
    async (nextGenres: string[]) => {
      if (!movie) return;
      setSavingGenres(true);
      setNotice(null);
      try {
        const response = await fetch(`/api/movies/${movie.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userGenres: dedupeGenres(nextGenres) }),
        });
        const data = (await response.json()) as MovieResponse;
        if (!response.ok || !data.movie) {
          throw new Error(data.error || "Failed to update genres.");
        }
        setMovie(data.movie);
        setUserGenres(dedupeGenres(data.movie.userGenres ?? []));
        setGenreInput("");
        setNotice({ tone: "success", message: "Custom genres updated." });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to update genres.",
        });
      } finally {
        setSavingGenres(false);
      }
    },
    [movie]
  );

  const handleRefreshPoster = useCallback(async () => {
    if (!movie) return;
    setRefreshing(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/movies/${movie.id}/refresh-poster`,
        { method: "POST" }
      );
      const data = (await response.json()) as MovieResponse;
      if (!response.ok || !data.movie) {
        throw new Error(data.error || "Failed to refresh poster.");
      }
      setMovie(data.movie);
      setPosterInput(data.movie.posterPath ?? "");
      setUserGenres(dedupeGenres(data.movie.userGenres ?? []));
      setNotice({ tone: "success", message: "Metadata refreshed from OMDb." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to refresh poster.",
      });
    } finally {
      setRefreshing(false);
    }
  }, [movie]);

  const handlePlay = useCallback(async () => {
    if (!movie) return;
    if (!movie.filePath) {
      setNotice({ tone: "error", message: "File path missing for this movie." });
      return;
    }
    setPlaying(true);
    setNotice(null);
    try {
      const response = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: movie.filePath }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to launch player.");
      }
      setNotice({ tone: "success", message: `Playing ${movie.titleClean}.` });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to launch player.",
      });
    } finally {
      setPlaying(false);
    }
  }, [movie]);

  const posterCandidate = posterInput.trim() || movie?.posterPath || null;
  const posterUrl = movie ? tmdbImageUrl(posterCandidate, "w780") : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-6 py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-faint">
              Movie details
            </p>
            <h1 className="font-serif text-xl font-semibold text-foreground">
              {movie?.titleClean ?? "Loading..."}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        {notice ? <StatusBanner tone={notice.tone} message={notice.message} /> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Loading movie...
          </div>
        ) : null}

        {!loading && !movie ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center">
            <p className="font-serif text-lg font-medium text-foreground">
              Movie not found
            </p>
            <p className="text-sm text-muted">
              The movie you are looking for could not be loaded.
            </p>
            <Link
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
            >
              Return to library
            </Link>
          </div>
        ) : null}

        {!loading && movie ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-4">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-border bg-surface">
                {posterUrl ? (
                  <Image
                    src={posterUrl}
                    alt={movie.titleClean}
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
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handlePlay}
                    disabled={playing || !movie.filePath}
                    className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    {playing ? "Launching..." : "Play movie"}
                  </button>
                  {movie.youtubeTrailerKey ? (
                    <a
                      href={`https://www.youtube.com/watch?v=${movie.youtubeTrailerKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
                    >
                      Trailer
                    </a>
                  ) : null}
                </div>
                <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={movie.xxxRated ?? false}
                    onChange={(e) => handleXxxRatedChange(e.target.checked)}
                    disabled={savingXxxRated}
                    className="h-4 w-4 rounded border-border bg-background text-accent focus:ring-accent/40"
                  />
                  <span>
                    XXX rated
                    <span className="ml-1.5 text-xs text-faint">
                      (blurred on main screen until search/filter)
                    </span>
                  </span>
                </label>
                <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={movie.watched ?? false}
                    onChange={(e) => handleWatchedChange(e.target.checked)}
                    disabled={savingWatched}
                    className="h-4 w-4 rounded border-border bg-background text-accent focus:ring-accent/40"
                  />
                  <span>Watched</span>
                </label>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-muted">
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-faint">Year</p>
                    <p className="mt-1 text-sm text-foreground">
                      {movie.year ?? "\u2014"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-faint">Runtime</p>
                    <p className="mt-1 text-sm text-foreground">
                      {formatRuntime(movie.runtimeMinutes)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-faint">Rating</p>
                    <p className="mt-1 text-sm text-foreground">
                      {formatRating(movie.tmdbRating)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
                <p className="font-medium text-foreground">File-derived title</p>
                <p className="mt-1">{movie.titleRaw}</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-sm text-muted">
                    <span className="text-xs uppercase tracking-[0.2em] text-faint">
                      Display title
                    </span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
                      placeholder="Movie title"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm text-muted">
                    <span className="text-xs uppercase tracking-[0.2em] text-faint">
                      Poster URL
                    </span>
                    <input
                      value={posterInput}
                      onChange={(event) => setPosterInput(event.target.value)}
                      className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
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
                          className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
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
                          className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Use selected
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        Select a file from the movie folder to use as the poster.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-background/40 px-4 py-3 text-xs text-muted">
                      No poster images found in the movie folder.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      onClick={handleRefreshPoster}
                      disabled={refreshing}
                      className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                      />
                      {refreshing ? "Fetching..." : "Fetch from OMDb"}
                    </button>
                    <button
                      onClick={() => setPosterInput("")}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground"
                    >
                      Clear poster
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-accent" />
                  <p className="font-serif text-lg font-medium text-foreground">
                    Genres
                  </p>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-faint">
                      From OMDb
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {(movie.omdbGenres ?? []).length > 0 ? (
                        (movie.omdbGenres ?? []).map((genreName) => (
                          <span
                            key={genreName}
                            className="rounded-md border border-border px-2 py-1 text-muted"
                          >
                            {genreName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted">\u2014</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-faint">
                      Your custom genres
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {userGenres.length > 0 ? (
                        userGenres.map((genreName) => (
                          <span
                            key={genreName}
                            className="inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1 text-foreground"
                          >
                            {genreName}
                            <button
                              onClick={() =>
                                handleSaveGenres(
                                  userGenres.filter((g) => g !== genreName)
                                )
                              }
                              disabled={savingGenres}
                              className="text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Remove ${genreName}`}
                              title="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted">\u2014</span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <input
                        value={genreInput}
                        onChange={(event) => setGenreInput(event.target.value)}
                        className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
                        placeholder="Add a genre (e.g. Noir)"
                      />
                      <button
                        onClick={() => {
                          const next = genreInput.trim();
                          if (!next) return;
                          handleSaveGenres([...userGenres, next]);
                        }}
                        disabled={savingGenres || !genreInput.trim()}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingGenres ? "Saving..." : "Add genre"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Custom genres are kept even when you re-fetch from OMDb.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
                <p className="font-medium text-foreground">Database details</p>
                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      id
                    </dt>
                    <dd className="mt-1 break-all text-foreground">{movie.id}</dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      tmdbId
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {movie.tmdbId ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      titleClean
                    </dt>
                    <dd className="mt-1 break-words text-foreground">
                      {movie.titleClean}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      titleRaw
                    </dt>
                    <dd className="mt-1 break-words text-foreground">
                      {movie.titleRaw}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      year
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {movie.year ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      runtimeMinutes
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {movie.runtimeMinutes ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      tmdbRating
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {movie.tmdbRating ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      youtubeTrailerKey
                    </dt>
                    <dd className="mt-1 break-all text-foreground">
                      {movie.youtubeTrailerKey ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      folderPath
                    </dt>
                    <dd className="mt-1 break-all text-foreground">
                      {movie.folderPath}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      filePath
                    </dt>
                    <dd className="mt-1 break-all text-foreground">
                      {movie.filePath}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      fileSizeBytes
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {movie.fileSizeBytes}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      personalRating
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {movie.personalRating ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      titleEditedAt
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {formatTimestamp(movie.titleEditedAt)}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      lastSyncedAt
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {formatTimestamp(movie.lastSyncedAt)}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      errorMessage
                    </dt>
                    <dd className="mt-1 break-words text-foreground">
                      {movie.errorMessage ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      posterPath
                    </dt>
                    <dd className="mt-1 break-all text-foreground">
                      {movie.posterPath ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      backdropPath
                    </dt>
                    <dd className="mt-1 break-all text-foreground">
                      {movie.backdropPath ?? "\u2014"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-faint">
                      genres (combined)
                    </dt>
                    <dd className="mt-1 break-words text-foreground">
                      {movie.genres.length > 0 ? movie.genres.join(", ") : "\u2014"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
                <p>
                  Editing the title here overrides the file-derived name. Future
                  syncs will keep your custom title.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
