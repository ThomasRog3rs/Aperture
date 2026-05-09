import { describe, expect, it } from "vitest";
import { createFetchMovieDetailGateway } from "@/features/movie-detail/gateway";
import { createMovie } from "../../helpers/createMovie";

describe("movie-detail gateway", () => {
  it("calls injected fetch with global context", async () => {
    const movie = createMovie({ id: "movie-fetch-bind" });
    let thisValue: unknown;

    function strictFetch(this: unknown) {
      thisValue = this;
      return Promise.resolve(
        new Response(JSON.stringify({ movie }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }

    const gateway = createFetchMovieDetailGateway(strictFetch as unknown as typeof fetch);
    const loadedMovie = await gateway.getMovie(movie.id);

    expect(loadedMovie.id).toBe("movie-fetch-bind");
    expect(thisValue).toBe(globalThis);
  });
});

