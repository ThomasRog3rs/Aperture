import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import {
  getStoryboardImagePath,
  getStoryboardVttPath,
  getTranscodeDir,
  isSafeMediaId,
} from "@/lib/transcodePaths";

const execFileAsync = promisify(execFile);

const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;
const COLUMNS = 10;
const ROWS = 10;
const FRAMES_PER_SHEET = COLUMNS * ROWS;
// Extract one frame every 10 seconds
const INTERVAL_SECONDS = 10;

/**
 * Generates a storyboard sprite sheet and companion VTT file for a video.
 * - Sprite sheet: 10×10 grid of 160×90 thumbnails, one every 10 seconds
 * - VTT: WebVTT file mapping timestamps to sprite coordinates (xywh)
 *
 * Returns paths to the generated files.
 */
export async function generateStoryboard(
  mediaId: string,
  inputPath: string
): Promise<{ imagePath: string; vttPath: string }> {
  const dir = getTranscodeDir(mediaId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const imagePath = getStoryboardImagePath(mediaId);
  const vttPath = getStoryboardVttPath(mediaId);

  // Skip if both already exist
  if (fs.existsSync(imagePath) && fs.existsSync(vttPath)) {
    return { imagePath, vttPath };
  }

  // Get video duration via ffprobe
  const duration = await getVideoDuration(inputPath);

  // Calculate total frames to extract
  const totalFrames = Math.min(
    FRAMES_PER_SHEET,
    Math.ceil(duration / INTERVAL_SECONDS)
  );

  if (totalFrames === 0) {
    throw new Error("Video is too short for storyboard generation.");
  }

  // Calculate the FPS needed: we want 1 frame every INTERVAL_SECONDS
  // Using fps filter instead of select to avoid issues with variable frame rate
  const fps = 1 / INTERVAL_SECONDS;

  // Determine tile dimensions
  const cols = Math.min(COLUMNS, totalFrames);
  const rows = Math.ceil(totalFrames / cols);

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-y",
      "-i", inputPath,
      "-vf", `fps=${fps},scale=${THUMB_WIDTH}:${THUMB_HEIGHT},tile=${cols}x${rows}`,
      "-frames:v", "1",
      "-q:v", "5",
      imagePath,
    ];

    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(imagePath)) {
        resolve();
      } else {
        reject(new Error(`Storyboard generation failed: ${stderr.slice(-500)}`));
      }
    });
    proc.on("error", reject);
  });

  // Generate VTT
  generateVTT(duration, totalFrames, cols, vttPath);

  return { imagePath, vttPath };
}

/**
 * Generates a WebVTT file that maps time ranges to sprite sheet coordinates.
 */
function generateVTT(
  duration: number,
  totalFrames: number,
  columns: number,
  outputPath: string
): void {
  const lines: string[] = ["WEBVTT", ""];

  for (let i = 0; i < totalFrames; i++) {
    const startTime = i * INTERVAL_SECONDS;
    const endTime = Math.min((i + 1) * INTERVAL_SECONDS, duration);

    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * THUMB_WIDTH;
    const y = row * THUMB_HEIGHT;

    lines.push(
      `${formatVTTTime(startTime)} --> ${formatVTTTime(endTime)}`,
      `storyboard.jpg#xywh=${x},${y},${THUMB_WIDTH},${THUMB_HEIGHT}`,
      ""
    );
  }

  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
}

/**
 * Formats seconds into VTT timestamp format: HH:MM:SS.mmm
 */
function formatVTTTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.round((totalSeconds % 1) * 1000);

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0") +
    "." +
    String(millis).padStart(3, "0")
  );
}

/**
 * Gets the duration of a video file in seconds using ffprobe.
 */
async function getVideoDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    filePath,
  ], { timeout: 30_000 });

  const data = JSON.parse(stdout);
  return parseFloat(data.format?.duration ?? "0");
}

/**
 * Checks if storyboard assets already exist for a given media item.
 */
export function hasStoryboard(mediaId: string): boolean {
  if (!isSafeMediaId(mediaId)) return false;
  const imagePath = getStoryboardImagePath(mediaId);
  const vttPath = getStoryboardVttPath(mediaId);
  return (
    fs.existsSync(imagePath) &&
    fs.existsSync(vttPath)
  );
}

/**
 * Returns paths to storyboard assets if they exist.
 */
export function getStoryboardPaths(
  mediaId: string
): { imagePath: string; vttPath: string } | null {
  if (!isSafeMediaId(mediaId)) return null;
  const imagePath = getStoryboardImagePath(mediaId);
  const vttPath = getStoryboardVttPath(mediaId);
  if (fs.existsSync(imagePath) && fs.existsSync(vttPath)) {
    return { imagePath, vttPath };
  }
  return null;
}
