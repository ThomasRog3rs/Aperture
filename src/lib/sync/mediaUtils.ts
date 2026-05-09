import crypto from "node:crypto";

export function generateMediaId(folderOrFilePath: string): string {
  return crypto.createHash("sha1").update(folderOrFilePath).digest("hex");
}

export function shouldKeepPoster(posterPath: string | null): boolean {
  if (typeof posterPath !== "string") return false;
  return (
    posterPath.startsWith("http://") ||
    posterPath.startsWith("https://") ||
    posterPath.startsWith("/api/")
  );
}

export function resolveTitle(
  existing: { titleClean?: string; titleRaw?: string; titleEditedAt?: number | null } | null,
  derivedTitleClean: string,
  rawFallback: string
): { titleClean: string; titleRaw: string } {
  const titleEditedAt = existing?.titleEditedAt ?? null;
  if (titleEditedAt) {
    return {
      titleClean: existing?.titleClean ?? derivedTitleClean,
      titleRaw: existing?.titleRaw ?? rawFallback,
    };
  }
  return { titleClean: derivedTitleClean, titleRaw: rawFallback };
}

export function parseJsonArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
