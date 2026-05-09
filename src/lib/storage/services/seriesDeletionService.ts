type SeriesDeletionDependencies = {
  seriesRepository: {
    getSeriesFolderPathById(seriesId: string): string | null;
    deleteSeries(id: string): void;
  };
  seasonRepository: {
    listSeasonsBySeriesFolderPath(seriesFolderPath: string): Array<{ id: string }>;
    deleteSeasonsBySeriesFolderPath(seriesFolderPath: string): void;
  };
  episodeRepository: {
    deleteEpisodesBySeasonIds(seasonIds: string[]): void;
  };
  seriesRandomSessionRepository: {
    deleteSeriesRandomSession(seriesId: string): void;
  };
};

export function createSeriesDeletionService({
  seriesRepository,
  seasonRepository,
  episodeRepository,
  seriesRandomSessionRepository,
}: SeriesDeletionDependencies) {
  return {
    deleteSeries(seriesId: string) {
      const seriesFolderPath = seriesRepository.getSeriesFolderPathById(seriesId);
      if (!seriesFolderPath) return;

      const seasonIds = seasonRepository
        .listSeasonsBySeriesFolderPath(seriesFolderPath)
        .map((season) => season.id);

      episodeRepository.deleteEpisodesBySeasonIds(seasonIds);
      seasonRepository.deleteSeasonsBySeriesFolderPath(seriesFolderPath);
      seriesRepository.deleteSeries(seriesId);
      seriesRandomSessionRepository.deleteSeriesRandomSession(seriesId);
    },
  };
}
