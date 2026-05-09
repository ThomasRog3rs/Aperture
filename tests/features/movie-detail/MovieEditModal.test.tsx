import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MovieEditModal } from "@/features/movie-detail/components/MovieEditModal";
import { createMovie } from "../../helpers/createMovie";

afterEach(() => {
  cleanup();
});

function createProps(overrides: Partial<ComponentProps<typeof MovieEditModal>> = {}) {
  return {
    movie: createMovie(),
    isOpen: true,
    onClose: vi.fn(),
    title: "Movie Clean",
    onTitleChange: vi.fn(),
    posterInput: "/poster.jpg",
    onPosterInputChange: vi.fn(),
    folderImages: [{ name: "poster.jpg", url: "/poster.jpg" }],
    folderImagesLoading: false,
    folderImagesError: null,
    selectedFolderImage: "/poster.jpg",
    onSelectedFolderImageChange: vi.fn(),
    onUseSelectedFolderImage: vi.fn(),
    saving: false,
    onSave: vi.fn(),
    refreshing: false,
    onRefreshPoster: vi.fn(),
    onClearPoster: vi.fn(),
    userGenres: ["Drama"],
    savingGenres: false,
    onRemoveGenre: vi.fn(),
    genreInput: "",
    onGenreInputChange: vi.fn(),
    onAddGenre: vi.fn(),
    savingXxxRated: false,
    onXxxRatedChange: vi.fn(),
    deleting: false,
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe("MovieEditModal", () => {
  it("uses selected folder image when requested", () => {
    const props = createProps();
    render(<MovieEditModal {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Use selected" }));

    expect(props.onUseSelectedFolderImage).toHaveBeenCalledTimes(1);
  });

  it("enables add genre only when input has text", () => {
    const noInputProps = createProps({ genreInput: "   " });
    const { rerender } = render(<MovieEditModal {...noInputProps} />);
    expect(screen.getByRole("button", { name: "Add genre" })).toHaveProperty(
      "disabled",
      true
    );

    const withInputProps = createProps({ genreInput: "Noir" });
    rerender(<MovieEditModal {...withInputProps} />);
    const addGenreButton = screen.getByRole("button", { name: "Add genre" });
    expect(addGenreButton).toHaveProperty("disabled", false);
    fireEvent.click(addGenreButton);
    expect(withInputProps.onAddGenre).toHaveBeenCalledTimes(1);
  });

  it("forwards option and delete interactions", () => {
    const props = createProps();
    render(<MovieEditModal {...props} />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Remove from library" }));

    expect(props.onXxxRatedChange).toHaveBeenCalledWith(true);
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });
});
