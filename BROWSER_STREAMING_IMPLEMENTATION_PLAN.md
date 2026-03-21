# Browser Video Streaming Implementation Plan (v1)

## 1) Goal
Move playback from OS-native launch (`/api/play` opening external player apps) to in-browser playback for:
- Movies
- TV episodes

This plan is implementation-ready and scoped to the confirmed constraints:
- **Direct-play only** (no transcoding in v1)
- **Localhost only** (same machine)
- **No subtitle support** in v1

---

## 2) Current State Summary

### Playback flow today
- UI sends `POST /api/play` with `filePath`.
- Backend validates path is inside `libraryRootPath`.
- Backend executes OS command (`open`/`xdg-open`/`cmd start`) to launch external player.

### Known playback call sites
- `src/components/LibraryView.tsx`
- `src/app/(app)/movies/[id]/page.tsx`
- `src/app/(app)/series/[id]/page.tsx`

### Existing data model strengths
- `movies.filePath` and `episodes.filePath` already exist in SQLite.
- IDs for movies/episodes already power detail routes.

### Existing security patterns to reuse
- Folder image APIs enforce filename/path safety and folder containment.
- `/api/play` already enforces library-root containment.

---

## 3) v1 Scope and Non-Goals

## In scope
- Browser playback for movies and episodes from local files.
- HTTP byte-range streaming endpoint(s).
- Player UI integration in movie detail and series episode surfaces.
- Safe path validation against configured library root.
- Graceful fallback path to existing `/api/play` during transition.

## Out of scope (v1)
- Server-side transcoding.
- Subtitles (embedded or external).
- Remote access/local-network multi-device streaming.
- DRM/user auth/multi-user session management.

---

## 4) Target Architecture (v1)

## Backend
- Add Node runtime streaming endpoints that:
  - Resolve media file by entity ID (not raw path from client).
  - Validate resolved path is inside `libraryRootPath`.
  - Parse/validate `Range` request headers.
  - Return:
    - `206 Partial Content` for valid ranges
    - `200 OK` when no range header is sent (optional; can standardize on range handling)
    - `416 Range Not Satisfiable` for invalid ranges
  - Set required headers:
    - `Accept-Ranges: bytes`
    - `Content-Range` (for 206)
    - `Content-Length`
    - `Content-Type` (based on extension)
    - `Cache-Control: no-store` (or conservative private policy)

### Proposed endpoints
- `GET /api/movies/[id]/stream`
- `GET /api/episodes/[id]/stream`

Rationale: keeps ownership/permissions logic close to existing domain routes and avoids exposing absolute file paths in client requests.

## Frontend
- Replace `/api/play` usage with browser player surfaces:
  - Movie page: embedded `<video>` player for movie file.
  - Series page: playback action opens inline player for selected episode.
- Keep existing “Play externally” fallback action via `/api/play` (temporary during rollout).

---

## 5) Detailed Implementation Work Breakdown

## Phase A — Streaming foundation (backend)

### A1. Shared streaming utilities
Create reusable helpers in `src/lib`:
- MIME type resolver for supported video extensions.
- Library root containment validator.
- HTTP range parser/normalizer (`bytes=start-end`).
- Stream response builder from file descriptor + range.

Suggested file:
- `src/lib/streaming.ts`

### A2. Movie streaming route
Implement `GET /api/movies/[id]/stream`:
- Resolve movie by `id`.
- Read `movie.filePath`.
- Validate file exists and is under configured library root.
- Handle range requests and stream file chunks.
- Return explicit JSON errors for:
  - Missing ID / not found
  - Missing library root setting
  - File missing
  - Path outside root
  - Unsupported extension
  - Invalid range

Suggested file:
- `src/app/api/movies/[id]/stream/route.ts`

### A3. Episode streaming route
Implement `GET /api/episodes/[id]/stream`:
- Resolve episode by `id`.
- Same validation + range behavior as movie route.

Suggested file:
- `src/app/api/episodes/[id]/stream/route.ts`

### A4. Hardening and consistency
- Standardize error payload format with existing APIs.
- Ensure no endpoint ever accepts client-provided absolute file path.
- Align status codes across movie/episode streaming routes.

---

## Phase B — Player UI integration (frontend)

### B1. Movie detail page player
In `src/app/(app)/movies/[id]/page.tsx`:
- Add browser `<video controls>` surface using:
  - `src={`/api/movies/${movie.id}/stream`}`
- Keep current button semantics:
  - “Play” becomes in-browser playback trigger/focus.
  - Add temporary “Play externally” secondary action (calls existing handler).
- Improve state messages:
  - Loading/buffering
  - Playback failed with actionable fallback

### B2. Series episode playback
In `src/app/(app)/series/[id]/page.tsx`:
- Convert per-episode play action to set selected episode for inline player.
- Render `<video controls>` bound to:
  - `src={`/api/episodes/${selectedEpisode.id}/stream`}`
- Preserve episode table UX and watched checkbox behavior.
- Add “Play externally” fallback at episode level (temporary).

### B3. Library-level behavior
In `src/components/LibraryView.tsx`:
- Decide and implement one of:
  - Route-to-detail behavior (recommended): play on cards navigates to detail page and starts browser player there.
  - Inline modal player (higher complexity; defer unless required).
- Remove success messages that imply external app launch (“Playing …” launcher semantics).

---

## Phase C — Migration and rollout

### C1. Feature flag
Add a boolean setting/flag (env or settings-backed):
- `browserPlaybackEnabled` default `false` for safe rollout.
- When disabled, keep existing `/api/play` behavior only.
- When enabled, show browser player path + optional external fallback action.

### C2. Transition strategy
1. Ship backend endpoints behind flag.
2. Enable movie page integration.
3. Enable series episode integration.
4. Update library entrypoint behavior.
5. Collect QA results; then default flag to `true`.
6. Later cleanup: deprecate/remove external launcher-only UX.

---

## 6) Security and Reliability Requirements

## Security
- Enforce strict library-root containment for every streamed path.
- Reject symlink/path traversal attempts by validating resolved absolute paths.
- Do not leak filesystem internals in client-facing error messages.

## Reliability
- Correct range semantics for browser scrubbing:
  - start-end, open-ended, suffix ranges
- Defensive handling for malformed range requests.
- Ensure file handles/streams close on aborted requests.
- Add structured server logs for playback failures (route + media ID + reason).

---

## 7) Testing Strategy

## Automated checks (existing tooling)
- Type/lint/build:
  - `npm run lint`
  - `npm run build`

## Backend verification matrix
- Movie route:
  - valid ID + valid range -> 206
  - valid ID + no range -> expected success
  - invalid ID -> 404
  - file missing -> 404
  - path outside root -> 403
  - invalid range -> 416
- Episode route: same cases as movie route.

## Frontend manual QA
- Movie page:
  - play, pause, seek, replay
  - load failure messaging + external fallback
- Series page:
  - select different episodes and verify correct media plays
  - watched toggles still work
- Library entrypoints:
  - card/hero actions route correctly to browser playback path

---

## 8) Acceptance Criteria

v1 is complete when:
- Movie and episode playback works in browser on localhost.
- Seek/scrub works (valid range support).
- No absolute file path is accepted from the client for streaming.
- Existing `/api/play` path remains available as transitional fallback.
- Lint/build pass.
- Manual QA matrix passes for movies and episodes.

---

## 9) Risk Register and Mitigations

## Risk: Browser cannot decode some local files
Mitigation:
- Explicitly document v1 as direct-play only.
- Show clear error messaging with “Play externally” fallback.
- Track unsupported formats for future transcoding phase.

## Risk: Incorrect range handling breaks seeking
Mitigation:
- Centralize range parser utility.
- Validate with multiple range formats and negative cases.

## Risk: Path validation bypass
Mitigation:
- Resolve absolute paths server-side only from DB IDs.
- Re-check against `libraryRootPath` before opening file stream.

---

## 10) Post-v1 Follow-ups (not part of current implementation)
- Subtitle support (embedded + external `.srt`).
- Local network streaming support.
- Optional transcoding pipeline for incompatible formats.
- Resume playback positions and richer playback analytics.
