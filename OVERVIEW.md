## Overview

Image Crop Craft is a local-first React app for loading a folder of images, previewing a fixed-aspect crop (800×480), adjusting the vertical position, and batch converting by sending image data and crop positions to a local backend that performs streaming conversion and returns a ZIP.

## Tech Stack

- Vite + React (TypeScript), React Router v6
- Tailwind CSS + shadcn/ui (Radix under the hood), cva, clsx/tailwind-merge
- Sonner + shadcn Toaster for notifications
- TanStack Query wired (not yet used for data fetching)
- Backend: Node.js 22 + Fastify (multipart, health, routes), Pino logging
- Image processing: sharp (EXIF rotation, sRGB, crop + resize) + ImageMagick (Floyd–Steinberg dithering, posterize 2, 16‑bit RGB565 BMP)
- ZIP streaming: archiver (streams archive to client)

## App Structure

- `index.html` → `src/main.tsx` mounts React root
- `src/App.tsx` composes providers: `QueryClientProvider`, `TooltipProvider`, toasters, `BrowserRouter`
- Routes: `/` → `pages/Index`, `*` → `pages/NotFound`
- UI primitives under `src/components/ui/` (shadcn-generated components)
- Feature components: `ImageUpload`, `ImageGallery`, `ImageCropPreview`
- Utilities: `lib/utils.ts` (`cn` helper), Tailwind theme in `tailwind.config.ts`

- Backend files (local server):
  - `server/src/index.ts` (Fastify app, multipart, health route, route registration)
  - `server/src/routes/suggest.ts` (POST `/api/suggest-crop`)
  - `server/src/routes/convert.ts` (POST `/api/convert` streaming ZIP)
  - `server/src/lib/image.ts` (crop math + sharp preprocessing + ImageMagick BMP565)
  - Scripts: `server:dev`, `server:build`, `server:start`

## Routing

- React Router v6 `BrowserRouter` with two routes: home and catch-all 404
- `NotFound` logs path to console and links back to `/`

## Data Flow (Images → Convert)

1. `ImageUpload` accepts files/folder (drag-and-drop via react-dropzone) and returns `File[]` to `Index`
2. `Index` stores `images: File[]` and shows `ImageGallery`
3. `ImageGallery` creates `ObjectURL`s, reads natural dimensions, calls backend `POST /api/suggest-crop` per image; initial `y` (pixels from top) is returned; falls back to 0 on failure
4. Each image renders `ImageCropPreview` (draggable vertical crop band). Child calls back with `onCropPositionChange`
5. "Convert All" triggers `Index.onConvert(imageData)` which calls `convertBatch` to `POST /api/convert` with `manifest` + `files`; the server streams back `converted.zip`, which is downloaded client-side

## Key Components

- `ImageUpload`: drag-and-drop, folder selection (`webkitdirectory`), file type filtering, clean UI states
- `ImageGallery`: orchestrates loading, progress, state for `ImageData[]`, conversion CTA and feedback
- `ImageCropPreview`: calculates display size, fixed 800×480 aspect crop width=display width; vertical drag updates `cropY`%

## State & Patterns

- Local component state via `useState` and effects; upward data flow via callbacks
- Provider pattern in `App` for cross-cutting concerns (tooltips, toasts, query client)
- Resource cleanup: revokes `ObjectURL`s on unmount
- Styling via Tailwind + CSS variables; variants with `cva`; class merging via `cn`

## Error Handling & UX

- Try/catch during image loading with toast errors; success/info toasts for load/convert
- Loading and progress indicator while preparing images
- 404 route logs offending path

## Configuration Notes

- Vite alias `@` → `./src`; dev server on port 8080; React SWC plugin
- Tailwind theme extends CSS variable-driven colors, gradients, shadows, animations

- Vite dev proxy forwards `/api/*` to the backend at `http://127.0.0.1:8787` (see `vite.config.ts`). This avoids CORS.
- Backend binds to `127.0.0.1:8787` by default; CORS is disabled unless `ENABLE_CORS=1`.

## Backend Architecture

- Endpoints (base path `/api`):
  - `GET /api/health` → `{ status: 'ok' }`
  - `POST /api/suggest-crop` (`multipart/form-data` with `image`) → `{ y, naturalWidth, naturalHeight }`
    - Initial implementation returns `y = 0` with natural dimensions validated via sharp
  - `POST /api/convert` (`multipart/form-data`):
    - Fields: `manifest` JSON `{ images: Array<{ fileName: string; y: number }> }` and repeated `files`
    - Response: `application/zip` streamed; output files named `<base>_800x480.bmp`
- Processing pipeline (per image):
  - sharp: apply EXIF rotation, convert to sRGB, compute `cropHeight = naturalWidth / (800/480)`, clamp `y` ∈ [0, maxY], `extract` top-aligned band, `resize(800, 480)`
  - ImageMagick: apply `-dither FloydSteinberg -posterize 2 -depth 5,6,5` and encode BMP v3 (RGB565)
  - archiver streams ZIP entries as each image completes; limited concurrency via a small in-process limiter (default 2)
- Limits & validation (defaults): up to 200 files/request; 30 MB/file; rejects invalid manifest or missing files; returns 400/413/415/500 appropriately
- Observability & security: Pino logs; local-only bind; no persistence

## Development

- Prerequisites: Node.js 22; libvips available (sharp); ImageMagick (`magick`) installed for dithering/BMP565
- Run locally:
  - Frontend: `npm run dev`
  - Backend: `npm run server:dev` (or `server:build` + `server:start`)

## Extension Points

- TanStack Query integration for backend calls (currently using `fetch` helpers in `src/lib/api.ts`)
- Persist crop positions (local storage or backend) and support exports (ZIP/download)
- Add keyboard nudging, zoom, and multi-aspect presets; improve accessibility testing


