import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  upsertSubtitle,
  listSubtitlesByMedia,
  deleteSubtitlesByMediaId,
} from "@/lib/storage";
import type { SubtitleRow } from "@/lib/storage/types";

export const SUBTITLE_EXTENSIONS = [".srt", ".vtt", ".ass", ".ssa", ".sub"] as const;

type SubtitleExtension = (typeof SUBTITLE_EXTENSIONS)[number];

function isSubtitleExtension(ext: string): ext is SubtitleExtension {
  return (SUBTITLE_EXTENSIONS as readonly string[]).includes(ext);
}

function guessLanguageFromFileName(fileName: string): string {
  // Try to detect language code from patterns like "Movie.en.srt" or "Movie.en.US.srt"
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split(".");
  // Walk from the end looking for a 2-letter language code (skip 2-letter region codes by
  // preferring the first match that isn't preceded by another 2-letter part)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].toLowerCase();
    if (/^[a-z]{2}$/.test(part)) {
      return part;
    }
  }
  return "und"; // undetermined
}

export type DiscoveredSubtitleFile = {
  fileName: string;
  absolutePath: string;
  format: string;
};

export function listSubtitleFilesInFolder(
  folderPath: string
): DiscoveredSubtitleFile[] {
  if (!fs.existsSync(folderPath)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const result: DiscoveredSubtitleFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!isSubtitleExtension(ext)) continue;
    result.push({
      fileName: entry.name,
      absolutePath: path.join(folderPath, entry.name),
      format: ext.slice(1), // strip leading "."
    });
  }
  return result;
}

export function reconcileSubtitlesForMedia(
  mediaType: "movie" | "episode",
  mediaId: string,
  mediaFolderPath: string,
  episodeFileBaseName?: string
): SubtitleRow[] {
  const discovered = listSubtitleFilesInFolder(mediaFolderPath);
  const existingRows = listSubtitlesByMedia(mediaType, mediaId);
  const existingByPath = new Map<string, SubtitleRow>(
    existingRows.map((r) => [r.filePath, r])
  );

  const activePaths: string[] = [];

  for (const file of discovered) {
    // For episodes, only match subtitle files that share the episode's base filename prefix
    if (episodeFileBaseName) {
      const subBase = path.basename(file.fileName, path.extname(file.fileName));
      // Subtitle base must start with the episode base name (e.g. "Show.S01E03.Title")
      if (
        !subBase.toLowerCase().startsWith(episodeFileBaseName.toLowerCase()) &&
        !episodeFileBaseName.toLowerCase().startsWith(subBase.toLowerCase())
      ) {
        // Only include if already in DB for this media item
        if (!existingByPath.has(file.absolutePath)) continue;
      }
    }

    activePaths.push(file.absolutePath);
    const existing = existingByPath.get(file.absolutePath);
    if (existing) continue; // already tracked, no update needed

    upsertSubtitle({
      id: crypto.randomUUID(),
      mediaType,
      mediaId,
      filePath: file.absolutePath,
      fileName: file.fileName,
      language: guessLanguageFromFileName(file.fileName),
      format: file.format,
      source: "local",
      downloadedAt: null,
    });
  }

  // Remove DB records whose files no longer exist on disk
  deleteSubtitlesByMediaId(mediaType, mediaId, activePaths);

  return listSubtitlesByMedia(mediaType, mediaId);
}

/**
 * Returns a safe absolute path for a subtitle file inside the given folder.
 * Throws if the resolved path escapes the folder.
 */
export function buildSubtitleFilePath(
  mediaFolderPath: string,
  fileName: string
): string {
  const resolvedFolder = path.resolve(mediaFolderPath);
  const candidate = path.resolve(resolvedFolder, path.basename(fileName));
  const folderPrefix = resolvedFolder.endsWith(path.sep)
    ? resolvedFolder
    : `${resolvedFolder}${path.sep}`;
  if (!candidate.startsWith(folderPrefix)) {
    throw new Error("Invalid subtitle file name");
  }
  return candidate;
}

// ── Format conversion to WebVTT ───────────────────────────────────────────────

function srtTimestampToVtt(ts: string): string {
  // "00:00:01,000" → "00:00:01.000"
  return ts.replace(",", ".");
}

function srtToVtt(content: string): string {
  const blocks = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/);

  const cues: string[] = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length === 0) continue;

    // Skip pure numeric cue numbers
    let startIdx = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      startIdx = 1;
    }

    if (startIdx >= lines.length) continue;

    const timingLine = lines[startIdx];
    if (!timingLine || !timingLine.includes("-->")) continue;

    const timing = timingLine
      .split("-->")
      .map((t) => srtTimestampToVtt(t.trim()))
      .join(" --> ");

    const cueText = lines
      .slice(startIdx + 1)
      .join("\n")
      .trim();

    if (!cueText) continue;
    cues.push(`${timing}\n${cueText}`);
  }

  return `WEBVTT\n\n${cues.join("\n\n")}`;
}

function assTimeToVtt(assTime: string): string {
  // "H:MM:SS.CS" (centiseconds) → "HH:MM:SS.mmm"
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/.exec(assTime.trim());
  if (!match) return assTime;
  const [, h, m, s, cs] = match;
  const ms = String(parseInt(cs, 10) * 10).padStart(3, "0");
  return `${String(h).padStart(2, "0")}:${m}:${s}.${ms}`;
}

function stripAssTags(text: string): string {
  return (
    text
      // Remove override blocks like {\an8}, {\b1}, {\i0}
      .replace(/\{[^}]*\}/g, "")
      // Hard line break in ASS
      .replace(/\\N/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\h/g, " ")
      .trim()
  );
}

function assToVtt(content: string): string {
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  // Find the [Events] section and its Format line
  let inEvents = false;
  let formatOrder: string[] = [];
  const cues: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase() === "[events]") {
      inEvents = true;
      continue;
    }
    if (trimmed.startsWith("[") && inEvents) break; // next section

    if (!inEvents) continue;

    if (trimmed.toLowerCase().startsWith("format:")) {
      formatOrder = trimmed
        .slice("format:".length)
        .split(",")
        .map((f) => f.trim().toLowerCase());
      continue;
    }

    if (!trimmed.toLowerCase().startsWith("dialogue:")) continue;

    const dataStr = trimmed.slice("dialogue:".length).trimStart();
    // Split only by the first N commas to preserve text with commas
    const maxFields = formatOrder.length;
    const parts: string[] = [];
    let remaining = dataStr;
    for (let i = 0; i < maxFields - 1; i++) {
      const idx = remaining.indexOf(",");
      if (idx === -1) break;
      parts.push(remaining.slice(0, idx));
      remaining = remaining.slice(idx + 1);
    }
    parts.push(remaining); // last field is the text

    if (formatOrder.length === 0) {
      // No format line — fall back to position-based: layer,start,end,...,text
      // Standard ASS: 0,1,2 = Layer, Start, End; last = Text
      const fields = dataStr.split(",");
      if (fields.length < 10) continue;
      const start = assTimeToVtt(fields[1]);
      const end = assTimeToVtt(fields[2]);
      const text = stripAssTags(fields.slice(9).join(","));
      if (!text) continue;
      cues.push(`${start} --> ${end}\n${text}`);
    } else {
      const startIdx = formatOrder.indexOf("start");
      const endIdx = formatOrder.indexOf("end");
      const textIdx = formatOrder.indexOf("text");
      if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;
      const start = assTimeToVtt(parts[startIdx] ?? "");
      const end = assTimeToVtt(parts[endIdx] ?? "");
      const text = stripAssTags(parts[textIdx] ?? "");
      if (!start || !end || !text) continue;
      cues.push(`${start} --> ${end}\n${text}`);
    }
  }

  return `WEBVTT\n\n${cues.join("\n\n")}`;
}

/**
 * Reads a subtitle file and returns its content as WebVTT text.
 * If the file is already VTT it is returned as-is.
 * Conversion errors fall back to serving the raw file content.
 */
export function convertToVtt(absolutePath: string): string {
  const content = fs.readFileSync(absolutePath, "utf-8");
  const ext = path.extname(absolutePath).toLowerCase();

  try {
    if (ext === ".vtt") return content;
    if (ext === ".srt") return srtToVtt(content);
    if (ext === ".ass" || ext === ".ssa") return assToVtt(content);
    // .sub — attempt SRT-style parsing, fall back to raw
    return srtToVtt(content);
  } catch {
    // Return raw content as a best-effort fallback
    return content;
  }
}
