"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Episode, SeasonWithEpisodes } from "@/lib/types";
import {
  launchExternalPlayback,
  persistEpisodeWatchProgress,
} from "./series-detail.api";
import {
  buildEpisodeEndedUpdate,
  buildEpisodeProgressUpdate,
  buildEpisodeSelectorSeasons,
  buildOrderedEpisodes,
  findActiveEpisodeState,
  getAllWatched,
  getContinueEpisode,
  getEpisodeDisplayTitle,
  getRandomSessionExhaustedNotice,
} from "./series-detail.selectors";
import type {
  PlaybackLaunchMode,
  RandomSessionAction,
  RandomSessionActionPayload,
  RandomSessionResponse,
  SeriesNotice,
} from "./series-detail.types";

type UseSeriesPlaybackControllerOptions = {
  seasons: SeasonWithEpisodes[];
  setNotice: Dispatch<SetStateAction<SeriesNotice | null>>;
  updateEpisodeInState: (episodeId: string, updates: Partial<Episode>) => void;
  requestRandomSessionAction: (
    payload: RandomSessionActionPayload
  ) => Promise<RandomSessionResponse>;
};

export function useSeriesPlaybackController({
  seasons,
  setNotice,
  updateEpisodeInState,
  requestRandomSessionAction,
}: UseSeriesPlaybackControllerOptions) {
  const [playingEpisodeId, setPlayingEpisodeId] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] =
    useState<PlaybackLaunchMode>("continue");
  const [playerStartTime, setPlayerStartTime] = useState(0);
  const [randomAction, setRandomAction] = useState<RandomSessionAction | null>(
    null
  );
  const progressErrorRef = useRef<string | null>(null);

  const orderedEpisodes = useMemo(() => buildOrderedEpisodes(seasons), [seasons]);
  const activeEpisodeState = useMemo(
    () => findActiveEpisodeState(orderedEpisodes, activeEpisodeId),
    [activeEpisodeId, orderedEpisodes]
  );
  const episodeSelectorSeasons = useMemo(
    () => buildEpisodeSelectorSeasons(seasons, activeEpisodeId),
    [activeEpisodeId, seasons]
  );
  const continueEpisode = useMemo(
    () => getContinueEpisode(orderedEpisodes),
    [orderedEpisodes]
  );
  const allWatched = useMemo(
    () => getAllWatched(orderedEpisodes),
    [orderedEpisodes]
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

  const persistWatchProgress = useCallback(
    (episodeId: string, currentTime: number, duration: number) => {
      void persistEpisodeWatchProgress(episodeId, currentTime, duration)
        .then(() => {
          progressErrorRef.current = null;
        })
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to update watch progress.";

          if (progressErrorRef.current === message) return;
          progressErrorRef.current = message;
          setNotice({ tone: "error", message });
        });
    },
    [setNotice]
  );

  const playEpisode = useCallback(
    (
      episode: Episode,
      options?: { mode?: PlaybackLaunchMode; startTime?: number }
    ) => {
      if (!episode.filePath) {
        setNotice({
          tone: "error",
          message: "File path missing for this episode.",
        });
        return;
      }

      setPlaybackMode(options?.mode ?? "continue");
      setPlayerStartTime(
        options?.startTime ??
          (episode.watched ? 0 : episode.watchProgressSeconds ?? 0)
      );
      setActiveEpisodeId(episode.id);
      setNotice(null);
    },
    [setNotice]
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
              error instanceof Error
                ? error.message
                : "Failed to update random session.",
          });
          return;
        } finally {
          setRandomAction((current) =>
            current === "mark_started" ? null : current
          );
        }
      }

      playEpisode(episode, { mode });
    },
    [playEpisode, requestRandomSessionAction, setNotice]
  );

  const handleClosePlayer = useCallback(() => {
    setPlayerStartTime(0);
    setActiveEpisodeId(null);
    setPlaybackMode("continue");
  }, []);

  const handleRandomSessionAction = useCallback(
    async (action: Extract<RandomSessionAction, "start_new" | "continue" | "next_random">) => {
      setRandomAction(action);
      setNotice(null);

      try {
        const data = await requestRandomSessionAction({ action });

        if (data.exhausted || !data.episode) {
          setNotice(getRandomSessionExhaustedNotice(action));
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
            error instanceof Error
              ? error.message
              : "Failed to update random session.",
        });
      } finally {
        setRandomAction((current) => (current === action ? null : current));
      }
    },
    [handleClosePlayer, playEpisode, requestRandomSessionAction, setNotice]
  );

  const handlePlay = useCallback(
    (episode: Episode) => {
      void startEpisodePlayback(episode, "continue");
    },
    [startEpisodePlayback]
  );

  const handlePlayContinue = useCallback(() => {
    if (continueEpisode) {
      void startEpisodePlayback(continueEpisode, "continue");
    }
  }, [continueEpisode, startEpisodePlayback]);

  const handlePlayRandom = useCallback(
    (action: Extract<RandomSessionAction, "start_new" | "continue">) => {
      void handleRandomSessionAction(action);
    },
    [handleRandomSessionAction]
  );

  const handlePlayPreviousEpisode = useCallback(() => {
    if (activeEpisodeState.previousEpisodeItem) {
      void startEpisodePlayback(
        activeEpisodeState.previousEpisodeItem.episode,
        playbackMode
      );
    }
  }, [activeEpisodeState.previousEpisodeItem, playbackMode, startEpisodePlayback]);

  const handlePlayNextEpisode = useCallback(() => {
    if (activeEpisodeState.nextEpisodeItem) {
      void startEpisodePlayback(
        activeEpisodeState.nextEpisodeItem.episode,
        playbackMode
      );
    }
  }, [activeEpisodeState.nextEpisodeItem, playbackMode, startEpisodePlayback]);

  const handleSelectEpisode = useCallback(
    (episodeId: string) => {
      const selectedEpisode = orderedEpisodes.find(
        ({ episode }) => episode.id === episodeId
      )?.episode;

      if (selectedEpisode) {
        void startEpisodePlayback(selectedEpisode, playbackMode);
      }
    },
    [orderedEpisodes, playbackMode, startEpisodePlayback]
  );

  const handlePlayDeepLink = useCallback(
    (episodeId: string, startTime?: number) => {
      const selectedEpisode = orderedEpisodes.find(
        ({ episode }) => episode.id === episodeId
      )?.episode;

      if (!selectedEpisode) {
        return false;
      }

      playEpisode(selectedEpisode, {
        mode: "continue",
        startTime:
          typeof startTime === "number" && Number.isFinite(startTime) && startTime > 0
            ? startTime
            : undefined,
      });
      return true;
    },
    [orderedEpisodes, playEpisode]
  );

  const handlePlayExternal = useCallback(
    async (episode: Episode) => {
      if (!episode.filePath) {
        setNotice({
          tone: "error",
          message: "File path missing for this episode.",
        });
        return;
      }

      setPlayingEpisodeId(episode.id);
      setNotice(null);

      try {
        await launchExternalPlayback(episode.filePath);
        setNotice({
          tone: "success",
          message: `Playing ${getEpisodeDisplayTitle(episode)} in external player.`,
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to launch player.",
        });
      } finally {
        setPlayingEpisodeId(null);
      }
    },
    [setNotice]
  );

  const handleEpisodeTimeUpdate = useCallback(
    (episodeId: string, currentTime: number, duration: number) => {
      updateEpisodeInState(
        episodeId,
        buildEpisodeProgressUpdate(currentTime, duration)
      );
      persistWatchProgress(episodeId, currentTime, duration);
    },
    [persistWatchProgress, updateEpisodeInState]
  );

  const handleEpisodeEnded = useCallback(
    (episodeId: string, currentTime: number, duration: number) => {
      const { completedTime, updates } = buildEpisodeEndedUpdate(
        currentTime,
        duration
      );

      updateEpisodeInState(episodeId, updates);
      persistWatchProgress(episodeId, completedTime, completedTime);

      if (playbackMode === "random") {
        void handleRandomSessionAction("next_random");
        return;
      }

      if (activeEpisodeState.nextEpisodeItem) {
        void startEpisodePlayback(activeEpisodeState.nextEpisodeItem.episode, "continue");
      }
    },
    [
      activeEpisodeState.nextEpisodeItem,
      handleRandomSessionAction,
      persistWatchProgress,
      playbackMode,
      startEpisodePlayback,
      updateEpisodeInState,
    ]
  );

  return {
    playingEpisodeId,
    activeEpisodeId,
    activeEpisode: activeEpisodeState.activeEpisode,
    previousEpisodeItem: activeEpisodeState.previousEpisodeItem,
    nextEpisodeItem: activeEpisodeState.nextEpisodeItem,
    playerStartTime,
    playbackMode,
    randomAction,
    orderedEpisodes,
    episodeSelectorSeasons,
    continueEpisode,
    allWatched,
    handlePlay,
    handlePlayContinue,
    handlePlayRandom,
    handlePlayExternal,
    handleClosePlayer,
    handlePlayPreviousEpisode,
    handlePlayNextEpisode,
    handleSelectEpisode,
    handlePlayDeepLink,
    handleEpisodeTimeUpdate,
    handleEpisodeEnded,
    handleRandomSessionAction,
  };
}
