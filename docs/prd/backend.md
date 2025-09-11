# DitherWorks for PhotoPainter — Backend PRD

## 1. Purpose & Scope
- Provide a local-first backend to:
  - Suggest an initial vertical crop position (`y`) for each uploaded image.
  - Perform batch conversion to fixed output 800×480 using client-provided `y` per image.
  - Stream results back efficiently as a ZIP for download.
- Non-goals: authentication, persistence/database, user accounts, multi-tenant.

## 2. Constraints & Principles
- Must run locally alongside the Vite frontend (`localhost:8080`).
- Minimal dependencies; fast startup; low memory while handling many images.
- Stream processing where possible; avoid buffering full images/archives in memory.
- Safe defaults: bind to `127.0.0.1`, CORS disabled when using Vite proxy.

## 3. Lean Tech Choices (Recommended)
- Runtime: Node.js 22 LTS
- Web framework: Fastify (small, fast, robust multipart + schema)
- Image processing: sharp
- ZIP streaming: archiver (battle-tested streaming), alternative: yazl
- Validation: zod (already in repo) or Fastify JSON schema
- Logging: pino (Fastify default)
- CORS: @fastify/cors (only if not using Vite proxy)

Notes
- This balances minimalism with reliability for `multipart/form-data` and streaming.
- Alternative ultra-lean stack (optional): Hono + hono/multipart + sharp + yazl. Choose if you prefer Fetch-style APIs; Fastify stays recommended for simpler file upload ergonomics.

## 4. Local Development & Run Strategy
- Backend port: 8787
- Bind address: 127.0.0.1
- Vite dev proxy (recommended; disables CORS complexity):

```ts
// vite.config.ts
export default defineConfig(({ mode }) => ({
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        secure: false,
      },
    },
  },
  // ...
}));
```

Server file layout:
- `server/src/index.ts` (Fastify app + routes)
- `server/src/routes/convert.ts`, `server/src/routes/suggest.ts`
- `server/src/lib/image.ts` (crop math + sharp helpers)

Scripts:
- `server:dev`: tsx watch `server/src/index.ts`
- `server:build`: tsc build to `server/dist`
- `server:start`: node `server/dist/index.js`

### System prerequisites
- Node.js 22 LTS installed
- libvips 8.14+ installed on the host (required by sharp; enables HEIC when libheif is present)
  - macOS: `brew install vips`
  - Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y libvips`
  - Fedora: `sudo dnf install -y vips`
  - Windows: sharp bundles prebuilt libvips; no separate install typically required
- ImageMagick 7+ (CLI `magick`) installed for Floyd–Steinberg dithering, posterize, and 16‑bit RGB565 BMP encoding.
  - macOS: `brew install imagemagick`
  - Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y imagemagick`
  - Fedora: `sudo dnf install -y imagemagick`
  - Windows (Chocolatey): `choco install imagemagick`
- Verify: `vips --version` and/or check `sharp.versions.vips`

## 5. API Surface
- Base path: `/api`

### 5.1 Health
- `GET /api/health`
  - 200 OK `{ status: 'ok' }`

### 5.2 Suggest Crop Position
- `POST /api/suggest-crop`
  - Content-Type: `multipart/form-data`
  - Form fields:
    - `image`: file (required)
  - Response: 200 OK (JSON)
    - `{ y: number; naturalWidth: number; naturalHeight: number }`
  - Notes:
    - The y value is the number of pixels from the top of the image's natural dimensions where the frame should start.
    - For this initial implementation, the y value will always return as 0
  - Errors:
    - 400 invalid input, 415 unsupported media type, 500 processing failure

### 5.3 Batch Convert
- `POST /api/convert`
  - Content-Type: `multipart/form-data`
  - Form fields:
    - `manifest`: JSON string, schema below (required)
    - `files`: repeated file field for each image (required)
  - Manifest schema (JSON):
    - `{ jobId?: string; images: Array<{ fileName: string; y: number }> }`
      - `jobId` (optional): a client-generated identifier used to correlate Server‑Sent Events (SSE) progress updates for this request
      - `fileName` must exactly match the uploaded file’s original name
      - `y` is the number of pixels from the top of the image where cropping should begin
  - Response (default synchronous):
    - `200 OK`, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="converted.zip"`
    - Streamed ZIP with processed images using output naming: `<base>_800x480.<ext>`
  - Errors:
    - 400 invalid manifest/mismatched files, 413 payload too large, 500 on processing

### 5.4 Progress (SSE)
- `GET /api/progress/:jobId`
  - Response: `text/event-stream` (SSE)
  - Events and payload shape:
    - `init`: `{ type: 'init', current: number, total: number }`
    - `progress`: `{ type: 'progress', current: number, total: number, fileName?: string }`
    - `complete`: `{ type: 'complete', current: number, total: number }`
    - `error`: `{ type: 'error', current: number, total: number, message?: string }`
  - Semantics:
    - `total` equals the number of images in the corresponding convert manifest
    - `current` increments by one per successfully processed image
    - Stream remains open until `complete` or `error`, then the server closes it

## 6. Request/Response Examples

Suggest (curl)
```bash
curl -sS -X POST http://127.0.0.1:8787/api/suggest-crop \
  -F image=@/path/to/image.jpg
```

Convert (curl)
```bash
curl -sS -X POST http://127.0.0.1:8787/api/convert \
  -F manifest='{"jobId":"YOUR_JOB_ID","images":[{"fileName":"a.jpg","y":23},{"fileName":"b.png","y":51.2}]}' \
  -F files=@/path/to/a.jpg \
  -F files=@/path/to/b.png \
  -o converted.zip
```

Progress (SSE)
```bash
# Replace YOUR_JOB_ID with the same ID used in the convert manifest
curl -N http://127.0.0.1:8787/api/progress/YOUR_JOB_ID
```

## 7. Algorithm & Crop Math

Definitions
- Target aspect ratio R = 800 / 480 (= 5:3 ≈ 1.6667)
- For a displayed crop band: `cropWidth = imageWidth`, `cropHeight = cropWidth / R`
- Max vertical travel: `maxY = max(0, naturalHeight - cropHeight)`

Conversion steps (per image)
1) Validate that `y` does not exceed `maxY` (clamp to [0, maxY]).
2) Load source with `sharp` and apply EXIF orientation: `sharp(input).rotate()`.
3) Convert to sRGB color space: `.toColourspace('srgb')` (avoid unintended color shifts).
4) Compute `cropHeight = naturalWidth / R`.
5) Compute `maxY`.
6) `extract({ left: 0, top: y, width: naturalWidth, height: cropHeight })`.
7) `resize(800, 480)` with `fit: 'fill'` (already precise after extract).
8) Apply Floyd–Steinberg dithering and `posterize 2`, then encode as 16‑bit RGB565 BMP (BMP v3) to match the ImageMagick reference command.
9) Stream the BMP entry into the ZIP without buffering the whole archive.

Performance
- Process images sequentially by default; allow small concurrency (e.g., 2–4) with a queue to cap memory.
- Set `sharp.concurrency(2)`; tune to CPU cores and thermals.
- Use a small in-process concurrency limiter (2–4) around per-file pipelines to avoid RAM spikes.
- Stream ZIP entries as each image completes; do not buffer entire archive.
- Apply backpressure: await stream `drain` events on ZIP output when needed.
- Emit SSE progress events after each image completes to update clients in real time.

### 7.1 BMP conversion (sharp + ImageMagick CLI)

Reference ImageMagick command (for a single file):

```bash
magick "$FILENAME" -resize 800 -gravity center -crop 800x480+0+0 +repage \
  -dither FloydSteinberg -posterize 2 -depth 5,6,5 bmp3:$DEST_PATH/$BASENAME.bmp
```

We follow the PRD's crop semantics (top-origin `y` at natural dimensions) using `sharp`, then apply dithering, posterize, and 16‑bit RGB565 BMP encoding via ImageMagick as a post-processing step. This achieves the same visual and file-format characteristics as the command above while preserving our custom `y` crop.

Implementation sketch (`server/src/lib/image.ts`):

```ts
import sharp from 'sharp';
import { spawn } from 'node:child_process';

const TARGET_WIDTH = 800;
const TARGET_HEIGHT = 480;
const TARGET_ASPECT = TARGET_WIDTH / TARGET_HEIGHT; // 5:3

function runMagick(args: string[], input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn('magick', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    const stdoutChunks: Buffer[] = [];
    let stderrText = '';

    proc.stdout.on('data', (c) => stdoutChunks.push(Buffer.from(c)));
    proc.stderr.on('data', (c) => (stderrText += c.toString()));

    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) return resolve(Buffer.concat(stdoutChunks));
      reject(new Error(`magick exited with code ${code}: ${stderrText}`));
    });

    proc.stdin.end(input);
  });
}

export async function convertToBmp565WithDither(
  input: Buffer,
  cropY: number
): Promise<Buffer> {
  // 1) Rotate (EXIF), sRGB, compute crop region using natural size
  const src = sharp(input, { failOn: 'none' }).rotate().toColourspace('srgb');
  const meta = await src.metadata();
  if (!meta.width || !meta.height) throw new Error('Unable to read image dimensions');

  const naturalWidth = meta.width;
  const naturalHeight = meta.height;
  const cropHeight = Math.round(naturalWidth / TARGET_ASPECT);
  const maxY = Math.max(0, naturalHeight - cropHeight);
  const top = Math.max(0, Math.min(cropY, maxY));

  // 2) Extract top-aligned band, then resize to 800x480 with exact fill
  const preprocessed = await src
    .extract({ left: 0, top, width: naturalWidth, height: cropHeight })
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'fill' })
    // Write a simple, lossless format to pipe into ImageMagick
    .toFormat('png')
    .toBuffer();

  // 3) Apply dithering + posterize + 16-bit RGB565 BMP (v3) via ImageMagick
  //    Equivalent to: -dither FloydSteinberg -posterize 2 -depth 5,6,5 bmp3:-
  const bmp = await runMagick(
    ['png:-', '-dither', 'FloydSteinberg', '-posterize', '2', '-depth', '5,6,5', 'bmp3:-'],
    preprocessed
  );

  return bmp;
}
```

Notes
- If ImageMagick is not present, we should return 500.
- The function above keeps processing in-memory buffers. For very large batches, prefer streaming into the ZIP entry directly (e.g., pipe `proc.stdout` to archiver) to reduce memory pressure.


## 8. Limits & Validation
- Max files per request: 200 (configurable)
- Max file size: 30 MB each (configurable)
- Accepted types: image/jpeg, image/png, image/webp, image/gif (static only), image/bmp, image/heic, image/heif
- Animated GIFs: rejected (only the first frame would be meaningful; we choose to reject to avoid ambiguity).
- Duplicate filenames: server deduplicates output entries by appending an index (e.g., `name(1).jpg`, `name(2).jpg`) in the ZIP to avoid overwrites. Manifest duplicates are invalid.
- Reject if any manifest entry is missing a matching file.
- Multipart/body limits (recommended): `@fastify/multipart` limits `{ files: 200, fileSize: 30 * 1024 * 1024 }`; Fastify `bodyLimit` ≈ 200 MB (tune to your needs).

## 9. Error Handling & Status Codes
- 200 success; 400 validation error; 413 payload too large; 415 unsupported media; 500 internal error.
- JSON error body: `{ error: string; details?: unknown }`

## 10. Security & Privacy
- Local only: bind `127.0.0.1`; no external exposure by default.
- No storage: images processed in-memory/stream and discarded; no on-disk persistence unless explicitly enabled.

## 11. Observability
- Pino structured logs at info level; include request id and timing.
- Basic metrics (optional): per-request durations and failure counts.

## 12. Frontend Integration Notes
- Use Vite proxy to call `/api/...` without CORS.
- For suggest flow: send a single image as `multipart/form-data` and use response `y` to set initial slider value.
- For convert flow: build `FormData` with `manifest` JSON + `files[]`. On success, stream download of the ZIP.
- For progress: generate a `jobId` on the client, include it in the convert `manifest`, and open an `EventSource('/api/progress/:jobId')` to consume `init`, `progress`, `complete`, and `error` events while the ZIP streams back.

## 13. Future Extensions
- Optional async jobs for very large batches.
- Return per-image reports (warnings, auto-exposure decisions).
- Persist manifests and allow re-download later.
- Support additional presets (e.g., 1920×1080) via query/body params.

## 14. Dependencies (npm)
- `fastify`, `@fastify/multipart`, `@fastify/cors`
- `sharp`
- `archiver` (or `yazl`)
- `zod` (already in repo, can reuse)
- `pino`

## 15. Acceptance Criteria
- Health endpoint responds 200.
- Suggest endpoint returns stable `y` for supported image types in <500ms for ~2–5 MP images on a modern laptop.
- Convert endpoint streams a valid ZIP of correctly cropped 800×480 images for a batch of 50 images within memory limits.
- Can run `vite` and backend simultaneously on macOS; frontend calls `/api/*` via proxy with no CORS errors.
