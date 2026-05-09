import Link from "next/link";
import { Loader2 } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";
import { VideoPlayer } from "@/components/VideoPlayer";
import { MovieCastCrewCard } from "@/features/movie-detail/components/MovieCastCrewCard";
import { MoviePosterSidebar } from "@/features/movie-detail/components/MoviePosterSidebar";
import type { Notice } from "@/features/movie-detail/types";
import { tmdbImageUrl } from "@/lib/format";
import type { Movie } from "@/lib/types";

type MovieDetailMainContentProps = {
  notice: Notice | null;
  showPlayer: boolean;
  movie: Movie | null;
  loading: boolean;
  posterUrl: string | null;
  hasMissingBasicInfo: boolean;
  refreshing: boolean;
  onRefreshPoster: () => void;
  onClosePlayer: () => void;
  onPlayerError: (message: string) => void;
  onPlayerTimeUpdate: (currentTime: number, duration: number) => void;
  onExternalPlayer: () => void;
};

export function MovieDetailMainContent({
  notice,
  showPlayer,
  movie,
  loading,
  posterUrl,
  hasMissingBasicInfo,
  refreshing,
  onRefreshPoster,
  onClosePlayer,
  onPlayerError,
  onPlayerTimeUpdate,
  onExternalPlayer,
}: MovieDetailMainContentProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 2xl:max-w-screen-2xl">
      {notice ? <StatusBanner tone={notice.tone} message={notice.message} /> : null}

      {showPlayer && movie ? (
        <VideoPlayer
          title={movie.titleClean}
          streamUrl={`/api/movies/${movie.id}/stream`}
          hlsUrl={`/api/movies/${movie.id}/hls/master.m3u8`}
          posterUrl={
            movie.backdropPath
              ? tmdbImageUrl(movie.backdropPath, "w780") ?? undefined
              : undefined
          }
          thumbnailsVttUrl={`/api/movies/${movie.id}/storyboard/vtt`}
          startTime={movie.watchProgressSeconds ?? 0}
          onClose={onClosePlayer}
          onError={onPlayerError}
          onTimeUpdate={onPlayerTimeUpdate}
          onExternalPlayer={onExternalPlayer}
          mediaType="movie"
          mediaId={movie.id}
          initialSubtitleId={movie.selectedSubtitleId ?? null}
          initialSubtitlesEnabled={movie.subtitlesEnabled ?? false}
        />
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-10 text-sm text-muted 2xl:text-base">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          Loading movie...
        </div>
      ) : null}

      {!loading && !movie ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-12 text-center 2xl:p-16">
          <p className="font-serif text-lg font-medium text-foreground 2xl:text-xl">
            Movie not found
          </p>
          <p className="text-sm text-muted 2xl:text-base">
            The movie you are looking for could not be loaded.
          </p>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground 2xl:py-2 2xl:text-base"
          >
            Return to library
          </Link>
        </div>
      ) : null}

      {!loading && movie ? (
        <div className="flex flex-col md:flex-row gap-8">
          <MoviePosterSidebar
            movie={movie}
            posterUrl={posterUrl}
            hasMissingBasicInfo={hasMissingBasicInfo}
            refreshing={refreshing}
            onRefreshPoster={onRefreshPoster}
          />
          <div className="flex-1 flex flex-col gap-8">
            <MovieCastCrewCard movie={movie} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
