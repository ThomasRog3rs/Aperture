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

