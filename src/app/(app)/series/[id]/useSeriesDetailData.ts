"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";
import {
  fetchRandomSession,
  fetchSeriesDetail,
  runRandomSessionAction,
  updateEpisodeWatched,
} from "./series-detail.api";
import { updateEpisodeInSeasons } from "./series-detail.selectors";
import type {
  RandomSessionActionPayload,
  RandomSessionResponse,
  RandomSessionSummary,
  SeriesDetailResponse,
  SeriesNotice,
} from "./series-detail.types";

type UseSeriesDetailDataOptions = {
  seriesId?: string;
  setNotice: Dispatch<SetStateAction<SeriesNotice | null>>;
};

export function useSeriesDetailData({
  seriesId,
  setNotice,
}: UseSeriesDetailDataOptions) {
  const [series, setSeries] = useState<Series | null>(null);
  const [seasons, setSeasons] = useState<SeasonWithEpisodes[]>([]);
  const [loading, setLoading] = useState(true);
  const [randomSession, setRandomSession] = useState<RandomSessionSummary | null>(
    null
  );
  const [randomSessionLoading, setRandomSessionLoading] = useState(false);
  const [togglingWatched, setTogglingWatched] = useState<Set<string>>(new Set());

  const applySeriesDetail = useCallback((detail: SeriesDetailResponse) => {
    setSeries(detail.series);
    setSeasons(detail.seasons ?? detail.series.seasons ?? []);
  }, []);

  const loadRandomSession = useCallback(
    async (id: string) => {
      setRandomSessionLoading(true);

      try {
        const data = await fetchRandomSession(id);
        setRandomSession(data.session ?? null);
      } catch (error) {
        setRandomSession(null);
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load random session.",
        });
      } finally {
        setRandomSessionLoading(false);
      }
    },
    [setNotice]
  );

  const fetchSeries = useCallback(async () => {
    if (!seriesId) {
      setNotice({ tone: "error", message: "Missing series id in URL." });
      setSeries(null);
      setSeasons([]);
      setRandomSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const detail = await fetchSeriesDetail(seriesId);
      applySeriesDetail(detail);
      void loadRandomSession(detail.series.id);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to load series.",
      });
      setSeries(null);
      setSeasons([]);
      setRandomSession(null);
    } finally {
      setLoading(false);
    }
  }, [applySeriesDetail, loadRandomSession, seriesId, setNotice]);

  useEffect(() => {
    void fetchSeries();
  }, [fetchSeries]);

  const requestRandomSessionAction = useCallback(
    async (payload: RandomSessionActionPayload): Promise<RandomSessionResponse> => {
      if (!seriesId) {
        throw new Error("Missing series id in URL.");
      }

      const data = await runRandomSessionAction(seriesId, payload);
      setRandomSession(data.session ?? null);
      return data;
    },
    [seriesId]
  );

  const updateEpisodeInState = useCallback(
    (episodeId: string, updates: Partial<Episode>) => {
      setSeasons((current) => updateEpisodeInSeasons(current, episodeId, updates));
    },
    []
  );

  const handleToggleEpisodeWatched = useCallback(
    async (episode: Episode, checked: boolean) => {
      setTogglingWatched((current) => new Set(current).add(episode.id));

      try {
        const updatedEpisode = await updateEpisodeWatched(episode.id, checked);
        updateEpisodeInState(episode.id, { watched: updatedEpisode.watched });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to update episode.",
        });
      } finally {
        setTogglingWatched((current) => {
          const next = new Set(current);
          next.delete(episode.id);
          return next;
        });
      }
    },
    [setNotice, updateEpisodeInState]
  );

  return {
    series,
    setSeries,
    seasons,
    setSeasons,
    loading,
    randomSession,
    randomSessionLoading,
    togglingWatched,
    applySeriesDetail,
    fetchSeries,
    requestRandomSessionAction,
    updateEpisodeInState,
    handleToggleEpisodeWatched,
  };
}
