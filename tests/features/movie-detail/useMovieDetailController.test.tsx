import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMovieDetailController } from "@/features/movie-detail/useMovieDetailController";
import type { MovieDetailGateway } from "@/features/movie-detail/gateway";
import { createMovie } from "../../helpers/createMovie";

afterEach(() => {
  cleanup();
});

function createGatewayMock(
  overrides: Partial<MovieDetailGateway> = {}
): MovieDetailGateway {
  return {
    getMovie: vi.fn().mockResolvedValue(createMovie()),
    getFolderImages: vi.fn().mockResolvedValue([]),
    updateMovie: vi.fn().mockResolvedValue(createMovie()),
    refreshMovieMetadata: vi.fn().mockResolvedValue(createMovie()),
    deleteMovie: vi.fn().mockResolvedValue(undefined),
    launchExternalPlayer: vi.fn().mockResolvedValue(undefined),
    saveWatchProgress: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("useMovieDetailController", () => {
  it("loads movie data and initializes edit state", async () => {
    const movie = createMovie({
      id: "movie-42",
      titleClean: "Interstellar",
      posterPath: "/interstellar.jpg",
      userGenres: ["Drama", "drama", "Sci-Fi"],
    });
    const gateway = createGatewayMock({
      getMovie: vi.fn().mockResolvedValue(movie),
      getFolderImages: vi
        .fn()
        .mockResolvedValue([{ name: "poster.jpg", url: "/interstellar.jpg" }]),
    });

    const { result } = renderHook(() =>
      useMovieDetailController({ movieId: movie.id, gateway })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.folderImagesLoading).toBe(false));

    expect(result.current.movie?.id).toBe("movie-42");
    expect(result.current.title).toBe("Interstellar");
    expect(result.current.posterInput).toBe("/interstellar.jpg");
    expect(result.current.userGenres).toEqual(["Drama", "Sci-Fi"]);
    expect(result.current.selectedFolderImage).toBe("/interstellar.jpg");
  });

  it("prevents save when title is blank", async () => {
    const movie = createMovie();
    const updateMovie = vi.fn().mockResolvedValue(movie);
    const gateway = createGatewayMock({
      getMovie: vi.fn().mockResolvedValue(movie),
      updateMovie,
    });

    const { result } = renderHook(() =>
      useMovieDetailController({ movieId: movie.id, gateway })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setTitle("   "));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(updateMovie).not.toHaveBeenCalled();
    expect(result.current.notice).toEqual({
      tone: "error",
      message: "Title cannot be empty.",
    });
  });

  it("updates watched state and shows success message", async () => {
    const movie = createMovie({ watched: false });
    const updatedMovie = createMovie({ watched: true });
    const updateMovie = vi.fn().mockResolvedValue(updatedMovie);
    const gateway = createGatewayMock({
      getMovie: vi.fn().mockResolvedValue(movie),
      updateMovie,
    });

    const { result } = renderHook(() =>
      useMovieDetailController({ movieId: movie.id, gateway })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleWatchedChange(true);
    });

    expect(updateMovie).toHaveBeenCalledWith(movie.id, { watched: true });
    expect(result.current.movie?.watched).toBe(true);
    expect(result.current.notice).toEqual({
      tone: "success",
      message: "Marked as watched.",
    });
  });

  it("does not delete when confirmation is rejected", async () => {
    const movie = createMovie();
    const deleteMovie = vi.fn().mockResolvedValue(undefined);
    const gateway = createGatewayMock({
      getMovie: vi.fn().mockResolvedValue(movie),
      deleteMovie,
    });
    const confirmDelete = vi.fn().mockReturnValue(false);

    const { result } = renderHook(() =>
      useMovieDetailController({
        movieId: movie.id,
        gateway,
        confirmDelete,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(confirmDelete).toHaveBeenCalled();
    expect(deleteMovie).not.toHaveBeenCalled();
  });
});
