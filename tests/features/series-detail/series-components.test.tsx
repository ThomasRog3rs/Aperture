import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeriesEditModal } from "@/features/series-detail/components/SeriesEditModal";
import { SeriesSeasonsCard } from "@/features/series-detail/components/SeriesSeasonsCard";
import {
  createEpisode,
  createSeasonWithEpisodes,
  createSeries,
} from "../../helpers/createSeries";

afterEach(() => {
  cleanup();
});

function createSeasonsProps(
  overrides: Partial<ComponentProps<typeof SeriesSeasonsCard>> = {}
): ComponentProps<typeof SeriesSeasonsCard> {
  const episode = createEpisode({ id: "episode-1", watched: false });
  return {
    seasons: [createSeasonWithEpisodes({ episodes: [episode] })],
    playingEpisodeId: null,
    togglingWatchedEpisodeIds: new Set<string>(),
    onToggleEpisodeWatched: vi.fn(),
    onPlayEpisode: vi.fn(),
    onPlayExternalEpisode: vi.fn(),
    ...overrides,
  };
}

function createEditProps(
  overrides: Partial<ComponentProps<typeof SeriesEditModal>> = {}
): ComponentProps<typeof SeriesEditModal> {
  return {
    series: createSeries(),
    isOpen: true,
    onClose: vi.fn(),
    title: "Series Clean",
    onTitleChange: vi.fn(),
    posterInput: "/poster.jpg",
    onPosterInputChange: vi.fn(),
    folderImages: [{ name: "poster.jpg", url: "/poster.jpg" }],
    folderImagesLoading: false,
    folderImagesError: null,
    selectedFolderImage: "/poster.jpg",
    onSelectedFolderImageChange: vi.fn(),
    onUseSelectedFolderImage: vi.fn(),
    onSave: vi.fn(),
    saving: false,
    onRefreshPoster: vi.fn(),
    refreshing: false,
    onClearPoster: vi.fn(),
    onDelete: vi.fn(),
    deleting: false,
    ...overrides,
  };
}

describe("series detail components", () => {
  it("forwards season table row actions", () => {
    const props = createSeasonsProps();
    const episode = props.seasons[0].episodes[0];

    render(<SeriesSeasonsCard {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByTitle("Play in external player"));
    fireEvent.click(screen.getByRole("checkbox"));

    expect(props.onPlayEpisode).toHaveBeenCalledWith(episode);
    expect(props.onPlayExternalEpisode).toHaveBeenCalledWith(episode);
    expect(props.onToggleEpisodeWatched).toHaveBeenCalledWith(episode, true);
  });

  it("shows disabled states for external play and watch toggle", () => {
    const props = createSeasonsProps({
      playingEpisodeId: "episode-1",
      togglingWatchedEpisodeIds: new Set(["episode-1"]),
    });

    render(<SeriesSeasonsCard {...props} />);

    expect(screen.getByRole("checkbox")).toHaveProperty("disabled", true);
    expect(screen.getByTitle("Play in external player")).toHaveProperty("disabled", true);
  });

  it("forwards edit modal callbacks", () => {
    const props = createEditProps();

    render(<SeriesEditModal {...props} />);

    fireEvent.change(screen.getByPlaceholderText("Series title"), {
      target: { value: "Updated Title" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://..."), {
      target: { value: "https://poster.jpg" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "/poster.jpg" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Use selected" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Fetch from OMDb" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear poster" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from library" }));

    expect(props.onTitleChange).toHaveBeenCalledWith("Updated Title");
    expect(props.onPosterInputChange).toHaveBeenCalledWith("https://poster.jpg");
    expect(props.onSelectedFolderImageChange).toHaveBeenCalledWith("/poster.jpg");
    expect(props.onUseSelectedFolderImage).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onRefreshPoster).toHaveBeenCalledTimes(1);
    expect(props.onClearPoster).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables use selected button without a selected image", () => {
    const props = createEditProps({ selectedFolderImage: "" });

    render(<SeriesEditModal {...props} />);

    expect(screen.getByRole("button", { name: "Use selected" })).toHaveProperty(
      "disabled",
      true
    );
  });
});
