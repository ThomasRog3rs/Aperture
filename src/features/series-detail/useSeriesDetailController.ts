"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VideoPlayerEpisodeListSeason } from "@/components/VideoPlayer";
import { tmdbImageUrl } from "@/lib/format";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";
import {
  areAllEpisodesWatched,
  buildOrderedEpisodes,
  buildSeriesEditUpdates,
  getContinueEpisode,
  getEpisodeNavigationTarget,
  getEpisodeNumberLabel,
  getPosterCandidate,
  getSeasonLabel,
  getSeasonSummary,
  getSeriesCastCrew,
  getSeriesRating,
  hasMissingBasicSeriesInfo,
  type EpisodeNavigationTarget,
} from "@/features/series-detail/domain";
import {
  createFetchSeriesDetailGateway,
  type SeriesDetailGateway,
} from "@/features/series-detail/gateway";
import type {
  FolderImage,
  Notice,
  PlaybackLaunchMode,
  RandomSessionActionPayload,
  RandomSessionSummary,
} from "@/features/series-detail/types";

const defaultGateway = createFetchSeriesDetailGateway();

type SeriesRandomAction = RandomSessionActionPayload["action"];

type UseSeriesDetailControllerOptions = {
  seriesId?: string;
  gateway?: SeriesDetailGateway;
  onDeleted?: () => void;
  confirmDelete?: (message: string) => boolean;
};

export type SeriesDetailController = {
  series: Series | null;
  seasons: SeasonWithEpisodes[];
  title: string;
  setTitle: (value: string) => void;
  posterInput: string;
  setPosterInput: (value: string) => void;
  folderImages: FolderImage[];
  folderImagesLoading: boolean;
  folderImagesError: string | null;
  selectedFolderImage: string;
  setSelectedFolderImage: (value: string) => void;
  loading: boolean;
  saving: boolean;
  refreshing: boolean;
  playing: string | null;
  notice: Notice | null;
  deleting: boolean;
  togglingWatchedEpisodeIds: ReadonlySet<string>;
  activeEpisodeId: string | null;
  activeEpisode: Episode | null;
  playbackMode: PlaybackLaunchMode;
  playerStartTime: number;
  randomSession: RandomSessionSummary | null;
  randomSessionLoading: boolean;
  hasRandomSession: boolean;
  randomAction: SeriesRandomAction | null;
  isRandomMode: boolean;
  isEditModalOpen: boolean;
  setIsEditModalOpen: (value: boolean) => void;
  isInfoModalOpen: boolean;
  setIsInfoModalOpen: (value: boolean) => void;
  posterUrl: string | null;
  hasMissingBasicInfo: boolean;
  seasonSummary: string;
  seriesRating: number | null;
  castCrew: {
    directors: string[];
    writers: string[];
    actors: string[];
  };
  topSeasonYear: number | null;
  topSeasonGenres: string[];
  orderedEpisodeCount: number;
  continueEpisode: Episode | null;
  allWatched: boolean;
  previousEpisodeTarget: EpisodeNavigationTarget | null;
  nextEpisodeTarget: EpisodeNavigationTarget | null;
  episodeSelectorSeasons: VideoPlayerEpisodeListSeason[];
  handleUseSelectedFolderImage: () => void;
  handleClearPoster: () => void;
  handleRefreshPoster: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handlePlayContinue: () => void;
  handlePlayEpisode: (episode: Episode) => void;
  handlePlayExternalEpisode: (episode: Episode) => Promise<void>;
  handleClosePlayer: () => void;
  handlePlayPreviousEpisode: () => void;
  handlePlayNextEpisode: () => void;
  handleSelectEpisode: (episodeId: string) => void;
  handlePlayRandomContinue: () => void;
  handlePlayRandomStartNew: () => void;
  handleRandomSessionAction: (
    action: Extract<SeriesRandomAction, "start_new" | "continue" | "next_random">
  ) => Promise<void>;
  handleToggleEpisodeWatched: (episode: Episode, checked: boolean) => Promise<void>;
  handleEpisodeTimeUpdate: (episodeId: string, currentTime: number, duration: number) => void;
  handleEpisodeEnded: (episodeId: string, currentTime: number, duration: number) => void;
};

function applySeriesState(
  nextSeries: Series,
  nextSeasons: SeasonWithEpisodes[],
  setSeries: (movie: Series) => void,
  setSeasons: (seasons: SeasonWithEpisodes[]) => void,
  setTitle: (value: string) => void,
  setPosterInput: (value: string) => void,
  options?: { title?: boolean; poster?: boolean }
) {
  setSeries(nextSeries);
  setSeasons(nextSeasons);
  if (options?.title ?? true) {
    setTitle(nextSeries.titleClean);
  }
  if (options?.poster ?? true) {
    setPosterInput(nextSeries.posterPath ?? "");
  }
}

export function useSeriesDetailController({
  seriesId,
  gateway = defaultGateway,
  onDeleted,
  confirmDelete,
}: UseSeriesDetailControllerOptions = {}): SeriesDetailController {
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
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackLaunchMode>("continue");
  const [playerStartTime, setPlayerStartTime] = useState(0);
  const [togglingWatched, setTogglingWatched] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [randomSession, setRandomSession] = useState<RandomSessionSummary | null>(null);
  const [randomSessionLoading, setRandomSessionLoading] = useState(false);
  const [randomAction, setRandomAction] = useState<SeriesRandomAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const askConfirmDelete = useMemo(() => {
    if (confirmDelete) return confirmDelete;
    return (message: string) => window.confirm(message);
  }, [confirmDelete]);

  const loadRandomSession = useCallback(
    async (id: string) => {
      setRandomSessionLoading(true);
      try {
        const data = await gateway.getRandomSession(id);
        setRandomSession(data.session ?? null);
      } catch (error) {
        setRandomSession(null);
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to load random session.",
        });
      } finally {
        setRandomSessionLoading(false);
      }
    },
    [gateway]
  );

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

  const fetchSeries = useCallback(async () => {
    if (!seriesId) {
      setNotice({ tone: "error", message: "Missing series id in URL." });
      setSeries(null);
      setSeasons([]);
      setRandomSession(null);
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
      const data = await gateway.getSeries(seriesId);
      applySeriesState(
        data.series,
        data.seasons,
        setSeries,
        setSeasons,
        setTitle,
        setPosterInput
      );
      void loadFolderImages(data.series.id, data.series.posterPath ?? null);
      void loadRandomSession(data.series.id);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load series.",
      });
      setSeries(null);
      setSeasons([]);
      setRandomSession(null);
      setFolderImages([]);
      setSelectedFolderImage("");
      setFolderImagesError(null);
      setFolderImagesLoading(false);
    } finally {
      setLoading(false);
    }
  }, [gateway, loadFolderImages, loadRandomSession, seriesId]);

  useEffect(() => {
    void fetchSeries();
  }, [fetchSeries]);

  useEffect(() => {
    const trimmed = posterInput.trim();
    if (!trimmed) return;
    const matched = folderImages.find((image) => image.url === trimmed);
    if (matched && matched.url !== selectedFolderImage) {
      setSelectedFolderImage(matched.url);
    }
  }, [folderImages, posterInput, selectedFolderImage]);

  const orderedEpisodes = useMemo(() => buildOrderedEpisodes(seasons), [seasons]);

  const activeEpisodeIndex = useMemo(
    () =>
      activeEpisodeId
        ? orderedEpisodes.findIndex(({ episode }) => episode.id === activeEpisodeId)
        : -1,
    [activeEpisodeId, orderedEpisodes]
  );

  const activeEpisodeItem =
    activeEpisodeIndex >= 0 ? orderedEpisodes[activeEpisodeIndex] : null;
  const activeEpisode = activeEpisodeItem?.episode ?? null;
  const previousEpisodeItem =
    activeEpisodeIndex > 0 ? orderedEpisodes[activeEpisodeIndex - 1] : null;
  const nextEpisodeItem =
    activeEpisodeIndex >= 0 && activeEpisodeIndex < orderedEpisodes.length - 1
      ? orderedEpisodes[activeEpisodeIndex + 1]
      : null;

  const previousEpisodeTarget = previousEpisodeItem?.target ?? null;
  const nextEpisodeTarget = nextEpisodeItem?.target ?? null;

  const episodeSelectorSeasons = useMemo<VideoPlayerEpisodeListSeason[]>(
    () =>
      seasons.map((season) => {
        const sectionTitle = getSeasonLabel(season);
        return {
          id: season.id,
          title: sectionTitle,
          subtitle:
            season.titleClean && season.titleClean !== sectionTitle
              ? season.titleClean
              : undefined,
          episodes: season.episodes.map((episode) => {
            const target = getEpisodeNavigationTarget(season, episode);
            return {
              ...target,
              numberLabel: getEpisodeNumberLabel(episode),
              watched: episode.watched,
              isCurrent: episode.id === activeEpisodeId,
            };
          }),
        };
      }),
    [activeEpisodeId, seasons]
  );

  const updateEpisodeInState = useCallback(
    (episodeId: string, updates: Partial<Episode>) => {
      setSeasons((prev) =>
        prev.map((season) => {
          let didUpdate = false;
          const episodes = season.episodes.map((episode) => {
            if (episode.id !== episodeId) return episode;
            didUpdate = true;
            return { ...episode, ...updates };
          });
          return didUpdate ? { ...season, episodes } : season;
        })
      );
    },
    []
  );

  const playEpisode = useCallback(
    (episode: Episode, options?: { mode?: PlaybackLaunchMode; startTime?: number }) => {
      if (!episode.filePath?.trim()) {
        setNotice({ tone: "error", message: "File path missing for this episode." });
        return;
      }
      setPlaybackMode(options?.mode ?? "continue");
      setPlayerStartTime(
        options?.startTime ?? (episode.watched ? 0 : episode.watchProgressSeconds ?? 0)
      );
      setActiveEpisodeId(episode.id);
      setNotice(null);
    },
    []
  );

  const requestRandomSessionAction = useCallback(
    async (payload: RandomSessionActionPayload) => {
      if (!seriesId) {
        throw new Error("Missing series id in URL.");
      }

      const data = await gateway.requestRandomSessionAction(seriesId, payload);
      setRandomSession(data.session ?? null);
      return data;
    },
    [gateway, seriesId]
  );

  const startEpisodePlayback = useCallback(
    async (episode: Episode, mode: PlaybackLaunchMode) => {
      if (mode === "random") {
        setRandomAction("mark_started");
        try {
          await requestRandomSessionAction({
            action: "mark_started",
            episodeId: episode.id,
          });
        } catch (error) {
          setNotice({
            tone: "error",
            message:
              error instanceof Error ? error.message : "Failed to update random session.",
          });
          return;
        } finally {
          setRandomAction((current) => (current === "mark_started" ? null : current));
        }
      }

      playEpisode(episode, { mode });
    },
    [playEpisode, requestRandomSessionAction]
  );

  useEffect(() => {
    if (
      activeEpisodeId &&
      !orderedEpisodes.some(({ episode }) => episode.id === activeEpisodeId)
    ) {
      setPlayerStartTime(0);
      setActiveEpisodeId(null);
      setPlaybackMode("continue");
    }
  }, [activeEpisodeId, orderedEpisodes]);

  const continueEpisode = useMemo(() => getContinueEpisode(orderedEpisodes), [orderedEpisodes]);
  const allWatched = useMemo(() => areAllEpisodesWatched(orderedEpisodes), [orderedEpisodes]);

  const handleClosePlayer = useCallback(() => {
    setPlayerStartTime(0);
    setActiveEpisodeId(null);
    setPlaybackMode("continue");
  }, []);

  const handleRandomSessionAction = useCallback(
    async (action: "start_new" | "continue" | "next_random") => {
      setRandomAction(action);
      setNotice(null);
      try {
        const data = await requestRandomSessionAction({ action });
        if (data.exhausted || !data.episode) {
          setNotice({
            tone: "info",
            message:
              action === "start_new"
                ? "This series has no remaining episodes for a random session."
                : "This random session is complete. Start a new one to keep going.",
          });
          if (action === "next_random") {
            handleClosePlayer();
          }
          return;
        }

        playEpisode(data.episode, { mode: "random" });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to update random session.",
        });
      } finally {
        setRandomAction((current) => (current === action ? null : current));
      }
    },
    [handleClosePlayer, playEpisode, requestRandomSessionAction]
  );

  const handlePlayContinue = useCallback(() => {
    if (continueEpisode) {
      void startEpisodePlayback(continueEpisode, "continue");
    }
  }, [continueEpisode, startEpisodePlayback]);

  const handlePlayEpisode = useCallback(
    (episode: Episode) => {
      void startEpisodePlayback(episode, "continue");
    },
    [startEpisodePlayback]
  );

  const handlePlayPreviousEpisode = useCallback(() => {
    if (previousEpisodeItem) {
      void startEpisodePlayback(previousEpisodeItem.episode, playbackMode);
    }
  }, [playbackMode, previousEpisodeItem, startEpisodePlayback]);

  const handlePlayNextEpisode = useCallback(() => {
    if (nextEpisodeItem) {
      void startEpisodePlayback(nextEpisodeItem.episode, playbackMode);
    }
  }, [nextEpisodeItem, playbackMode, startEpisodePlayback]);

  const handleSelectEpisode = useCallback(
    (episodeId: string) => {
      const selectedEpisode = orderedEpisodes.find(({ episode }) => episode.id === episodeId)
        ?.episode;
      if (selectedEpisode) {
        void startEpisodePlayback(selectedEpisode, playbackMode);
      }
    },
    [orderedEpisodes, playbackMode, startEpisodePlayback]
  );

  const handlePlayRandomContinue = useCallback(() => {
    void handleRandomSessionAction("continue");
  }, [handleRandomSessionAction]);

  const handlePlayRandomStartNew = useCallback(() => {
    void handleRandomSessionAction("start_new");
  }, [handleRandomSessionAction]);

  const handlePlayExternalEpisode = useCallback(
    async (episode: Episode) => {
      if (!episode.filePath?.trim()) {
        setNotice({ tone: "error", message: "File path missing for this episode." });
        return;
      }

      setPlaying(episode.id);
      setNotice(null);
      try {
        await gateway.launchExternalPlayer(episode.filePath);
        setNotice({
          tone: "success",
          message: `Playing ${episode.titleClean || episode.titleRaw} in external player.`,
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to launch player.",
        });
      } finally {
        setPlaying(null);
      }
    },
    [gateway]
  );

  const handleToggleEpisodeWatched = useCallback(
    async (episode: Episode, checked: boolean) => {
      setTogglingWatched((prev) => new Set(prev).add(episode.id));
      try {
        const updatedEpisode = await gateway.updateEpisode(episode.id, { watched: checked });
        updateEpisodeInState(episode.id, { watched: updatedEpisode.watched });
      } catch (error) {
        setNotice({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to update episode.",
        });
      } finally {
        setTogglingWatched((prev) => {
          const next = new Set(prev);
          next.delete(episode.id);
          return next;
        });
      }
    },
    [gateway, updateEpisodeInState]
  );

  const handleEpisodeTimeUpdate = useCallback(
    (episodeId: string, currentTime: number, duration: number) => {
      const roundedTime = Math.round(currentTime);
      const isWatched = duration > 0 && currentTime / duration >= 0.9;
      updateEpisodeInState(episodeId, {
        watchProgressSeconds: roundedTime,
        ...(isWatched ? { watched: true } : {}),
      });
      void gateway
        .saveEpisodeWatchProgress(episodeId, currentTime, duration)
        .catch(() => undefined);
    },
    [gateway, updateEpisodeInState]
  );

  const handleEpisodeEnded = useCallback(
    (episodeId: string, currentTime: number, duration: number) => {
      const completedTime = duration > 0 ? duration : currentTime;
      updateEpisodeInState(episodeId, {
        watchProgressSeconds: Math.round(completedTime),
        watched: true,
      });
      void gateway
        .saveEpisodeWatchProgress(episodeId, completedTime, completedTime)
        .catch(() => undefined);
      if (playbackMode === "random") {
        void handleRandomSessionAction("next_random");
        return;
      }
      if (nextEpisodeItem) {
        void startEpisodePlayback(nextEpisodeItem.episode, "continue");
      }
    },
    [
      gateway,
      handleRandomSessionAction,
      nextEpisodeItem,
      playbackMode,
      startEpisodePlayback,
      updateEpisodeInState,
    ]
  );

  const handleSave = useCallback(async () => {
    if (!series) return;

    const result = buildSeriesEditUpdates(series, title, posterInput);
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
      const data = await gateway.updateSeries(series.id, result.updates);
      applySeriesState(
        data.series,
        data.seasons,
        setSeries,
        setSeasons,
        setTitle,
        setPosterInput
      );
      setNotice({ tone: "success", message: "Series updated." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to update series.",
      });
    } finally {
      setSaving(false);
    }
  }, [gateway, posterInput, series, title]);

  const handleRefreshPoster = useCallback(async () => {
    if (!series) return;
    setRefreshing(true);
    setNotice(null);
    try {
      const updatedSeries = await gateway.refreshSeriesMetadata(series.id);
      setSeries((prev) =>
        prev
          ? {
              ...prev,
              posterPath: updatedSeries.posterPath ?? null,
            }
          : prev
      );
      setPosterInput(updatedSeries.posterPath ?? "");
      setNotice({ tone: "success", message: "Metadata refreshed from OMDb." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to refresh metadata.",
      });
    } finally {
      setRefreshing(false);
    }
  }, [gateway, series]);

  const handleDelete = useCallback(async () => {
    if (!series) return;
    const confirmed = askConfirmDelete(
      "Remove this series from your library? Files on disk will not be deleted."
    );
    if (!confirmed) return;

    setDeleting(true);
    setNotice(null);
    try {
      await gateway.deleteSeries(series.id);
      onDeleted?.();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to remove series.",
      });
      setDeleting(false);
    }
  }, [askConfirmDelete, gateway, onDeleted, series]);

  const handleUseSelectedFolderImage = useCallback(() => {
    setPosterInput(selectedFolderImage);
  }, [selectedFolderImage]);

  const handleClearPoster = useCallback(() => {
    setPosterInput("");
  }, []);

  const posterUrl = useMemo(
    () => tmdbImageUrl(getPosterCandidate(posterInput, series), "w780"),
    [posterInput, series]
  );

  const hasMissingBasicInfo = useMemo(
    () => hasMissingBasicSeriesInfo(series, seasons),
    [series, seasons]
  );

  const seasonSummary = useMemo(() => getSeasonSummary(series), [series]);
  const seriesRating = useMemo(() => getSeriesRating(seasons), [seasons]);
  const castCrew = useMemo(() => getSeriesCastCrew(seasons), [seasons]);

  return {
    series,
    seasons,
    title,
    setTitle,
    posterInput,
    setPosterInput,
    folderImages,
    folderImagesLoading,
    folderImagesError,
    selectedFolderImage,
    setSelectedFolderImage,
    loading,
    saving,
    refreshing,
    playing,
    notice,
    deleting,
    togglingWatchedEpisodeIds: togglingWatched,
    activeEpisodeId,
    activeEpisode,
    playbackMode,
    playerStartTime,
    randomSession,
    randomSessionLoading,
    hasRandomSession: randomSession != null,
    randomAction,
    isRandomMode: playbackMode === "random",
    isEditModalOpen,
    setIsEditModalOpen,
    isInfoModalOpen,
    setIsInfoModalOpen,
    posterUrl,
    hasMissingBasicInfo,
    seasonSummary,
    seriesRating,
    castCrew,
    topSeasonYear: seasons[0]?.year ?? series?.seasons[0]?.year ?? null,
    topSeasonGenres: seasons[0]?.genres ?? series?.seasons[0]?.genres ?? [],
    orderedEpisodeCount: orderedEpisodes.length,
    continueEpisode,
    allWatched,
    previousEpisodeTarget,
    nextEpisodeTarget,
    episodeSelectorSeasons,
    handleUseSelectedFolderImage,
    handleClearPoster,
    handleRefreshPoster,
    handleSave,
    handleDelete,
    handlePlayContinue,
    handlePlayEpisode,
    handlePlayExternalEpisode,
    handleClosePlayer,
    handlePlayPreviousEpisode,
    handlePlayNextEpisode,
    handleSelectEpisode,
    handlePlayRandomContinue,
    handlePlayRandomStartNew,
    handleRandomSessionAction,
    handleToggleEpisodeWatched,
    handleEpisodeTimeUpdate,
    handleEpisodeEnded,
  };
}
