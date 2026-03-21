import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSetting } from "@/lib/storage";

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  ".mkv": "video/x-matroska",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".wmv": "video/x-ms-wmv",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".webm": "video/webm",
};

export function getVideoContentType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_CONTENT_TYPES[ext] ?? null;
}

/**
 * Validates that `filePath` is inside the configured library root.
 * Returns the resolved file path on success, or a NextResponse error.
 */
export function validateLibraryPath(filePath: string): string | NextResponse {
  const libraryRootPath = getSetting("libraryRootPath");
  if (!libraryRootPath) {
    return NextResponse.json(
      { error: "Library path not set." },
      { status: 400 }
    );
  }

  const resolvedRoot = path.resolve(libraryRootPath);
  const resolvedFile = path.resolve(filePath);
  const rootPrefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  if (!resolvedFile.startsWith(rootPrefix)) {
    return NextResponse.json(
      { error: "File path must be within the library root." },
      { status: 403 }
    );
  }

  return resolvedFile;
}

export type ParsedRange = {
  start: number;
  end: number;
};

/**
 * Parses a Range header value (e.g. "bytes=0-1023") against a known file size.
 * Returns the parsed range, or null if the header is absent/empty.
 * Throws an object with `status: 416` for invalid/unsatisfiable ranges.
 */
export function parseRangeHeader(
  rangeHeader: string | null,
  fileSize: number
): ParsedRange | null {
  if (!rangeHeader) return null;

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const startStr = match[1];
  const endStr = match[2];

  let start: number;
  let end: number;

  if (startStr && endStr) {
    start = Number(startStr);
    end = Number(endStr);
  } else if (startStr) {
    // "bytes=N-" → from N to end
    start = Number(startStr);
    end = fileSize - 1;
  } else if (endStr) {
    // "bytes=-N" → last N bytes
    const suffix = Number(endStr);
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else {
    return null;
  }

  if (start > end || start < 0 || end >= fileSize) {
    throw { status: 416, fileSize };
  }

  return { start, end };
}

// Default chunk size: 1 MB
const DEFAULT_CHUNK_SIZE = 1024 * 1024;

/**
 * Creates a streaming Response for a video file, with full Range request support.
 */
export function createStreamResponse(
  resolvedFilePath: string,
  rangeHeader: string | null
): Response {
  const stat = fs.statSync(resolvedFilePath);
  const fileSize = stat.size;

  const contentType = getVideoContentType(resolvedFilePath) ?? "application/octet-stream";

  let range: ParsedRange | null;
  try {
    range = parseRangeHeader(rangeHeader, fileSize);
  } catch {
    return new NextResponse("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  if (range) {
    const { start, end } = range;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(resolvedFilePath, { start, end });
    const webStream = readableNodeToWeb(stream);

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  }

  // No range → cap at DEFAULT_CHUNK_SIZE for initial response, but serve full if small
  if (fileSize <= DEFAULT_CHUNK_SIZE) {
    const stream = fs.createReadStream(resolvedFilePath);
    const webStream = readableNodeToWeb(stream);

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  }

  // Large file without range → serve full file (browser will issue range requests for seeking)
  const stream = fs.createReadStream(resolvedFilePath);
  const webStream = readableNodeToWeb(stream);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Converts a Node.js Readable stream to a Web ReadableStream.
 */
function readableNodeToWeb(
  nodeStream: fs.ReadStream
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        controller.enqueue(new Uint8Array(Buffer.from(chunk)));
      });
      nodeStream.on("end", () => {
        controller.close();
      });
      nodeStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}
