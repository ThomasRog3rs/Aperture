export type TitlePosterUpdates = {
  titleClean?: string;
  posterPath?: string | null;
};

export function formatTimestamp(value: number | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function getPosterCandidate(
  posterInput: string,
  currentPosterPath: string | null | undefined
) {
  const trimmed = posterInput.trim();
  return trimmed || currentPosterPath || null;
}

export function buildTitlePosterEditUpdates(
  currentTitleClean: string,
  currentPosterPath: string | null | undefined,
  title: string,
  posterInput: string
) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return {
      error: "Title cannot be empty.",
      updates: {},
    };
  }

  const trimmedPoster = posterInput.trim();
  const nextPoster = trimmedPoster.length === 0 ? null : trimmedPoster;
  const updates: TitlePosterUpdates = {};

  if (trimmedTitle !== currentTitleClean) {
    updates.titleClean = trimmedTitle;
  }
  if (nextPoster !== (currentPosterPath ?? null)) {
    updates.posterPath = nextPoster;
  }

  return {
    updates,
  };
}
