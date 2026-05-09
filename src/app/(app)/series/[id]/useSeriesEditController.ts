"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Series } from "@/lib/types";
import {
  deleteSeriesDetail,
  fetchFolderImages,
  refreshSeriesPoster,
  updateSeriesDetail,
} from "./series-detail.api";
import {
  getInitialSelectedFolderImage,
  getMatchingFolderImageUrl,
} from "./series-detail.selectors";
import type {
  FolderImage,
  SeriesDetailResponse,
  SeriesNotice,
} from "./series-detail.types";

type UseSeriesEditControllerOptions = {
  series: Series | null;
  setSeries: Dispatch<SetStateAction<Series | null>>;
  applySeriesDetail: (detail: SeriesDetailResponse) => void;
  setNotice: Dispatch<SetStateAction<SeriesNotice | null>>;
  onDeleteSuccess: () => void;
};

export function useSeriesEditController({
  series,
  setSeries,
  applySeriesDetail,
  setNotice,
  onDeleteSuccess,
}: UseSeriesEditControllerOptions) {
  const [title, setTitle] = useState("");
  const [posterInput, setPosterInput] = useState("");
  const [folderImages, setFolderImages] = useState<FolderImage[]>([]);
  const [folderImagesLoading, setFolderImagesLoading] = useState(false);
  const [folderImagesError, setFolderImagesError] = useState<string | null>(null);
  const [selectedFolderImage, setSelectedFolderImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const seriesId = series?.id;

  useEffect(() => {
    setTitle(series?.titleClean ?? "");
    setPosterInput(series?.posterPath ?? "");
  }, [series?.id, series?.posterPath, series?.titleClean]);

  const loadFolderImages = useCallback(
    async (id: string, currentPoster: string | null) => {
      setFolderImagesLoading(true);
      setFolderImagesError(null);

      try {
        const data = await fetchFolderImages(id);
        setFolderImages(data.images);
        setSelectedFolderImage(
          getInitialSelectedFolderImage(data.images, currentPoster)
        );
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

  useEffect(() => {
    if (!seriesId) {
      setFolderImages([]);
      setFolderImagesLoading(false);
      setFolderImagesError(null);
      setSelectedFolderImage("");
      return;
    }

    void loadFolderImages(seriesId, series?.posterPath ?? null);
  }, [loadFolderImages, series?.posterPath, seriesId]);

  useEffect(() => {
    const matchedUrl = getMatchingFolderImageUrl(folderImages, posterInput);
    if (matchedUrl && matchedUrl !== selectedFolderImage) {
      setSelectedFolderImage(matchedUrl);
    }
  }, [folderImages, posterInput, selectedFolderImage]);

  const isSaveDisabled = useMemo(() => saving || !series, [saving, series]);

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
      const detail = await updateSeriesDetail(series.id, updates);
      applySeriesDetail(detail);
      setTitle(detail.series.titleClean);
      setPosterInput(detail.series.posterPath ?? "");
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
  }, [applySeriesDetail, posterInput, series, setNotice, title]);

  const handleRefreshPoster = useCallback(async () => {
    if (!series) return;

    setRefreshing(true);
    setNotice(null);

    try {
      const refreshedSeries = await refreshSeriesPoster(series.id);
      setSeries((current) =>
        current
          ? { ...current, posterPath: refreshedSeries.posterPath ?? null }
          : current
      );
      setPosterInput(refreshedSeries.posterPath ?? "");
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
  }, [series, setNotice, setSeries]);

  const handleDelete = useCallback(async () => {
    if (!series) return;

    if (
      !window.confirm(
        "Remove this series from your library? Files on disk will not be deleted."
      )
    ) {
      return;
    }

    setDeleting(true);
    setNotice(null);

    try {
      await deleteSeriesDetail(series.id);
      onDeleteSuccess();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to remove series.",
      });
      setDeleting(false);
    }
  }, [onDeleteSuccess, series, setNotice]);

  return {
    title,
    setTitle,
    posterInput,
    setPosterInput,
    folderImages,
    folderImagesLoading,
    folderImagesError,
    selectedFolderImage,
    setSelectedFolderImage,
    saving,
    refreshing,
    deleting,
    isSaveDisabled,
    isEditModalOpen,
    isInfoModalOpen,
    openEditModal: () => setIsEditModalOpen(true),
    closeEditModal: () => setIsEditModalOpen(false),
    openInfoModal: () => setIsInfoModalOpen(true),
    closeInfoModal: () => setIsInfoModalOpen(false),
    handleSave,
    handleRefreshPoster,
    handleDelete,
    clearPoster: () => setPosterInput(""),
    useSelectedFolderImage: () => setPosterInput(selectedFolderImage),
  };
}
