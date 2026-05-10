"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { tmdbImageUrl } from "@/lib/format";
import type { Movie } from "@/lib/types";
import {
  buildMovieEditUpdates,
  dedupeGenres,
  getPosterCandidate,
  hasMissingBasicMovieInfo,
} from "@/features/movie-detail/domain";
import {
  createFetchMovieDetailGateway,
  type MovieDetailGateway,
} from "@/features/movie-detail/gateway";
import type { FolderImage, Notice } from "@/features/movie-detail/types";

const defaultGateway = createFetchMovieDetailGateway();

type UseMovieDetailControllerOptions = {
  movieId?: string;
  gateway?: MovieDetailGateway;
  onDeleted?: () => void;
  confirmDelete?: (message: string) => boolean;
};

type SetMovieState = {
  title?: boolean;
  poster?: boolean;
  genres?: boolean;
};

function applyMovieState(
  nextMovie: Movie,
  setMovie: (movie: Movie) => void,
  setTitle: (value: string) => void,
  setPosterInput: (value: string) => void,
  setUserGenres: (value: string[]) => void,
  options?: SetMovieState
) {
  setMovie(nextMovie);
  if (options?.title ?? true) {
    setTitle(nextMovie.titleClean);
  }
  if (options?.poster ?? true) {
    setPosterInput(nextMovie.posterPath ?? "");
  }
  if (options?.genres ?? true) {
    setUserGenres(dedupeGenres(nextMovie.userGenres ?? []));
  }
}

export function useMovieDetailController({
  movieId,
  gateway = defaultGateway,
  onDeleted,
  confirmDelete,
}: UseMovieDetailControllerOptions) {
  const [movie, setMovie] = useState<Movie | null>(null);
  const searchParams = useSearchParams();
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
  const [showPlayer, setShowPlayer] = useState(false);
  const [savingGenres, setSavingGenres] = useState(false);
  const [savingXxxRated, setSavingXxxRated] = useState(false);
  const [savingWatched, setSavingWatched] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [didApplyDeepLink, setDidApplyDeepLink] = useState(false);

  const askConfirmDelete = useMemo(() => {
    if (confirmDelete) return confirmDelete;
    return (message: string) => window.confirm(message);
  }, [confirmDelete]);

  const loadFolderImages = useCallback(
    async (id: string, currentPoster: string | null) => {
      setFolderImagesLoading(true);
      setFolderImagesError(null);
      try {
        const images = await gateway.getFolderImages(id);
        setFolderImages(images);
        const matched = images.find((image) => image.url === (currentPoster ?? ""));
        setSelectedFolderImage(matched?.url ?? images[0]?.url ?? "");
      } catch (error) {
        setFolderImages([]);
        setSelectedFolderImage("");
        setFolderImagesError(
          error instanceof Error ? error.message : "Failed to load folder images."
        );
      } finally {
        setFolderImagesLoading(false);
      }
    },
    [gateway]
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
      const loadedMovie = await gateway.getMovie(movieId);
      applyMovieState(
        loadedMovie,
        setMovie,
        setTitle,
        setPosterInput,
        setUserGenres
      );
      void loadFolderImages(loadedMovie.id, loadedMovie.posterPath ?? null);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load movie.",
      });
      setMovie(null);
      setFolderImages([]);
      setSelectedFolderImage("");
      setFolderImagesError(null);
      setFolderImagesLoading(false);
    } finally {
      setLoading(false);
    }
  }, [gateway, loadFolderImages, movieId]);

  useEffect(() => {
    void fetchMovie();
  }, [fetchMovie]);

  useEffect(() => {
    setDidApplyDeepLink(false);
  }, [movieId]);

  useEffect(() => {
    if (didApplyDeepLink) return;
    if (!movie) return;

    const autoplay = searchParams.get("autoplay");
    if (autoplay !== "1" && autoplay !== "true") return;

    const timeParam = searchParams.get("t");
    const parsed = timeParam == null ? NaN : Number(timeParam);
    const startTime = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

    if (startTime != null && startTime !== movie.watchProgressSeconds) {
      setMovie((current) =>
        current ? { ...current, watchProgressSeconds: startTime } : current
      );
    }

    setShowPlayer(true);
    setNotice(null);
    setDidApplyDeepLink(true);
  }, [didApplyDeepLink, movie, searchParams]);

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

    const result = buildMovieEditUpdates(movie, title, posterInput);
    if (result.error) {
      setNotice({ tone: "error", message: result.error });
      return;
    }
    if (Object.keys(result.updates).length === 0) {
      setNotice({ tone: "info", message: "No changes to save." });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const updatedMovie = await gateway.updateMovie(movie.id, result.updates);
      applyMovieState(
        updatedMovie,
        setMovie,
        setTitle,
        setPosterInput,
        setUserGenres
      );
      setNotice({ tone: "success", message: "Movie updated." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to update movie.",
      });
    } finally {
      setSaving(false);
    }
  }, [gateway, movie, posterInput, title]);

  const handleXxxRatedChange = useCallback(
    async (checked: boolean) => {
      if (!movie) return;
      setSavingXxxRated(true);
      setNotice(null);
      try {
        const updatedMovie = await gateway.updateMovie(movie.id, { xxxRated: checked });
        applyMovieState(
          updatedMovie,
          setMovie,
          setTitle,
          setPosterInput,
          setUserGenres,
          { title: false, poster: false, genres: false }
        );
        setNotice({
          tone: "success",
          message: checked
            ? "Marked as XXX rated (blurred on main screen)."
            : "Removed XXX rated mark.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to update.",
        });
      } finally {
        setSavingXxxRated(false);
      }
    },
    [gateway, movie]
  );

  const handleWatchedChange = useCallback(
    async (checked: boolean) => {
      if (!movie) return;
      setSavingWatched(true);
      setNotice(null);
      try {
        const updatedMovie = await gateway.updateMovie(movie.id, { watched: checked });
        applyMovieState(
          updatedMovie,
          setMovie,
          setTitle,
          setPosterInput,
          setUserGenres,
          { title: false, poster: false, genres: false }
        );
        setNotice({
          tone: "success",
          message: checked ? "Marked as watched." : "Marked as unwatched.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to update.",
        });
      } finally {
        setSavingWatched(false);
      }
    },
    [gateway, movie]
  );

  const handleSaveGenres = useCallback(
    async (nextGenres: string[]) => {
      if (!movie) return;
      setSavingGenres(true);
      setNotice(null);
      try {
        const updatedMovie = await gateway.updateMovie(movie.id, {
          userGenres: dedupeGenres(nextGenres),
        });
        applyMovieState(
          updatedMovie,
          setMovie,
          setTitle,
          setPosterInput,
          setUserGenres,
          { title: false, poster: false, genres: true }
        );
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
    [gateway, movie]
  );

  const handleRefreshPoster = useCallback(async () => {
    if (!movie) return;
    setRefreshing(true);
    setNotice(null);
    try {
      const updatedMovie = await gateway.refreshMovieMetadata(movie.id);
      applyMovieState(updatedMovie, setMovie, setTitle, setPosterInput, setUserGenres, {
        title: false,
        poster: true,
        genres: true,
      });
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
  }, [gateway, movie]);

  const handlePlay = useCallback(() => {
    if (!movie) return;
    if (!movie.filePath) {
      setNotice({ tone: "error", message: "File path missing for this movie." });
      return;
    }
    setShowPlayer(true);
    setNotice(null);
  }, [movie]);

  const handleClosePlayer = useCallback(() => {
    setShowPlayer(false);
  }, []);

  const handlePlayExternal = useCallback(async () => {
    if (!movie) return;
    if (!movie.filePath) {
      setNotice({ tone: "error", message: "File path missing for this movie." });
      return;
    }
    setPlaying(true);
    setNotice(null);
    try {
      await gateway.launchExternalPlayer(movie.filePath);
      setNotice({
        tone: "success",
        message: `Playing ${movie.titleClean} in external player.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to launch player.",
      });
    } finally {
      setPlaying(false);
    }
  }, [gateway, movie]);

  const handleDelete = useCallback(async () => {
    if (!movie) return;
    const confirmed = askConfirmDelete(
      "Remove this movie from your library? Files on disk will not be deleted."
    );
    if (!confirmed) return;

    setDeleting(true);
    setNotice(null);
    try {
      await gateway.deleteMovie(movie.id);
      onDeleted?.();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to remove movie.",
      });
      setDeleting(false);
    }
  }, [askConfirmDelete, gateway, movie, onDeleted]);

  const handlePlayerTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (!movie) return;
      void gateway
        .saveWatchProgress(movie.id, currentTime, duration)
        .catch(() => undefined);
    },
    [gateway, movie]
  );

  const handlePlayerError = useCallback((message: string) => {
    setNotice({ tone: "error", message });
  }, []);

  const posterUrl = useMemo(() => {
    if (!movie) return null;
    return tmdbImageUrl(getPosterCandidate(posterInput, movie), "w780");
  }, [movie, posterInput]);

  const hasMissingBasicInfo = useMemo(
    () => hasMissingBasicMovieInfo(movie),
    [movie]
  );

  return {
    movie,
    title,
    setTitle,
    posterInput,
    setPosterInput,
    folderImages,
    folderImagesLoading,
    folderImagesError,
    selectedFolderImage,
    setSelectedFolderImage,
    userGenres,
    genreInput,
    setGenreInput,
    loading,
    saving,
    refreshing,
    playing,
    showPlayer,
    savingGenres,
    savingXxxRated,
    savingWatched,
    notice,
    deleting,
    isEditModalOpen,
    setIsEditModalOpen,
    isInfoModalOpen,
    setIsInfoModalOpen,
    posterUrl,
    hasMissingBasicInfo,
    handleSave,
    handleXxxRatedChange,
    handleWatchedChange,
    handleSaveGenres,
    handleRefreshPoster,
    handlePlay,
    handleClosePlayer,
    handlePlayExternal,
    handleDelete,
    handlePlayerTimeUpdate,
    handlePlayerError,
  };
}
