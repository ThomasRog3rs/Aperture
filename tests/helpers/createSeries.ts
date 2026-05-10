import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";

export function createEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: "episode-1",
    seasonId: "season-1",
    episodeNumber: 1,
    titleRaw: "Episode Raw",
    titleClean: "Episode Clean",
    filePath: "/library/series/s01e01.mkv",
    fileSizeBytes: 1024,
    lastSyncedAt: 1,
    watched: false,
    watchProgressSeconds: 0,
    selectedSubtitleId: null,
    subtitlesEnabled: false,
    ...overrides,
  };
}

export function createSeasonWithEpisodes(
  overrides: Partial<SeasonWithEpisodes> = {}
): SeasonWithEpisodes {
  return {
    id: "season-1",
    seriesFolderPath: "/library/series",
    seriesId: "series-1",
    seasonFolderPath: "/library/series/season-1",
    seasonNumber: 1,
    titleRaw: "Season Raw",
    titleClean: "Season Clean",
    titleEditedAt: null,
    year: 2024,
    tmdbId: 11,
    posterPath: "/poster-season.jpg",
    backdropPath: "/backdrop-season.jpg",
    tmdbRating: 7.4,
    genres: ["Drama"],
    omdbGenres: ["Drama"],
    directors: ["Director One"],
    writers: ["Writer One"],
    actors: ["Actor One"],
    userGenres: ["Drama"],
    personalRating: null,
    errorMessage: null,
    lastSyncedAt: 1,
    xxxRated: false,
    watched: false,
    episodeCount: 1,
    episodes: [createEpisode()],
    ...overrides,
  };
}

export function createSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: "series-1",
    titleClean: "Series Clean",
    seasonCount: 1,
    posterPath: "/poster-series.jpg",
    seasons: [createSeasonWithEpisodes()],
    ...overrides,
  };
}
