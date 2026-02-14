# Aperture — The Tom Collection

A local-first movie library manager that scans your disk, enriches metadata from OMDb, and plays movies in your default macOS video player.

## Requirements

- macOS (uses `open` to launch the default player)
- Node.js 18+ (for Next.js App Router)
- An OMDb API key

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with your OMDb credentials:

```bash
OMDB_API_KEY="YOUR_OMDB_KEY"
```

3. Run the dev server:

```bash
npm run dev
```

4. Visit [http://localhost:3000](http://localhost:3000), go to **Settings**, and set your library path (example):

```
/Volumes/Expansion/My Movies
```

5. Click **Sync Library** to scan, match OMDb, and build your grid.

## How scanning works

- Each movie is a folder under your library path.
- The app picks the **largest video file** in each folder as the movie file.
- Folder names are cleaned (removing release tags like `1080p`, `x264`, `BluRay`, etc.) before OMDb search.
- If OMDb returns no match, the local entry still appears with a “Not found” badge.

## Data storage

Local data is stored in SQLite at `data/aperture.db`:

- Settings (library path)
- Movie metadata (OMDb + local file paths)
- Personal ratings

## Notes

- This app is designed for local usage and is not intended for serverless deployment.
- The library path must be accessible by the running Node process.

