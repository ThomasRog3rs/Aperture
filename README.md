# Aperture

A local-first movie and TV library manager for macOS, Linux, and Windows. It scans your disk, enriches metadata from OMDb/TMDB, and plays media in your default video player.

![Aperture screenshot](/Screenshot%202026-03-06%20at%2022.14.35.png)

## Features

- **Movies** — One folder per movie; the largest video file is used. Metadata (poster, cast, genres, runtime, rating) is fetched from OMDb. You can rate titles (0–10), mark as watched, and play with one click.
- **TV series** — Organise shows as **Show folder → Season folders → episode files**. Seasons are detected by folder names (`Season 1`, `S1`, `1`); episodes by filenames (`S01E01`, `1x01`, `E01`, `101`). Each season gets OMDb metadata; episodes are listed with optional watched state.
- **Library sync** — **Sync Library** scans your library path, discovers movies and series, matches them to OMDb, and stores everything in a local SQLite database. Re-run sync to pick up new or changed folders.
- **Search & filters** — Search by title; filter by genre, cast/director/writer, personal rating (min), and watched status. Sort by rating, recently synced, or title. Switch between All, Movies, and TV Shows in the sidebar.
- **Personal ratings & watched** — Rate movies and seasons (0–10). Mark movies or individual episodes as watched; filter the library by watched/unwatched.
- **Folder images** — Use custom artwork by placing an image (e.g. `poster.jpg`, `cover.png`, `folder.jpg`) inside a movie or series folder. The app prefers names like `poster`, `cover`, `folder`, `front`. Supported: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.
- **Refresh poster** — On a movie or series/season detail page, use “Refresh poster” to re-fetch poster/backdrop from OMDb and update the stored art.
- **MagnetAPI fallback** — When the main search finds no local movies or TV results, Aperture can query MagnetAPI (Pirate Bay) and show magnet links. Enable VPN before opening links; the app reminds you.
- **Settings** — Set the library root path (single folder that contains all your movie and TV show folders).

## Requirements

- **macOS, Linux, or Windows** — Uses your OS default player integration (`open`, `xdg-open`, or `start`) to launch videos. Only the macOS `open` command has been tested; if Play does not work on Linux or Windows, please open a [GitHub issue](https://github.com/thomasrog3rs/Aperture/issues) or submit a PR to fix it.
- **Node.js 18+** — For the Next.js App Router app.
- **OMDb API key** — For metadata (posters, cast, genres, etc.).

## How to run

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Create `.env.local` in the project root:

   ```bash
   OMDB_API_KEY="YOUR_OMDB_KEY"
   MAGNET_API_BASE_URL="http://localhost:8000"
   # Optional override: darwin | linux | win32
   APERTURE_OS="darwin"
   ```

   Get an API key at [OMDb](https://www.omdbapi.com/apikey.aspx).
   If `APERTURE_OS` is not set, Aperture auto-detects the running OS.

3. **Start the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

4. **Set library path**

   Go to **Settings**, enter your library root path (e.g. `/Volumes/Expansion/My Media`), and save.

5. **Sync**

   Click **Sync Library** (from the main library view or Settings). The app will scan the library, match titles to OMDb, and build the grid. Re-run sync whenever you add or change folders.

### Production build

```bash
npm run build
npm start
```

## Library structure and formats

Use **one root folder** as your library path. Put all movie folders and TV show folders directly under that root.

### Movies

- **Structure:** One folder per movie, directly under the library root.
- **Video:** Place one or more video files inside the folder. Aperture picks the **largest file** as the movie to play.
- **Supported extensions:** `.mkv`, `.mp4`, `.m4v`, `.mov`, `.avi`, `.wmv`, `.mpg`, `.mpeg`.
- **Folder name:** Used for OMDb search. Release tags are stripped (e.g. `1080p`, `x264`, `BluRay`, `WEB-DL`). Including the **year** improves matching, e.g. `Inception (2010)` or `Dune 2021`.

**Example:**

```
/Volumes/Media/
├── Inception (2010)/
│   └── Inception.2010.1080p.BluRay.mkv
├── Dune (2021)/
│   ├── Dune.2021.2160p.mkv
│   └── poster.jpg
└── The Matrix/
    └── The.Matrix.1999.mkv
```

### TV shows

- **Structure:** One folder per show; inside it, one folder per season. Episode files go inside the season folder.
- **Season folders** must be recognised by name. Supported patterns:
  - `Season 1`, `Season 2`
  - `S1`, `S2`
  - `1`, `2`
- **Episode files** must encode season and episode so the scanner can parse them. Supported patterns:
  - `S01E01`, `S1E1`
  - `1x01`, `1x1`
  - `E01` (when the file is already inside a season folder)
  - `101` (S1 E01) or `0101` (S01 E01)

  If multiple files map to the same episode number, the **largest file** is kept. Episode titles are derived from the filename when possible.

- **Video formats:** Same as movies (`.mkv`, `.mp4`, etc.).
- **Show/season folder names:** Show folder name is cleaned for OMDb (year helps). Season folder name only needs to match the season patterns above.

**Example:**

```
/Volumes/Media/
└── Breaking Bad/
    ├── Season 1/
    │   ├── Breaking.Bad.S01E01.mkv
    │   ├── Breaking.Bad.S01E02.mkv
    │   └── ...
    ├── Season 2/
    │   ├── Breaking.Bad.S02E01.mkv
    │   └── ...
    └── poster.jpg
```

Another valid style:

```
/Volumes/Media/
└── The Wire (2002)/
    ├── S01/
    │   ├── The.Wire.1x01.mkv
    │   └── ...
    └── S02/
        └── ...
```

### Optional: custom artwork

- **Movies:** Put an image such as `poster.jpg`, `cover.png`, or `folder.jpg` in the movie folder. The app will use it when available.
- **Series:** Same in the show folder; can be used as the series poster. Season folders can also contain their own images for season-level art.

## MagnetAPI fallback search

When the top search bar returns no local movie or TV results, Aperture can query MagnetAPI for Pirate Bay video results and show magnet links.

- **`npm run dev`** starts the MagnetAPI container automatically (via the `predev` script). Ensure Docker is running; the first run may pull the image.
- Optional manual setup:
  1. Pull: `docker pull ghcr.io/thomasrog3rs/magnetapi:v0.1`
  2. Run: `docker run -d --name magnetapi -p 8000:8000 ghcr.io/thomasrog3rs/magnetapi:v0.1`
  3. Set in `.env.local`: `MAGNET_API_BASE_URL="http://localhost:8000"`
- Verify: `curl "http://localhost:8000/pirate-bay/inception/video"`

**Important:** Turn on your VPN before opening magnet links. The app will remind you.

## Data storage

Local data is stored in SQLite at `data/aperture.db`:

- Settings (library path)
- Movies: paths, OMDb metadata, personal rating, watched
- Seasons: per-season metadata, rating, watched
- Episodes: file paths, episode numbers, watched
- Series: derived from season folder paths; optional custom title/poster

## Notes

- Designed for **local use**; not intended for serverless deployment.
- The library path must be readable by the Node process (e.g. mounted volume, no special permission blocks).
- Folder names are cleaned (release tags, audio/video codes, group names) before OMDb search; see `src/lib/cleanTitle.ts` for the list of stripped tokens. If OMDb returns no match, the item still appears in the library with a “Not found” badge.
