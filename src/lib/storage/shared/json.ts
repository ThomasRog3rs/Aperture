export function parseJsonStringList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseUniqueNonEmptyJsonStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "string" || !entry.trim()) continue;
      if (seen.has(entry)) continue;
      seen.add(entry);
      ids.push(entry);
    }
    return ids;
  } catch {
    return [];
  }
}

export function stringifyJsonList(values: readonly string[]): string {
  return JSON.stringify(values);
}
