"use client";

import { useParams, useRouter } from "next/navigation";
import { MovieDetailMainContent } from "@/features/movie-detail/components/MovieDetailMainContent";
import { MovieEditModal } from "@/features/movie-detail/components/MovieEditModal";
import { MovieHeroHeader } from "@/features/movie-detail/components/MovieHeroHeader";
import { MovieInfoModal } from "@/features/movie-detail/components/MovieInfoModal";
import { useMovieDetailController } from "@/features/movie-detail/useMovieDetailController";

export default function MovieDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const movieId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const controller = useMovieDetailController({
    movieId,
    onDeleted: () => router.push("/"),
  });

  return (
    <div className="min-h-screen pb-20">
      <MovieHeroHeader
        movie={controller.movie}
        loading={controller.loading}
        playing={controller.playing}
        savingWatched={controller.savingWatched}
        onPlay={controller.handlePlay}
        onPlayExternal={controller.handlePlayExternal}
        onWatchedToggle={controller.handleWatchedChange}
        onOpenEdit={() => controller.setIsEditModalOpen(true)}
        onOpenInfo={() => controller.setIsInfoModalOpen(true)}
      />

      <MovieDetailMainContent
        notice={controller.notice}
        showPlayer={controller.showPlayer}
        movie={controller.movie}
        loading={controller.loading}
        posterUrl={controller.posterUrl}
        hasMissingBasicInfo={controller.hasMissingBasicInfo}
        refreshing={controller.refreshing}
        onRefreshPoster={controller.handleRefreshPoster}
        onClosePlayer={controller.handleClosePlayer}
        onPlayerError={controller.handlePlayerError}
        onPlayerTimeUpdate={controller.handlePlayerTimeUpdate}
        onExternalPlayer={controller.handlePlayExternal}
      />

      <MovieEditModal
        movie={controller.movie}
        isOpen={controller.isEditModalOpen}
        onClose={() => controller.setIsEditModalOpen(false)}
        title={controller.title}
        onTitleChange={controller.setTitle}
        posterInput={controller.posterInput}
        onPosterInputChange={controller.setPosterInput}
        folderImages={controller.folderImages}
        folderImagesLoading={controller.folderImagesLoading}
        folderImagesError={controller.folderImagesError}
        selectedFolderImage={controller.selectedFolderImage}
        onSelectedFolderImageChange={controller.setSelectedFolderImage}
        onUseSelectedFolderImage={() =>
          controller.setPosterInput(controller.selectedFolderImage)
        }
        saving={controller.saving}
        onSave={controller.handleSave}
        refreshing={controller.refreshing}
        onRefreshPoster={controller.handleRefreshPoster}
        onClearPoster={() => controller.setPosterInput("")}
        userGenres={controller.userGenres}
        savingGenres={controller.savingGenres}
        onRemoveGenre={(genreName) =>
          controller.handleSaveGenres(
            controller.userGenres.filter((genre) => genre !== genreName)
          )
        }
        genreInput={controller.genreInput}
        onGenreInputChange={controller.setGenreInput}
        onAddGenre={() => {
          const next = controller.genreInput.trim();
          if (!next) return;
          void controller.handleSaveGenres([...controller.userGenres, next]);
        }}
        savingXxxRated={controller.savingXxxRated}
        onXxxRatedChange={controller.handleXxxRatedChange}
        deleting={controller.deleting}
        onDelete={controller.handleDelete}
      />

      <MovieInfoModal
        movie={controller.movie}
        isOpen={controller.isInfoModalOpen}
        onClose={() => controller.setIsInfoModalOpen(false)}
      />
    </div>
  );
}

