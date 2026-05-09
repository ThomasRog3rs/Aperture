import type {
  DeletedMovieRow,
  DeletedSeasonRow,
  EpisodeRow,
  EpisodeUpdate,
  EpisodeUpsert,
  FolderScanEntryRow,
  FolderScanEntryUpsert,
  FolderScanStateRow,
  FolderScanStateUpsert,
  MovieQuery,
  MovieRow,
  MovieUpdate,
  MovieUpsert,
  SeasonQuery,
  SeasonRow,
  SeasonUpdate,
  SeasonUpsert,
  SeriesRandomSession,
  SeriesRow,
  SeriesUpdate,
  SeriesUpsert,
  SubtitleRow,
  SubtitleUpsert,
} from "./types";
import { createDeletedItemLifecycleService } from "./services/deletedItemLifecycleService";
import { createFilterAggregationService } from "./services/filterAggregationService";
import { createSeriesDeletionService } from "./services/seriesDeletionService";
import { createEpisodeRepository } from "./repositories/episodeRepository";
import { createFolderScanRepository } from "./repositories/folderScanRepository";
import { createMovieRepository } from "./repositories/movieRepository";
import { createSeasonRepository } from "./repositories/seasonRepository";
import { createSeriesRandomSessionRepository } from "./repositories/seriesRandomSessionRepository";
import { createSeriesRepository } from "./repositories/seriesRepository";
import { createSettingsRepository } from "./repositories/settingsRepository";
import { createSubtitleRepository } from "./repositories/subtitleRepository";

const settingsRepository = createSettingsRepository();
const folderScanRepository = createFolderScanRepository();
const movieRepository = createMovieRepository();
const seasonRepository = createSeasonRepository();
const episodeRepository = createEpisodeRepository();
const seriesRepository = createSeriesRepository();
const seriesRandomSessionRepository = createSeriesRandomSessionRepository();
const subtitleRepository = createSubtitleRepository();
const filterAggregationService = createFilterAggregationService({
  movieRepository,
  seasonRepository,
});
const deletedItemLifecycleService = createDeletedItemLifecycleService({
  movieRepository,
  seasonRepository,
  episodeRepository,
});
const seriesDeletionService = createSeriesDeletionService({
  seriesRepository,
  seasonRepository,
  episodeRepository,
  seriesRandomSessionRepository,
});

export function getSetting(key: string): string | null {
  return settingsRepository.getSetting(key);
}

export function setSetting(key: string, value: string) {
  settingsRepository.setSetting(key, value);
}

export function listAllFolderScanStates(): FolderScanStateRow[] {
  return folderScanRepository.listAllFolderScanStates();
}

export function listAllFolderScanEntries(): FolderScanEntryRow[] {
  return folderScanRepository.listAllFolderScanEntries();
}

export function saveFolderScanSnapshot(
  rootPath: string,
  states: FolderScanStateUpsert[],
  entries: FolderScanEntryUpsert[],
  lastSyncedAt: number
) {
  folderScanRepository.saveFolderScanSnapshot(rootPath, states, entries, lastSyncedAt);
}

export function upsertMovie(movie: MovieUpsert) {
  movieRepository.upsertMovie(movie);
}

export function upsertSeason(season: SeasonUpsert) {
  seasonRepository.upsertSeason(season);
}

export function upsertEpisode(episode: EpisodeUpsert) {
  episodeRepository.upsertEpisode(episode);
}

export function upsertSeries(series: SeriesUpsert) {
  seriesRepository.upsertSeries(series);
}

export function listMovies(query: MovieQuery): MovieRow[] {
  return movieRepository.listMovies(query);
}

export function listSeasons(query: SeasonQuery): SeasonRow[] {
  return seasonRepository.listSeasons(query);
}

export function listSeasonsBySeriesFolderPath(seriesFolderPath: string): SeasonRow[] {
  return seasonRepository.listSeasonsBySeriesFolderPath(seriesFolderPath);
}

export function listSeriesFolderPaths(): string[] {
  return seriesRepository.listSeriesFolderPaths();
}

export function getSeriesFolderPathById(seriesId: string): string | null {
  return seriesRepository.getSeriesFolderPathById(seriesId);
}

export function listGenres(): string[] {
  return filterAggregationService.listGenres();
}

export function listPeople(): {
  directors: string[];
  writers: string[];
  actors: string[];
} {
  return filterAggregationService.listPeople();
}

export function updateMovie(id: string, updates: MovieUpdate) {
  movieRepository.updateMovie(id, updates);
}

export function updateSeason(id: string, updates: SeasonUpdate) {
  seasonRepository.updateSeason(id, updates);
}

export function updateSeries(id: string, updates: SeriesUpdate) {
  seriesRepository.updateSeries(id, updates);
}

export function getSeriesRandomSession(seriesId: string): SeriesRandomSession | null {
  return seriesRandomSessionRepository.getSeriesRandomSession(seriesId);
}

export function replaceSeriesRandomSession(
  seriesId: string,
  startedEpisodeIds: string[] = [],
  currentEpisodeId: string | null = null
): SeriesRandomSession {
  return seriesRandomSessionRepository.replaceSeriesRandomSession(
    seriesId,
    startedEpisodeIds,
    currentEpisodeId
  );
}

export function deleteSeriesRandomSession(seriesId: string) {
  seriesRandomSessionRepository.deleteSeriesRandomSession(seriesId);
}

export function markSeriesRandomSessionEpisodeStarted(
  seriesId: string,
  episodeId: string
): SeriesRandomSession {
  return seriesRandomSessionRepository.markSeriesRandomSessionEpisodeStarted(seriesId, episodeId);
}

export function updatePersonalRating(id: string, personalRating: number | null) {
  movieRepository.updatePersonalRating(id, personalRating);
}

export function getMovieById(id: string): MovieRow | null {
  return movieRepository.getMovieById(id);
}

export function deleteMovie(id: string) {
  movieRepository.deleteMovie(id);
}

export function getSeasonById(id: string): SeasonRow | null {
  return seasonRepository.getSeasonById(id);
}

export function getSeriesById(id: string): SeriesRow | null {
  return seriesRepository.getSeriesById(id);
}

export function getSeriesByFolderPath(seriesFolderPath: string): SeriesRow | null {
  return seriesRepository.getSeriesByFolderPath(seriesFolderPath);
}

export function deleteSeries(id: string) {
  seriesDeletionService.deleteSeries(id);
}

export function deleteSeasonById(id: string) {
  seasonRepository.deleteSeasonById(id);
}

export function getEpisodesBySeasonId(seasonId: string): EpisodeRow[] {
  return episodeRepository.getEpisodesBySeasonId(seasonId);
}

export function countEpisodesBySeasonId(seasonId: string): number {
  return episodeRepository.countEpisodesBySeasonId(seasonId);
}

export function getEpisodeCountsBySeasonIds(seasonIds: string[]): Map<string, number> {
  return episodeRepository.getEpisodeCountsBySeasonIds(seasonIds);
}

export function getEpisodeById(id: string): EpisodeRow | null {
  return episodeRepository.getEpisodeById(id);
}

export function updateEpisode(id: string, updates: EpisodeUpdate) {
  episodeRepository.updateEpisode(id, updates);
}

export function markEpisodesDeletedNotInSeason(seasonId: string, filePaths: string[]) {
  episodeRepository.markEpisodesDeletedNotInSeason(seasonId, filePaths);
}

export function getAllMovieFolderPaths(): string[] {
  return movieRepository.getAllMovieFolderPaths();
}

export function getAllSeasonFolderPaths(): string[] {
  return seasonRepository.getAllSeasonFolderPaths();
}

export function markMoviesDeleted(folderPaths: string[]) {
  movieRepository.markMoviesDeleted(folderPaths);
}

export function markSeasonsDeleted(seasonFolderPaths: string[]) {
  seasonRepository.markSeasonsDeleted(seasonFolderPaths);
}

export function markSeasonDeleted(id: string) {
  seasonRepository.markSeasonDeleted(id);
}

export function listDeletedMovies(): DeletedMovieRow[] {
  return deletedItemLifecycleService.listDeletedMovies();
}

export function listDeletedSeasons(): DeletedSeasonRow[] {
  return deletedItemLifecycleService.listDeletedSeasons();
}

export function purgeMoviesByIds(ids: string[]) {
  deletedItemLifecycleService.purgeMoviesByIds(ids);
}

export function purgeSeasonsByIds(ids: string[]) {
  deletedItemLifecycleService.purgeSeasonsByIds(ids);
}

export function restoreMoviesByIds(ids: string[]) {
  deletedItemLifecycleService.restoreMoviesByIds(ids);
}

export function restoreSeasonsByIds(ids: string[]) {
  deletedItemLifecycleService.restoreSeasonsByIds(ids);
}

export function countDeletedItems(): {
  movies: number;
  seasons: number;
  episodes: number;
  total: number;
} {
  return deletedItemLifecycleService.countDeletedItems();
}

export function purgeDeletedItems(): number {
  return deletedItemLifecycleService.purgeDeletedItems();
}

export function upsertSubtitle(sub: SubtitleUpsert): void {
  subtitleRepository.upsertSubtitle(sub);
}

export function listSubtitlesByMedia(mediaType: string, mediaId: string): SubtitleRow[] {
  return subtitleRepository.listSubtitlesByMedia(mediaType, mediaId);
}

export function getSubtitleById(id: string): SubtitleRow | null {
  return subtitleRepository.getSubtitleById(id);
}

export function deleteSubtitleById(id: string): void {
  subtitleRepository.deleteSubtitleById(id);
}

export function deleteSubtitlesByMediaId(
  mediaType: string,
  mediaId: string,
  filePaths: string[]
): void {
  subtitleRepository.deleteSubtitlesByMediaId(mediaType, mediaId, filePaths);
}

export function updateMovieSubtitlePreference(
  movieId: string,
  selectedSubtitleId: string | null,
  subtitlesEnabled: boolean
): void {
  subtitleRepository.updateMovieSubtitlePreference(movieId, selectedSubtitleId, subtitlesEnabled);
}

export function updateEpisodeSubtitlePreference(
  episodeId: string,
  selectedSubtitleId: string | null,
  subtitlesEnabled: boolean
): void {
  subtitleRepository.updateEpisodeSubtitlePreference(episodeId, selectedSubtitleId, subtitlesEnabled);
}
