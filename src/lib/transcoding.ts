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
const hlsPackagingJobs = new Map<string, Promise<string>>();

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
// Stricter set: codecs that are valid inside an MP4 container across all browsers.
// vorbis and flac are excluded — they are only valid in WebM/Ogg containers and
// Firefox refuses to play them when remuxed into MP4.
const MP4_COMPATIBLE_AUDIO_CODECS = new Set(["aac", "mp3", "opus"]);

export type ProbeResult = {
  videoCodec: string | null;
  audioCodec: string | null;
  container: string;
  duration: number;
  width: number;
  height: number;
  pixFmt: string | null;
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
  const streams: Array<{ codec_type: string; codec_name: string; width?: number; height?: number; pix_fmt?: string }> =
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
    pixFmt: videoStream?.pix_fmt ?? null,
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

  // Firefox has no 10-bit H.264 (Hi10P) decoder. Chrome handles it via hardware
  // acceleration. Force a transcode to 8-bit H.264 so Firefox can play the output.
  // AV1 and VP9 natively support 10-bit and Firefox decodes them fine, so only
  // gate on h264.
  const is10BitH264 =
    probe.videoCodec === "h264" &&
    probe.pixFmt != null &&
    (probe.pixFmt.includes("10") || probe.pixFmt.includes("12"));

  const videoCompatible = videoOk && !is10BitH264;

  if (containerOk && videoCompatible && audioOk) return "direct";
  if (videoCompatible && audioOk) return "remux";
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
      // Ensure 8-bit yuv420p pixel format before encoding. This is required for
      // h264_videotoolbox (and libx264) when the source is 10-bit (e.g. HEVC
      // Hi10P). Without this, the encoder may fail on macOS or produce frames
      // the browser can't decode.
      videoArgs = [...encoderArgs, "-vf", "format=yuv420p"];
    }
    // Force stereo output. The native ffmpeg aac encoder's multi-channel (5.1,
    // 7.1) support is unreliable; Firefox rejects non-standard AAC channel
    // configurations. Downmixing to stereo here handles DTS-HD MA, EAC3 5.1,
    // TrueHD, and any other surround source.
    audioArgs = ["-c:a", "aac", "-ac", "2", "-b:a", "192k"];
  }

  // Transcode audio that is not safe in an MP4 container even in remux mode.
  // WEB_PLAYABLE_AUDIO_CODECS includes vorbis and flac which work in WebM/Ogg
  // but are rejected by Firefox when muxed into MP4.
  if (mode === "remux") {
    try {
      const probe = await probeFile(filePath);
      if (probe.audioCodec && !MP4_COMPATIBLE_AUDIO_CODECS.has(probe.audioCodec)) {
        audioArgs = ["-c:a", "aac", "-ac", "2", "-b:a", "192k"];
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

  // Build the video filter chain. Combine resolution cap and pixel format
  // conversion into a single -vf argument so they don't conflict.
  const videoFilters: string[] = [];
  if (options?.resolutionCap && probe.height > options.resolutionCap) {
    videoFilters.push(`scale=-2:${options.resolutionCap}`);
  }
  // Ensure 8-bit yuv420p output for all non-nvenc paths. Required when the
  // source is 10-bit (e.g. HEVC Hi10P) so h264_videotoolbox and libx264 don't
  // reject the frame format.
  if (accel !== "nvenc") {
    videoFilters.push("format=yuv420p");
  }
  const filterArgs = videoFilters.length > 0 ? ["-vf", videoFilters.join(",")] : [];

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
    ...filterArgs,
    "-c:a", "aac", "-ac", "2", "-b:a", "192k",
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHlsReady(hlsDir: string, timeoutMs = 30_000): Promise<void> {
  const manifestPath = path.join(hlsDir, "master.m3u8");
  const firstSegmentPath = path.join(hlsDir, "segment_000.ts");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (fs.existsSync(manifestPath) && fs.existsSync(firstSegmentPath)) {
      const manifest = fs.readFileSync(manifestPath, "utf8");
      if (manifest.includes("#EXTINF")) {
        return;
      }
    }
    await delay(250);
  }

  throw new Error("Timed out waiting for HLS playlist.");
}

/**
 * Packages a video file as a single-variant HLS stream and resolves once the
 * first manifest + segment are ready for native HLS playback.
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
  const firstSegmentPath = path.join(hlsDir, "segment_000.ts");
  if (fs.existsSync(masterPath) && fs.existsSync(firstSegmentPath)) return hlsDir;

  const existingJob = hlsPackagingJobs.get(mediaId);
  if (existingJob) {
    return existingJob;
  }

  const job = (async () => {
    fs.rmSync(hlsDir, { recursive: true, force: true });
    fs.mkdirSync(hlsDir, { recursive: true });

    const accel = await detectHardwareAccel();
    const encoderArgs = getEncoderArgs(accel);
    const preInputArgs: string[] = [];
    if (accel === "nvenc") {
      preInputArgs.push("-hwaccel", "cuda", "-hwaccel_output_format", "cuda");
    }

    const videoEncoderArgs = accel === "nvenc"
      ? encoderArgs.slice(4)
      : encoderArgs;
    const filterArgs = accel !== "nvenc" ? ["-vf", "format=yuv420p"] : [];

    const args = [
      "-y",
      ...preInputArgs,
      "-i", inputPath,
      ...videoEncoderArgs,
      ...filterArgs,
      "-c:a", "aac",
      "-ac", "2",
      "-b:a", "192k",
      "-g", "60",
      "-keyint_min", "60",
      "-f", "hls",
      "-hls_time", "4",
      "-hls_list_size", "0",
      "-hls_playlist_type", "event",
      "-hls_flags", "independent_segments+temp_file",
      "-hls_segment_filename", path.join(hlsDir, "segment_%03d.ts"),
      masterPath,
    ];

    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000);
      }
    });

    const exitPromise = new Promise<void>((resolve, reject) => {
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`HLS packaging failed: ${stderr.slice(-500)}`));
      });
      proc.on("error", reject);
    });
    void exitPromise.catch(() => {});

    await Promise.race([waitForHlsReady(hlsDir), exitPromise]);
    return hlsDir;
  })().finally(() => {
    hlsPackagingJobs.delete(mediaId);
  });

  hlsPackagingJobs.set(mediaId, job);
  return job;
}
