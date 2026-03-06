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
MAGNET_API_BASE_URL="http://localhost:8000"
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

## MagnetAPI fallback search

When the top search bar returns no local movie or TV results, Aperture can query
MagnetAPI for Pirate Bay video results and show magnet links as a fallback.

**`npm run dev` starts the MagnetAPI container automatically** (via the `predev`
script). Ensure Docker is running; the first time may take a moment while the
image is pulled.

Manual setup (optional):

1. Pull the container:

```bash
docker pull ghcr.io/thomasrog3rs/magnetapi:v0.1
```

2. Run MagnetAPI locally on port `8000`:

```bash
docker run -d --name magnetapi -p 8000:8000 ghcr.io/thomasrog3rs/magnetapi:v0.1
```

3. Make sure `.env.local` points Aperture at that container:

```bash
MAGNET_API_BASE_URL="http://localhost:8000"
```

4. Optional verification:

```bash
curl "http://localhost:8000/pirate-bay/inception/video"
```

If the local search has no matches, Aperture will show MagnetAPI fallback
results with metadata such as seeders, size, and date.

Important: turn on your VPN before opening magnet links. The app will remind
you before launching one.

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

