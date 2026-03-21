import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const TRANSCODES_DIR = path.join(process.cwd(), "data", "transcodes");

export type HardwareAccel = "nvenc" | "qsv" | "videotoolbox" | "software";

export type TranscodeJob = {
  id: string;
  inputPath: string;
  outputDir: string;
  status: "queued" | "in_progress" | "done" | "error";
  progress: number; // 0-100
  error?: string;
  process?: ChildProcess;
};

// In-memory job tracker (survives during server lifetime)
const jobs = new Map<string, TranscodeJob>();

// Cached hardware accel result
let cachedAccel: HardwareAccel | null = null;

/**
 * Probes the system for available hardware acceleration.
 * Returns the best available encoder: nvenc > qsv > videotoolbox > software.
 */
export async function detectHardwareAccel(): Promise<HardwareAccel> {
  if (cachedAccel) return cachedAccel;
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-encoders"], {
      timeout: 10_000,
    });
    if (stdout.includes("h264_nvenc")) cachedAccel = "nvenc";
    else if (stdout.includes("h264_qsv")) cachedAccel = "qsv";
    else if (stdout.includes("h264_videotoolbox")) cachedAccel = "videotoolbox";
    else cachedAccel = "software";
  } catch {
    cachedAccel = "software";
  }
  return cachedAccel;
}

/**
 * Returns FFmpeg encoder arguments based on the detected hardware.
 */
export function getEncoderArgs(accel: HardwareAccel): string[] {
  switch (accel) {
    case "nvenc":
      return [
        "-hwaccel", "cuda",
        "-hwaccel_output_format", "cuda",
        "-c:v", "h264_nvenc",
        "-preset", "p4",
        "-cq", "23",
      ];
    case "qsv":
      return [
        "-hwaccel", "qsv",
        "-c:v", "h264_qsv",
        "-preset", "faster",
        "-global_quality", "23",
      ];
    case "videotoolbox":
      return [
        "-c:v", "h264_videotoolbox",
        "-q:v", "65",
        "-allow_sw", "1",
      ];
    default:
      return [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
      ];
  }
}

const WEB_PLAYABLE_CONTAINERS = new Set([".mp4", ".m4v", ".webm"]);
const WEB_PLAYABLE_VIDEO_CODECS = new Set(["h264", "vp8", "vp9", "av1"]);
const WEB_PLAYABLE_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "vorbis", "flac"]);

export type ProbeResult = {
  videoCodec: string | null;
  audioCodec: string | null;
  container: string;
  duration: number;
  width: number;
  height: number;
};

// In-memory probe cache (keyed by file path)
const probeCache = new Map<string, { result: ProbeResult; mtime: number }>();

/**
 * Uses ffprobe to inspect a media file (cached by file path + mtime).
 */
export async function probeFile(filePath: string): Promise<ProbeResult> {
  const stat = fs.statSync(filePath);
  const cached = probeCache.get(filePath);
  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.result;
  }

  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ], { timeout: 30_000 });

  const data = JSON.parse(stdout);
  const streams: Array<{ codec_type: string; codec_name: string; width?: number; height?: number }> =
    data.streams || [];
  const format = data.format || {};

  const videoStream = streams.find((s) => s.codec_type === "video");
  const audioStream = streams.find((s) => s.codec_type === "audio");

  const result: ProbeResult = {
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    container: path.extname(filePath).toLowerCase(),
    duration: parseFloat(format.duration ?? "0"),
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
  };

  probeCache.set(filePath, { result, mtime: stat.mtimeMs });
  return result;
}

/** What the stream endpoint should do with the file */
export type PlaybackMode = "direct" | "remux" | "transcode";

/**
 * Determines how a file should be streamed to the browser.
 * - "direct": Browser can play natively, serve with range requests
 * - "remux": Video/audio codecs are compatible but container isn't, just remux
 * - "transcode": Video or audio codec is incompatible, must re-encode
 */
export function getPlaybackMode(probe: ProbeResult): PlaybackMode {
  const containerOk = WEB_PLAYABLE_CONTAINERS.has(probe.container);
  const videoOk = probe.videoCodec ? WEB_PLAYABLE_VIDEO_CODECS.has(probe.videoCodec) : true;
  const audioOk = probe.audioCodec ? WEB_PLAYABLE_AUDIO_CODECS.has(probe.audioCodec) : true;

  if (containerOk && videoOk && audioOk) return "direct";
  if (videoOk && audioOk) return "remux";
  return "transcode";
}

/**
 * Determines if a file can be played directly in the browser without transcoding.
 */
export async function isDirectPlayCompatible(filePath: string): Promise<boolean> {
  try {
    const probe = await probeFile(filePath);
    return getPlaybackMode(probe) === "direct";
  } catch {
    return false;
  }
}

/**
 * Creates an on-the-fly FFmpeg stream that remuxes or transcodes the file
 * into a fragmented MP4 for browser playback.
 *
 * Returns a ReadableStream and the child process (for cleanup).
 */
export async function createLiveStream(
  filePath: string,
  mode: "remux" | "transcode",
  startTime?: number
): Promise<{ stream: ReadableStream<Uint8Array>; process: ChildProcess }> {
  const accel = await detectHardwareAccel();

  const preInputArgs: string[] = [];
  if (startTime && startTime > 0) {
    preInputArgs.push("-ss", String(startTime));
  }

  let videoArgs: string[];
  let audioArgs: string[];

  if (mode === "remux") {
    videoArgs = ["-c:v", "copy"];
    audioArgs = ["-c:a", "copy"];
  } else {
    // Transcode: use HW accel encoder
    const encoderArgs = getEncoderArgs(accel);
    if (accel === "nvenc") {
      preInputArgs.push("-hwaccel", "cuda", "-hwaccel_output_format", "cuda");
      videoArgs = encoderArgs.slice(4); // skip hwaccel flags already added
    } else {
      videoArgs = encoderArgs;
    }
    audioArgs = ["-c:a", "aac", "-b:a", "192k"];
  }

  // Check if audio needs separate transcoding even in remux mode
  // (e.g., H.264 video but AC3/DTS audio in MKV)
  if (mode === "remux") {
    try {
      const probe = await probeFile(filePath);
      if (probe.audioCodec && !WEB_PLAYABLE_AUDIO_CODECS.has(probe.audioCodec)) {
        audioArgs = ["-c:a", "aac", "-b:a", "192k"];
      }
    } catch {
      // If probe fails, try copy anyway
    }
  }

  const args = [
    ...preInputArgs,
    "-i", filePath,
    ...videoArgs,
    ...audioArgs,
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4",
    "pipe:1",
  ];

  const proc = spawn("ffmpeg", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Log stderr for debugging (don't accumulate forever)
  proc.stderr?.on("data", () => {
    // Consume stderr to prevent pipe backup, but don't accumulate
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      proc.stdout!.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          // Controller may be closed if client disconnected
          proc.kill("SIGTERM");
        }
      });
      proc.stdout!.on("end", () => {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
      proc.stdout!.on("error", (err) => {
        try {
          controller.error(err);
        } catch {
          // Already errored/closed
        }
      });
      proc.on("error", (err) => {
        try {
          controller.error(err);
        } catch {
          // Already errored/closed
        }
      });
    },
    cancel() {
      proc.kill("SIGTERM");
    },
  });

  return { stream, process: proc };
}

/**
 * Ensures the output directory exists for a given media item.
 */
export function ensureTranscodeDir(mediaId: string): string {
  const dir = path.join(TRANSCODES_DIR, mediaId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Transcodes a video file to H.264/AAC in MP4 container.
 * Returns a job ID that can be polled for progress.
 */
export async function transcodeToH264(
  mediaId: string,
  inputPath: string,
  options?: { resolutionCap?: number }
): Promise<string> {
  const outputDir = ensureTranscodeDir(mediaId);
  const outputPath = path.join(outputDir, "output.mp4");

  // If already transcoded and file exists, return immediately
  if (fs.existsSync(outputPath)) {
    const existing = jobs.get(mediaId);
    if (existing?.status === "done") return mediaId;
  }

  // If already running, return the existing job
  const existingJob = jobs.get(mediaId);
  if (existingJob && (existingJob.status === "in_progress" || existingJob.status === "queued")) {
    return mediaId;
  }

  const accel = await detectHardwareAccel();
  const encoderArgs = getEncoderArgs(accel);

  const probe = await probeFile(inputPath);

  const scaleFilter: string[] = [];
  if (options?.resolutionCap && probe.height > options.resolutionCap) {
    scaleFilter.push("-vf", `scale=-2:${options.resolutionCap}`);
  }

  const job: TranscodeJob = {
    id: mediaId,
    inputPath,
    outputDir,
    status: "in_progress",
    progress: 0,
  };
  jobs.set(mediaId, job);

  const preInputArgs: string[] = [];
  if (accel === "nvenc") {
    preInputArgs.push("-hwaccel", "cuda", "-hwaccel_output_format", "cuda");
  }

  const videoEncoderArgs = accel === "nvenc"
    ? encoderArgs.slice(4) // skip hwaccel flags
    : encoderArgs;

  const args = [
    "-y",
    ...preInputArgs,
    "-i", inputPath,
    ...videoEncoderArgs,
    ...scaleFilter,
    "-c:a", "aac", "-b:a", "192k",
    "-g", "60", "-keyint_min", "60",
    "-movflags", "+faststart",
    "-progress", "pipe:1",
    outputPath,
  ];

  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  job.process = proc;

  let stderrChunks = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderrChunks += chunk.toString();
  });

  proc.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    // Parse "out_time_us" from FFmpeg progress output
    const match = text.match(/out_time_us=(\d+)/);
    if (match && probe.duration > 0) {
      const outTimeSec = parseInt(match[1], 10) / 1_000_000;
      job.progress = Math.min(99, Math.round((outTimeSec / probe.duration) * 100));
    }
    if (text.includes("progress=end")) {
      job.progress = 100;
    }
  });

  proc.on("close", (code) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      job.status = "done";
      job.progress = 100;
    } else {
      job.status = "error";
      job.error = stderrChunks.slice(-500);
    }
    job.process = undefined;
  });

  proc.on("error", (err) => {
    job.status = "error";
    job.error = err.message;
    job.process = undefined;
  });

  return mediaId;
}

/**
 * Gets the status of a transcode job.
 */
export function getTranscodeJob(jobId: string): Omit<TranscodeJob, "process"> | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const { process: _proc, ...rest } = job;
  return rest;
}

/**
 * Returns the path to a transcoded file if it exists.
 */
export function getTranscodedPath(mediaId: string): string | null {
  const outputPath = path.join(TRANSCODES_DIR, mediaId, "output.mp4");
  return fs.existsSync(outputPath) ? outputPath : null;
}

/**
 * Packages a video file as HLS with multi-bitrate ladder.
 * Creates: master.m3u8, stream_0/ (1080p), stream_1/ (720p), stream_2/ (480p)
 */
export async function packageAsHLS(
  mediaId: string,
  inputPath: string
): Promise<string> {
  const hlsDir = path.join(ensureTranscodeDir(mediaId), "hls");
  if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
  }

  const masterPath = path.join(hlsDir, "master.m3u8");
  if (fs.existsSync(masterPath)) return hlsDir;

  const accel = await detectHardwareAccel();

  // Build a multi-bitrate HLS ladder
  const hwAccelInput = accel === "nvenc"
    ? ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"]
    : accel === "qsv"
      ? ["-hwaccel", "qsv"]
      : [];

  const encoder = accel === "nvenc" ? "h264_nvenc"
    : accel === "qsv" ? "h264_qsv"
    : accel === "videotoolbox" ? "h264_videotoolbox"
    : "libx264";

  const args = [
    "-y",
    ...hwAccelInput,
    "-i", inputPath,
    // 1080p
    "-map", "0:v:0", "-map", "0:a:0",
    "-c:v:0", encoder, "-b:v:0", "5000k", "-maxrate:v:0", "5500k", "-bufsize:v:0", "10000k",
    "-vf:0", "scale=-2:1080",
    // 720p
    "-map", "0:v:0", "-map", "0:a:0",
    "-c:v:1", encoder, "-b:v:1", "2800k", "-maxrate:v:1", "3000k", "-bufsize:v:1", "6000k",
    "-vf:1", "scale=-2:720",
    // 480p
    "-map", "0:v:0", "-map", "0:a:0",
    "-c:v:2", encoder, "-b:v:2", "1400k", "-maxrate:v:2", "1500k", "-bufsize:v:2", "3000k",
    "-vf:2", "scale=-2:480",
    // Audio for all streams
    "-c:a", "aac", "-b:a", "192k",
    // HLS settings
    "-g", "60", "-keyint_min", "60",
    "-hls_time", "4",
    "-hls_playlist_type", "vod",
    "-hls_segment_filename", path.join(hlsDir, "stream_%v/segment_%03d.ts"),
    "-master_pl_name", "master.m3u8",
    "-var_stream_map", "v:0,a:0 v:1,a:1 v:2,a:2",
    path.join(hlsDir, "stream_%v/index.m3u8"),
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(hlsDir);
      } else {
        reject(new Error(`HLS packaging failed: ${stderr.slice(-500)}`));
      }
    });
    proc.on("error", reject);
  });
}
