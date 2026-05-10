"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";
import { VideoPlayer } from "@/components/VideoPlayer";
import { tmdbImageUrl } from "@/lib/format";
import { SeriesDetailHero } from "./SeriesDetailHero";
import { SeriesDetailSidebar } from "./SeriesDetailSidebar";
import { SeriesEditModal } from "./SeriesEditModal";
import { SeriesEpisodesSection } from "./SeriesEpisodesSection";
import { SeriesInfoModal } from "./SeriesInfoModal";
import {
  getCastCrew,
  getEpisodePlayerTitle,
  getHasMissingBasicInfo,
  getPosterPreview,
  getSeasonSummary,
  getSeriesRating,
} from "./series-detail.selectors";
import type { SeriesNotice } from "./series-detail.types";
import { useSeriesDetailData } from "./useSeriesDetailData";
import { useSeriesEditController } from "./useSeriesEditController";
import { useSeriesPlaybackController } from "./useSeriesPlaybackController";

export default function SeriesDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const seriesId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [notice, setNotice] = useState<SeriesNotice | null>(null);
  const didApplyDeepLinkRef = useRef(false);

  const data = useSeriesDetailData({ seriesId, setNotice });
  const playback = useSeriesPlaybackController({
    seasons: data.seasons,
    setNotice,
    updateEpisodeInState: data.updateEpisodeInState,
    requestRandomSessionAction: data.requestRandomSessionAction,
  });
  const edit = useSeriesEditController({
    series: data.series,
    setSeries: data.setSeries,
    applySeriesDetail: data.applySeriesDetail,
    setNotice,
    onDeleteSuccess: () => router.push("/"),
  });

  const seasonSummary = useMemo(
    () => getSeasonSummary(data.series),
    [data.series]
  );
  const seriesRating = useMemo(() => getSeriesRating(data.seasons), [data.seasons]);
  const castCrew = useMemo(() => getCastCrew(data.seasons), [data.seasons]);
  const posterPreview = useMemo(
    () => getPosterPreview(edit.posterInput, data.series),
    [data.series, edit.posterInput]
  );
  const posterUrl = useMemo(
    () => tmdbImageUrl(posterPreview, "w780"),
    [posterPreview]
  );
  const hasMissingBasicInfo = useMemo(
    () => getHasMissingBasicInfo(data.series, seriesRating),
    [data.series, seriesRating]
  );

  useEffect(() => {
    if (didApplyDeepLinkRef.current) return;
    if (!data.series) return;

    const autoplay = searchParams.get("autoplay");
    if (autoplay !== "1" && autoplay !== "true") return;

    const episodeId = searchParams.get("episodeId");
    if (!episodeId) return;

    const timeParam = searchParams.get("t");
    const parsed = timeParam == null ? NaN : Number(timeParam);
    const startTime = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;

    if (playback.handlePlayDeepLink(episodeId, startTime)) {
      didApplyDeepLinkRef.current = true;
    }
  }, [data.series, playback, searchParams]);

  return (
    <div className="min-h-screen pb-20">
      <SeriesDetailHero
        series={data.series}
        loading={data.loading}
        seasonSummary={seasonSummary}
        seriesRating={seriesRating}
        continueEpisode={playback.continueEpisode}
        allWatched={playback.allWatched}
        hasEpisodes={playback.orderedEpisodes.length > 0}
        randomSession={data.randomSession}
        randomSessionLoading={data.randomSessionLoading}
        randomAction={playback.randomAction}
        onPlayContinue={playback.handlePlayContinue}
        onPlayRandom={playback.handlePlayRandom}
        onOpenEdit={edit.openEditModal}
        onOpenInfo={edit.openInfoModal}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 2xl:max-w-screen-2xl">
        {notice ? <StatusBanner tone={notice.tone} message={notice.message} /> : null}

        {playback.activeEpisode ? (
          <VideoPlayer
            title={getEpisodePlayerTitle(playback.activeEpisode)}
            streamUrl={`/api/episodes/${playback.activeEpisode.id}/stream`}
            hlsUrl={`/api/episodes/${playback.activeEpisode.id}/hls/master.m3u8`}
            thumbnailsVttUrl={`/api/episodes/${playback.activeEpisode.id}/storyboard/vtt`}
            startTime={playback.playerStartTime}
            onClose={playback.handleClosePlayer}
            onError={(message) => setNotice({ tone: "error", message })}
            onTimeUpdate={(currentTime, duration) =>
              playback.handleEpisodeTimeUpdate(
                playback.activeEpisode!.id,
                currentTime,
                duration
              )
            }
            onEnded={(currentTime, duration) =>
              playback.handleEpisodeEnded(
                playback.activeEpisode!.id,
                currentTime,
                duration
              )
            }
            onExternalPlayer={() =>
              playback.handlePlayExternal(playback.activeEpisode!)
            }
            onPreviousEpisode={
              playback.previousEpisodeItem
                ? playback.handlePlayPreviousEpisode
                : undefined
            }
            previousEpisode={playback.previousEpisodeItem?.target}
            onNextEpisode={
              playback.nextEpisodeItem ? playback.handlePlayNextEpisode : undefined
            }
            nextEpisode={playback.nextEpisodeItem?.target}
            episodeSeasons={playback.episodeSelectorSeasons}
            onSelectEpisode={playback.handleSelectEpisode}
            mediaType="episode"
            mediaId={playback.activeEpisode.id}
            initialSubtitleId={playback.activeEpisode.selectedSubtitleId ?? null}
            initialSubtitlesEnabled={
              playback.activeEpisode.subtitlesEnabled ?? false
            }
            isRandomMode={playback.playbackMode === "random"}
            onRandomEpisode={
              playback.playbackMode === "random" && playback.randomAction === null
                ? () => void playback.handleRandomSessionAction("next_random")
                : undefined
            }
          />
        ) : null}

        {data.loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted 2xl:text-base">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Loading series...
          </div>
        ) : null}

        {!data.loading && !data.series ? (
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

        {!data.loading && data.series ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <SeriesDetailSidebar
              series={data.series}
              posterUrl={posterUrl}
              hasMissingBasicInfo={hasMissingBasicInfo}
              refreshing={edit.refreshing}
              castCrew={castCrew}
              onRefreshPoster={edit.handleRefreshPoster}
            />
            <SeriesEpisodesSection
              seasons={data.seasons}
              togglingWatched={data.togglingWatched}
              playingEpisodeId={playback.playingEpisodeId}
              onToggleEpisodeWatched={data.handleToggleEpisodeWatched}
              onPlayEpisode={playback.handlePlay}
              onPlayExternal={playback.handlePlayExternal}
            />
          </div>
        ) : null}
      </main>

      <SeriesEditModal
        series={data.series}
        isOpen={edit.isEditModalOpen}
        title={edit.title}
        posterInput={edit.posterInput}
        folderImages={edit.folderImages}
        folderImagesLoading={edit.folderImagesLoading}
        folderImagesError={edit.folderImagesError}
        selectedFolderImage={edit.selectedFolderImage}
        saving={edit.saving}
        refreshing={edit.refreshing}
        deleting={edit.deleting}
        onClose={edit.closeEditModal}
        onTitleChange={edit.setTitle}
        onPosterInputChange={edit.setPosterInput}
        onSelectedFolderImageChange={edit.setSelectedFolderImage}
        onUseSelectedFolderImage={edit.useSelectedFolderImage}
        onSave={edit.handleSave}
        onRefreshPoster={edit.handleRefreshPoster}
        onClearPoster={edit.clearPoster}
        onDelete={edit.handleDelete}
      />

      <SeriesInfoModal
        series={data.series}
        isOpen={edit.isInfoModalOpen}
        onClose={edit.closeInfoModal}
      />
    </div>
  );
}
