import type { DeletedMovieRow, DeletedSeasonRow } from "@/lib/storage/types";

type DeletedItemLifecycleDependencies = {
  movieRepository: {
    listDeletedMovies(): DeletedMovieRow[];
    countDeletedMovies(): number;
    purgeDeletedMovies(): void;
    purgeMoviesByIds(ids: string[]): void;
    restoreMoviesByIds(ids: string[]): void;
  };
  seasonRepository: {
    listDeletedSeasons(): DeletedSeasonRow[];
    listDeletedSeasonIds(): string[];
    countDeletedSeasons(): number;
    purgeDeletedSeasons(): void;
    purgeSeasonsByIds(ids: string[]): void;
    restoreSeasonsByIds(ids: string[]): void;
  };
  episodeRepository: {
    countDeletedEpisodes(): number;
    deleteEpisodesBySeasonIds(seasonIds: string[]): void;
    restoreEpisodesBySeasonIds(seasonIds: string[]): void;
    purgeDeletedEpisodes(): void;
  };
};

export function createDeletedItemLifecycleService({
  movieRepository,
  seasonRepository,
  episodeRepository,
}: DeletedItemLifecycleDependencies) {
  return {
    listDeletedMovies(): DeletedMovieRow[] {
      return movieRepository.listDeletedMovies();
    },

    listDeletedSeasons(): DeletedSeasonRow[] {
      return seasonRepository.listDeletedSeasons();
    },

    countDeletedItems(): {
      movies: number;
      seasons: number;
      episodes: number;
      total: number;
    } {
      const movies = movieRepository.countDeletedMovies();
      const seasons = seasonRepository.countDeletedSeasons();
      const episodes = episodeRepository.countDeletedEpisodes();
      return { movies, seasons, episodes, total: movies + seasons + episodes };
    },

    purgeDeletedItems(): number {
      const deletedMovieCount = movieRepository.countDeletedMovies();
      const deletedSeasonIds = seasonRepository.listDeletedSeasonIds();

      movieRepository.purgeDeletedMovies();
      episodeRepository.deleteEpisodesBySeasonIds(deletedSeasonIds);
      seasonRepository.purgeDeletedSeasons();
      episodeRepository.purgeDeletedEpisodes();

      return deletedMovieCount + deletedSeasonIds.length;
    },

    purgeMoviesByIds(ids: string[]) {
      movieRepository.purgeMoviesByIds(ids);
    },

    purgeSeasonsByIds(ids: string[]) {
      episodeRepository.deleteEpisodesBySeasonIds(ids);
      seasonRepository.purgeSeasonsByIds(ids);
    },

    restoreMoviesByIds(ids: string[]) {
      movieRepository.restoreMoviesByIds(ids);
    },

    restoreSeasonsByIds(ids: string[]) {
      seasonRepository.restoreSeasonsByIds(ids);
      episodeRepository.restoreEpisodesBySeasonIds(ids);
    },
  };
}
