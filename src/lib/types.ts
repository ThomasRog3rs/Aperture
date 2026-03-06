export type Movie = {
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
  /**
   * Genres from OMDb / provider metadata (stored in `movies.genresJson`).
   * Optional for backwards compatibility with older API responses.
   */
  omdbGenres?: string[];
  directors: string[];
  writers: string[];
  actors: string[];
  /**
   * User-added genres (stored in `movies.userGenresJson`).
   * Optional for backwards compatibility with older API responses.
   */
  userGenres?: string[];
  youtubeTrailerKey: string | null;
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
  /** When true, card is blurred on the main library view (unless searching/filtering). */
  xxxRated: boolean;
  /** When true, user has marked this movie as watched. */
  watched: boolean;
};

export type Season = {
  id: string;
  seriesFolderPath: string;
  seriesId?: string;
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
  omdbGenres?: string[];
  directors: string[];
  writers: string[];
  actors: string[];
  userGenres?: string[];
  personalRating: number | null;
  errorMessage: string | null;
  lastSyncedAt: number;
  xxxRated: boolean;
  watched: boolean;
  episodeCount?: number;
};

export type Series = {
  id: string;
  titleClean: string;
  seasonCount: number;
  posterPath: string | null;
  seasons: Season[];
};

export type Episode = {
  id: string;
  seasonId: string;
  episodeNumber: number | null;
  titleRaw: string;
  titleClean: string;
  filePath: string;
  fileSizeBytes: number;
  lastSyncedAt: number;
  watched: boolean;
};

export type SeasonWithEpisodes = Season & { episodes: Episode[] };

export type MagnetApiRawResult = {
  name?: string;
  magnet?: string;
  Seeders?: string;
  Leechers?: string;
  Size?: string;
  Date?: string;
  otherDetails?: {
    category?: string;
    uploader?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type MagnetSearchResult = {
  name: string;
  magnet: string;
  seeders: string | null;
  leechers: string | null;
  size: string | null;
  date: string | null;
  category: string | null;
  uploader: string | null;
  source: "pirate-bay";
};

