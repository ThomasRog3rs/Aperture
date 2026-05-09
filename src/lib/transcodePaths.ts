import path from "node:path";

const TRANSCODES_DIR = path.join(process.cwd(), "data", "transcodes");
const SAFE_MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function appendPathSegment(basePath: string, segment: string) {
  return `${basePath}${path.sep}${segment}`;
}

export function isSafeMediaId(mediaId: string) {
  return SAFE_MEDIA_ID_PATTERN.test(mediaId);
}

export function isSafeRelativePathSegment(segment: string) {
  return (
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\") &&
    !segment.includes("\0")
  );
}

export function getTranscodeDir(mediaId: string) {
  return appendPathSegment(TRANSCODES_DIR, mediaId);
}

export function getTranscodedFilePath(mediaId: string) {
  return appendPathSegment(getTranscodeDir(mediaId), "output.mp4");
}

export function getHlsDir(mediaId: string) {
  return appendPathSegment(getTranscodeDir(mediaId), "hls");
}

export function getHlsAssetPath(mediaId: string, segments: string[]) {
  let assetPath = getHlsDir(mediaId);
  for (const segment of segments) {
    assetPath = appendPathSegment(assetPath, segment);
  }
  return assetPath;
}

export function getStoryboardImagePath(mediaId: string) {
  return appendPathSegment(getTranscodeDir(mediaId), "storyboard.jpg");
}

export function getStoryboardVttPath(mediaId: string) {
  return appendPathSegment(getTranscodeDir(mediaId), "storyboard.vtt");
}
