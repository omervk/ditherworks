# Image Crop Craft

Local‑first batch image cropper and converter for a fixed 800×480 output. Load a folder of images, preview a fixed‑aspect crop, nudge the vertical position, and convert everything in one go. The backend streams a ZIP of 16‑bit RGB565 BMPs with Floyd–Steinberg dithering — ideal for small TFT devices (e.g., PhotoPainter).

![](docs/screenshot.png)

Vibe coded with ❤️ by Omer van Kloeten for local, private, and efficient image prep.

## Example

Original image:

![](docs/original.jpg)

Converted image (800x480, dithered 6-color BMP):

![](docs/converted.bmp)

## Features

- Local‑only workflow: images never leave your machine
- Drag‑and‑drop files or select an entire folder
- Fixed 800×480 aspect preview; drag vertically to position the crop band
- Smart initial crop (placeholder today, face‑detection PRD ready)
- Batch convert to BMP (RGB565) with dithering; streamed ZIP download
- Live progress via Server‑Sent Events (SSE)
- Persistent selection and crop positions using IndexedDB (restored on reload)
- Polished UI with shadcn/ui, toasts, and keyboard‑friendly interactions

## Tech stack

- Frontend: Vite + React (TypeScript), React Router v6, Tailwind CSS, shadcn/ui
- State/UX: TanStack Query provider, shadcn Toaster + Sonner
- Backend: Node.js 22 + Fastify (multipart uploads, health, routes), Pino logs
- Image processing: sharp (EXIF rotate, sRGB, crop/resize) + ImageMagick (dither, posterize, BMP565)
- Packaging: archiver streams ZIP responses

## How it works

- Frontend
  - `src/pages/Index.tsx` orchestrates the flow: upload → preview → convert
  - `src/components/ImageUpload.tsx` handles drag‑and‑drop and folder selection
  - `src/components/ImageGallery.tsx` loads images, requests an initial crop suggestion, tracks progress, and triggers conversion
  - `src/components/ImageCropPreview.tsx` renders the image with a fixed‑aspect crop band you can drag vertically
  - `src/lib/storage.ts` persists images + `y` crop using IndexedDB
  - `src/lib/api.ts` wraps calls to the backend

- Backend
  - `GET /api/health` — service status
  - `POST /api/suggest-crop` — returns initial vertical crop `y` and natural dimensions
    - Current implementation returns `y = 0`; see PRD for face detection
  - `POST /api/convert` — accepts a manifest + files and streams a ZIP of converted BMPs
  - `GET /api/progress/:jobId` — Server‑Sent Events for live progress during conversion
  - See `server/src/lib/image.ts` for crop math and the sharp → ImageMagick pipeline

- Processing pipeline (per image)
  1) `sharp`: rotate (EXIF), convert to sRGB
  2) Compute cropHeight = naturalWidth / (800/480), clamp `y`, extract band, resize to 800×480
  3) `magick`: `-dither FloydSteinberg -posterize 2 -depth 5,6,5 bmp3:-`
  4) Stream each BMP into a ZIP via `archiver`

## Prerequisites

- Node.js 22 (LTS)
- ImageMagick 7+ CLI (`magick`) available in PATH
- libvips 8.14+ (required by sharp)

macOS (Homebrew):
```bash
brew install vips imagemagick
```

Linux (Debian/Ubuntu):
```bash
sudo apt-get update
sudo apt-get install -y libvips imagemagick
```

Windows:
- Install ImageMagick (ensuring `magick.exe` is on PATH)
- sharp bundles libvips; no separate install usually required

Verify tools:
```bash
vips --version
magick -version
node -v
```

### HEIC/HEIF support (libheif)

HEIC/HEIF decoding requires libvips built with libheif.

macOS (Homebrew):
```bash
brew install libheif
```

Debian/Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y libheif1 libheif-dev
```

Fedora:
```bash
sudo dnf install -y libheif libheif-devel
```

Arch Linux:
```bash
sudo pacman -S libheif
```

Alpine:
```bash
sudo apk add libheif-dev
```

If you add libheif after installing dependencies, reinstall sharp so it picks up support:
```bash
rm -rf node_modules
npm install
```

## Local setup

1) Install dependencies
```bash
npm install
```

2) Start the backend (terminal A)
```bash
npm run server:dev
```

3) Start the frontend (terminal B)
```bash
npm run dev
```

4) Open the app at `http://localhost:8080`

Notes
- The Vite dev server proxies `/api/*` to `http://127.0.0.1:8787` (see `vite.config.ts`), so no CORS hassles in development.
- The backend binds to `127.0.0.1:8787` with sensible multipart limits.

## Using the app

1) Drag‑and‑drop images or click to select images/folders (PNG/JPG/JPEG/GIF/BMP/WebP/HEIC/HEIF)
2) For each image, adjust the crop band’s vertical position
3) Click “Convert All” to start processing
4) Watch progress; a `converted.zip` file downloads automatically on completion

Output naming: each image becomes `<original_base>_800x480.bmp` inside the ZIP.

Limits (defaults)
- Up to 200 files per request
- Max 30 MB per file

## API reference

Base URL (dev): `http://127.0.0.1:8787/api`

### Health
```bash
curl -sS http://127.0.0.1:8787/api/health
```

### Suggest crop
Multipart form with `image` file; returns `{ y, naturalWidth, naturalHeight }`.
```bash
curl -sS -X POST http://127.0.0.1:8787/api/suggest-crop \
  -F image=@/path/to/image.jpg
```

### Convert (ZIP stream)
Send a JSON `manifest` plus repeated `files` entries. Optional `jobId` correlates with SSE progress.
```bash
curl -sS -X POST http://127.0.0.1:8787/api/convert \
  -F manifest='{"jobId":"YOUR_JOB_ID","images":[{"fileName":"a.jpg","y":23},{"fileName":"b.png","y":51}]}' \
  -F files=@/path/to/a.jpg \
  -F files=@/path/to/b.png \
  -o converted.zip
```

### Progress (SSE)
```bash
curl -N http://127.0.0.1:8787/api/progress/YOUR_JOB_ID
```

## Configuration

- Dev server: Vite on port 8080; proxy for `/api` → `http://127.0.0.1:8787`
- Path alias: `@` → `./src`
- Backend environment: by default CORS is disabled; development uses the proxy. If you plan to call the backend directly from a different origin, you’ll need to enable and configure CORS appropriately in `server/src/index.ts`.
- Concurrency: conversion uses a small in‑process limiter (currently 2). Adjust in `server/src/routes/convert.ts` if needed.

## Build for production

- Frontend
```bash
npm run build
# Preview the static build
npm run preview
```

- Backend
```bash
npm run server:build
npm run server:start
```

You can serve the frontend’s `dist/` with any static web server (or a CDN) and run the backend separately. In production deployments across different origins, configure CORS on the backend and point the frontend to it (adjusting your proxy or API base URL as needed).

## Project structure (high‑level)

- `src/` — React app
  - `pages/` (`Index.tsx`, `NotFound.tsx`)
  - `components/` (feature components + `ui/` primitives)
  - `lib/` (`api.ts`, `storage.ts`, `utils.ts`)
  - `main.tsx`, `App.tsx`
- `server/` — Fastify backend
  - `src/index.ts` (app + route registration)
  - `src/routes/` (`suggest.ts`, `convert.ts`, `progress.ts`)
  - `src/lib/` (`image.ts` for crop/convert, `progress.ts` for SSE jobs)
- `docs/prd/` — PRDs for backend and face detection

## Roadmap

- Face detection–based crop suggestions (`docs/prd/face-detection.md`)
- Horizontal crop control: add `x` coordinate and horizontal sliding of the crop window (UI + server)
- Keyboard nudging, zoom, and accessibility improvements

## Troubleshooting

- `magick: command not found`
  - Install ImageMagick 7+ and ensure `magick` is on PATH (macOS: `brew install imagemagick`).

- sharp install/runtime errors
  - Ensure Node 22 is used. On Linux/macOS, install `libvips` (see prerequisites). Then reinstall: `rm -rf node_modules && npm install`.
  - For HEIC/HEIF: sharp relies on libvips built with libheif. Homebrew `vips` includes libheif by default; on Linux, install `libheif` alongside `libvips`.

- “CORS” errors in production
  - In dev, the Vite proxy avoids CORS. For non‑proxy deployments, enable/configure CORS in the backend and ensure your frontend points to the correct API origin.
