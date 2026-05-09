"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { RefObject } from "react";
import type { SubtitleFile, SubtitleSearchResult } from "@/lib/types";
import { createInitialSubtitleState, subtitleReducer } from "@/components/video-player/state";

type UseSubtitleManagerOptions = {
  mediaId?: string;
  mediaType?: "movie" | "episode";
  initialSubtitleId?: string | null;
  initialSubtitlesEnabled?: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
};

function getSubtitleEndpoint(
  mediaType: "movie" | "episode",
  mediaId: string,
  suffix = ""
) {
  const segment = mediaType === "movie" ? "movies" : "episodes";
  return `/api/${segment}/${mediaId}/subtitles${suffix}`;
}

export function useSubtitleManager({
  mediaId,
  mediaType,
  initialSubtitleId,
  initialSubtitlesEnabled,
  videoRef,
}: UseSubtitleManagerOptions) {
  const [state, dispatch] = useReducer(subtitleReducer, undefined, createInitialSubtitleState);

  const saveSubtitlePreference = useCallback(
    (subtitleId: string | null, enabled: boolean) => {
      if (!mediaId || !mediaType) return;
      fetch(getSubtitleEndpoint(mediaType, mediaId, "/preference"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedSubtitleId: subtitleId, enabled }),
      }).catch(() => {});
    },
    [mediaId, mediaType]
  );

  useEffect(() => {
    dispatch({ type: "reset" });

    if (!mediaId || !mediaType) return;

    let cancelled = false;

    fetch(getSubtitleEndpoint(mediaType, mediaId))
      .then((response) => response.json())
      .then((data: { subtitles?: SubtitleFile[] }) => {
        if (cancelled) return;
        const subtitles = data.subtitles ?? [];

        let activeSubtitleId: string | null = null;
        let subtitlesEnabled = false;

        if (initialSubtitleId) {
          const initialSubtitle = subtitles.find(
            (subtitle) => subtitle.id === initialSubtitleId
          );
          if (initialSubtitle) {
            activeSubtitleId = initialSubtitle.id;
            subtitlesEnabled = initialSubtitlesEnabled ?? false;
          }
        }

        if (!activeSubtitleId) {
          const englishSubtitle = subtitles.find((subtitle) => subtitle.language === "en");
          if (englishSubtitle) {
            activeSubtitleId = englishSubtitle.id;
          }
        }

        dispatch({
          type: "load-success",
          subtitles,
          activeSubtitleId,
          subtitlesEnabled,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initialSubtitleId, initialSubtitlesEnabled, mediaId, mediaType]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!state.activeSubtitleId || !state.subtitlesEnabled) {
      Array.from(video.textTracks).forEach((track) => {
        track.mode = "disabled";
      });
      return;
    }

    const existingTracks = Array.from(
      video.querySelectorAll("track[data-aperture-subtitle]")
    );
    existingTracks.forEach((track) => track.remove());

    const trackElement = document.createElement("track");
    trackElement.setAttribute("data-aperture-subtitle", "1");
    trackElement.kind = "subtitles";
    trackElement.src = `/api/subtitles/${state.activeSubtitleId}/track`;
    trackElement.default = true;
    video.appendChild(trackElement);

    const enableTrack = () => {
      if (trackElement.track) trackElement.track.mode = "showing";
    };

    trackElement.addEventListener("load", enableTrack);
    enableTrack();

    return () => {
      trackElement.removeEventListener("load", enableTrack);
      if (video.contains(trackElement)) {
        video.removeChild(trackElement);
      }
      Array.from(video.textTracks).forEach((track) => {
        track.mode = "disabled";
      });
    };
  }, [state.activeSubtitleId, state.subtitlesEnabled, videoRef]);

  const selectSubtitle = useCallback(
    (subtitleId: string) => {
      dispatch({ type: "set-active-subtitle", value: subtitleId });
      dispatch({ type: "set-subtitles-enabled", value: true });
      saveSubtitlePreference(subtitleId, true);
    },
    [saveSubtitlePreference]
  );

  const toggleSubtitles = useCallback(() => {
    if (!state.activeSubtitleId) return;
    const nextEnabled = !state.subtitlesEnabled;
    dispatch({ type: "set-subtitles-enabled", value: nextEnabled });
    saveSubtitlePreference(state.activeSubtitleId, nextEnabled);
  }, [saveSubtitlePreference, state.activeSubtitleId, state.subtitlesEnabled]);

  const searchSubtitles = useCallback(async () => {
    if (!mediaId || !mediaType) return;

    dispatch({ type: "search-start" });

    try {
      const response = await fetch(getSubtitleEndpoint(mediaType, mediaId, "/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: state.subtitleSearchQuery || undefined,
          language: state.subtitleSearchLanguage,
        }),
      });
      const data = (await response.json()) as {
        results?: SubtitleSearchResult[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Search failed.");
      dispatch({ type: "search-success", results: data.results ?? [] });
    } catch (error) {
      dispatch({
        type: "search-error",
        value: error instanceof Error ? error.message : "Search failed.",
      });
    }
  }, [
    mediaId,
    mediaType,
    state.subtitleSearchLanguage,
    state.subtitleSearchQuery,
  ]);

  const downloadSubtitle = useCallback(
    async (result: SubtitleSearchResult) => {
      if (!mediaId || !mediaType) return;

      dispatch({ type: "download-start", value: result.fileId });

      try {
        const response = await fetch(getSubtitleEndpoint(mediaType, mediaId, "/download"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_id: result.fileId,
            file_name: result.fileName,
            language: result.language,
          }),
        });
        const data = (await response.json()) as {
          subtitle?: SubtitleFile;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Download failed.");
        if (!data.subtitle) return;
        dispatch({ type: "download-success", subtitle: data.subtitle });
        dispatch({ type: "set-active-subtitle", value: data.subtitle.id });
        dispatch({ type: "set-subtitles-enabled", value: true });
        saveSubtitlePreference(data.subtitle.id, true);
      } catch (error) {
        dispatch({
          type: "download-error",
          value: error instanceof Error ? error.message : "Download failed.",
        });
      }
    },
    [mediaId, mediaType, saveSubtitlePreference]
  );

  const deleteSubtitle = useCallback(
    async (subtitleId: string) => {
      if (!mediaId || !mediaType) return;

      dispatch({ type: "delete-start", value: subtitleId });

      try {
        const response = await fetch(getSubtitleEndpoint(mediaType, mediaId, `/${subtitleId}`), {
          method: "DELETE",
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Delete failed.");
        }
        const clearActive = state.activeSubtitleId === subtitleId;
        dispatch({ type: "delete-success", subtitleId, clearActive });
        if (clearActive) {
          saveSubtitlePreference(null, false);
        }
      } catch (error) {
        dispatch({
          type: "delete-error",
          value: error instanceof Error ? error.message : "Delete failed.",
        });
      }
    },
    [mediaId, mediaType, saveSubtitlePreference, state.activeSubtitleId]
  );

  const actions = useMemo(
    () => ({
      setSubtitleSearchQuery(value: string) {
        dispatch({ type: "set-search-query", value });
      },
      setSubtitleSearchLanguage(value: string) {
        dispatch({ type: "set-search-language", value });
      },
      selectSubtitle,
      toggleSubtitles,
      searchSubtitles,
      downloadSubtitle,
      deleteSubtitle,
    }),
    [deleteSubtitle, downloadSubtitle, searchSubtitles, selectSubtitle, toggleSubtitles]
  );

  return {
    state,
    actions,
  };
}
