import { parseJsonStringList } from "@/lib/storage/shared/json";

type GenreRow = {
  genresJson: string | null;
  userGenresJson: string | null;
};

type PeopleRow = {
  directorsJson: string | null;
  writersJson: string | null;
  actorsJson: string | null;
};

type FilterAggregationDependencies = {
  movieRepository: {
    listActiveGenreRows(): GenreRow[];
    listActivePeopleRows(): PeopleRow[];
  };
  seasonRepository: {
    listActiveGenreRows(): GenreRow[];
    listActivePeopleRows(): PeopleRow[];
  };
};

export function createFilterAggregationService({
  movieRepository,
  seasonRepository,
}: FilterAggregationDependencies) {
  const collectUniqueSorted = (values: string[]): string[] => {
    const unique = new Map<string, string>();
    values.forEach((value) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (unique.has(key)) return;
      unique.set(key, trimmed);
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  };

  return {
    listGenres(): string[] {
      const rows = [
        ...movieRepository.listActiveGenreRows(),
        ...seasonRepository.listActiveGenreRows(),
      ];
      const genres = rows.flatMap((row) => [
        ...parseJsonStringList(row.genresJson),
        ...parseJsonStringList(row.userGenresJson),
      ]);
      return collectUniqueSorted(genres);
    },

    listPeople(): {
      directors: string[];
      writers: string[];
      actors: string[];
    } {
      const rows = [
        ...movieRepository.listActivePeopleRows(),
        ...seasonRepository.listActivePeopleRows(),
      ];
      return {
        directors: collectUniqueSorted(rows.flatMap((row) => parseJsonStringList(row.directorsJson))),
        writers: collectUniqueSorted(rows.flatMap((row) => parseJsonStringList(row.writersJson))),
        actors: collectUniqueSorted(rows.flatMap((row) => parseJsonStringList(row.actorsJson))),
      };
    },
  };
}
