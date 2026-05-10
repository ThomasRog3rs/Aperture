/* eslint-disable @next/next/no-img-element */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import type { Episode, SeasonWithEpisodes, Series } from "@/lib/types";

const routerPush = vi.fn();
const searchParamsState = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));

const apiMocks = vi.hoisted(() => ({
  fetchSeriesDetail: vi.fn(),
  fetchFolderImages: vi.fn(),
  fetchRandomSession: vi.fn(),
  runRandomSessionAction: vi.fn(),
  updateSeriesDetail: vi.fn(),
  refreshSeriesPoster: vi.fn(),
  deleteSeriesDetail: vi.fn(),
  updateEpisodeWatched: vi.fn(),
  persistEpisodeWatchProgress: vi.fn(),
  launchExternalPlayback: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "series-1" }),
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => searchParamsState.value,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt?: string;
    src: string;
    fill?: boolean;
    priority?: boolean;
  }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/components/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => (
    <div data-testid="video-player">{title}</div>
  ),
}));

vi.mock("@/app/(app)/series/[id]/series-detail.api", () => apiMocks);

import SeriesDetailPage from "@/app/(app)/series/[id]/page";

function createEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: "episode-1",
    seasonId: "season-1",
    episodeNumber: 1,
    titleRaw: "Pilot Raw",
    titleClean: "Pilot",
    filePath: "/library/episode-1.mkv",
    fileSizeBytes: 1,
    lastSyncedAt: 1,
    watched: false,
    watchProgressSeconds: 0,
    selectedSubtitleId: null,
    subtitlesEnabled: false,
    ...overrides,
  };
}

function createSeason(overrides: Partial<SeasonWithEpisodes> = {}): SeasonWithEpisodes {
  return {
    id: "season-1",
    seriesFolderPath: "/library/series",
    seriesId: "series-1",
    seasonFolderPath: "/library/series/season-1",
    seasonNumber: 1,
    titleRaw: "Season 1",
    titleClean: "Season 1",
    titleEditedAt: null,
    year: 2024,
    tmdbId: 1,
    posterPath: "/poster.jpg",
    backdropPath: "/backdrop.jpg",
    tmdbRating: 7.5,
    genres: ["Drama"],
    omdbGenres: ["Drama"],
    directors: ["Director Name"],
    writers: ["Writer Name"],
    actors: ["Actor Name"],
    userGenres: [],
    personalRating: null,
    errorMessage: null,
    lastSyncedAt: 1,
    xxxRated: false,
    watched: false,
    episodeCount: 2,
    episodes: [
      createEpisode(),
      createEpisode({
        id: "episode-2",
        episodeNumber: 2,
        titleRaw: "Second Raw",
        titleClean: "Second",
        watched: true,
      }),
    ],
    ...overrides,
  };
}

function createSeriesDetail() {
  const season = createSeason();
  const series: Series = {
    id: "series-1",
    titleClean: "Sample Series",
    seasonCount: 1,
    posterPath: "/poster.jpg",
    seasons: [season],
  };

  return {
    series,
    seasons: [season],
  };
}

describe("SeriesDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.value = new URLSearchParams();
    apiMocks.fetchSeriesDetail.mockResolvedValue(createSeriesDetail());
    apiMocks.fetchFolderImages.mockResolvedValue({
      images: [{ name: "poster.jpg", url: "/poster.jpg" }],
    });
    apiMocks.fetchRandomSession.mockResolvedValue({ session: null });
    apiMocks.runRandomSessionAction.mockResolvedValue({
      session: null,
      episode: null,
      exhausted: true,
    });
    apiMocks.updateSeriesDetail.mockResolvedValue(createSeriesDetail());
    apiMocks.refreshSeriesPoster.mockResolvedValue(createSeriesDetail().series);
    apiMocks.deleteSeriesDetail.mockResolvedValue(undefined);
    apiMocks.updateEpisodeWatched.mockResolvedValue(
      createSeriesDetail().seasons[0].episodes[0]
    );
    apiMocks.persistEpisodeWatchProgress.mockResolvedValue(undefined);
    apiMocks.launchExternalPlayback.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the page, opens modals, and wires playback from the extracted components", async () => {
    render(<SeriesDetailPage />);

    await screen.findByRole("heading", { name: "Sample Series" });
    await screen.findByText("Continue");
    await screen.findByText("Random");

    fireEvent.click(screen.getByRole("button", { name: /info/i }));
    expect(await screen.findByText("Database Details")).toBeTruthy();
    expect(screen.getByText("series-1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(await screen.findByText("Edit Series")).toBeTruthy();
    expect(screen.getByDisplayValue("Sample Series")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Play" })[0]);
    await waitFor(() =>
      expect(screen.getByTestId("video-player").textContent).toContain(
        "Episode 1 — Pilot"
      )
    );
  });

  it("auto-plays a deep-linked episode at continue-watching time", async () => {
    searchParamsState.value = new URLSearchParams(
      "autoplay=1&episodeId=episode-1&t=87"
    );

    render(<SeriesDetailPage />);

    await waitFor(() =>
      expect(screen.getByTestId("video-player").textContent).toContain(
        "Episode 1 — Pilot"
      )
    );
  });
});
