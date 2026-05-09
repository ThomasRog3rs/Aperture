export type MovieUpsert = {
  id: string;
  folderPath: string;
  filePath: string;
  fileSizeBytes: number;
  titleRaw: string;
  titleClean: string;
  titleEditedAt: number | null;
  year: number | null;
  tmdbId: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  runtimeMinutes: number | null;
  tmdbRating: number | null;
  genres: string[];
  userGenres: string[];
  directors: string[];
  writers: string[];
  actors: string[];
  youtubeTrailerKey: string | null;
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
};

export type MovieRow = Omit<MovieUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
  directorsJson: string;
  writersJson: string;
  actorsJson: string;
  xxxRated: number;
  watched: number;
  selectedSubtitleId?: string | null;
  subtitlesEnabled?: number;
  watchProgressSeconds?: number;
};

export type SeasonUpsert = {
  id: string;
  seriesFolderPath: string;
  seasonFolderPath: string;
  seasonNumber: number | null;
  titleRaw: string;
  titleClean: string;
  titleEditedAt: number | null;
  year: number | null;
  tmdbId: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  tmdbRating: number | null;
  genres: string[];
  userGenres: string[];
  directors: string[];
  writers: string[];
  actors: string[];
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
  xxxRated: number;
  watched: number;
};

export type SeasonRow = Omit<SeasonUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
  directorsJson: string;
  writersJson: string;
  actorsJson: string;
};

export type EpisodeUpsert = {
  id: string;
  seasonId: string;
  episodeNumber: number | null;
  titleRaw: string;
  titleClean: string;
  filePath: string;
  fileSizeBytes: number;
  lastSyncedAt: number;
};

export type EpisodeRow = EpisodeUpsert & {
  watched: number;
  selectedSubtitleId?: string | null;
  subtitlesEnabled?: number;
  watchProgressSeconds?: number;
  transcodeStatus?: string;
  transcodedPath?: string | null;
  hlsPath?: string | null;
  storyboardPath?: string | null;
};

export type SeriesUpsert = {
  id: string;
  seriesFolderPath: string;
  titleClean: string;
  titleEditedAt: number | null;
  year: number | null;
  tmdbId: number | null;
  posterPath: string | null;
  tmdbRating: number | null;
  genres: string[];
  userGenres: string[];
  directors: string[];
  writers: string[];
  actors: string[];
  errorMessage: string | null;
  lastSyncedAt: number;
};

export type SeriesRow = Omit<SeriesUpsert, "genres" | "userGenres"> & {
  genresJson: string;
  userGenresJson: string;
  directorsJson: string;
  writersJson: string;
  actorsJson: string;
};

export type SeriesRandomSessionRow = {
  seriesId: string;
  startedEpisodeIdsJson: string;
  currentEpisodeId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SeriesRandomSession = {
  seriesId: string;
  startedEpisodeIds: string[];
  currentEpisodeId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type FolderScanType = "movie" | "series" | "season";

export type FolderScanStateUpsert = {
  folderPath: string;
  folderType: FolderScanType;
  parentFolderPath: string | null;
  dirMtimeMs: number;
  fingerprint: string;
  lastSeenAt: number;
  lastScannedAt: number;
};

export type FolderScanStateRow = FolderScanStateUpsert;

export type FolderScanEntryUpsert = {
  folderPath: string;
  entryPath: string;
  sizeBytes: number;
  mtimeMs: number;
};

export type FolderScanEntryRow = FolderScanEntryUpsert;

export type MovieQuery = {
  q?: string;
  genre?: string;
  person?: string;
  minPersonalRating?: number;
  watched?: "all" | "watched" | "unwatched";
  sort?: "title" | "rating" | "recent";
};

export type SeasonQuery = MovieQuery;

export type MovieUpdate = {
  titleRaw?: string;
  titleClean?: string;
  titleEditedAt?: number | null;
  posterPath?: string | null;
  tmdbId?: number | null;
  backdropPath?: string | null;
  runtimeMinutes?: number | null;
  tmdbRating?: number | null;
  genresJson?: string;
  userGenresJson?: string;
  directorsJson?: string;
  writersJson?: string;
  actorsJson?: string;
  youtubeTrailerKey?: string | null;
  errorMessage?: string | null;
  lastSyncedAt?: number;
  personalRating?: number | null;
  xxxRated?: number | null;
  watched?: number | null;
  transcodeStatus?: string;
  transcodedPath?: string | null;
  hlsPath?: string | null;
  storyboardPath?: string | null;
  watchProgressSeconds?: number;
  selectedSubtitleId?: string | null;
  subtitlesEnabled?: number;
};

export type SeasonUpdate = {
  titleRaw?: string;
  titleClean?: string;
  titleEditedAt?: number | null;
  posterPath?: string | null;
  tmdbId?: number | null;
  backdropPath?: string | null;
  tmdbRating?: number | null;
  genresJson?: string;
  userGenresJson?: string;
  directorsJson?: string;
  writersJson?: string;
  actorsJson?: string;
  errorMessage?: string | null;
  lastSyncedAt?: number;
  personalRating?: number | null;
  xxxRated?: number | null;
  watched?: number | null;
};

export type SeriesUpdate = {
  titleClean?: string;
  titleEditedAt?: number | null;
  posterPath?: string | null;
  tmdbId?: number | null;
  tmdbRating?: number | null;
  genresJson?: string;
  userGenresJson?: string;
  directorsJson?: string;
  writersJson?: string;
  actorsJson?: string;
  errorMessage?: string | null;
  lastSyncedAt?: number;
};

export type EpisodeUpdate = {
  watched?: number;
  transcodeStatus?: string;
  transcodedPath?: string | null;
  hlsPath?: string | null;
  storyboardPath?: string | null;
  watchProgressSeconds?: number;
  selectedSubtitleId?: string | null;
  subtitlesEnabled?: number;
};

export type DeletedMovieRow = MovieRow & { deletedAt: number };

export type DeletedSeasonRow = SeasonRow & { deletedAt: number; deletedEpisodeCount: number };

export type SubtitleUpsert = {
  id: string;
  mediaType: "movie" | "episode";
  mediaId: string;
  filePath: string;
  fileName: string;
  language: string;
  format: string;
  source: "local" | "opensubtitles";
  downloadedAt: number | null;
};

export type SubtitleRow = SubtitleUpsert;
