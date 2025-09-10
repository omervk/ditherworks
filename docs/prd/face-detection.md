# Image Crop Craft — Face Detection Extension PRD (extends `backend.md`)

This document extends `docs/prd/backend.md` and supersedes only the `suggest-crop` behavior. All other endpoints, non-goals, constraints, run strategy, limits, error handling, security, observability, and conversion pipeline remain as specified in `backend.md`.

## 1. Purpose & Scope (Delta)
- Replace the `suggest-crop` endpoint’s placeholder logic with face detection–based logic that picks the vertical start `y` so the 800×480 crop band includes as many faces as possible.
- If all faces cannot fit, prefer larger faces first (by bounding-box area), then medium, then smaller.
- Deterministic output: same input → same `y`.

## 2. Face Detection Options (Node alternatives)
Choose one implementation; others remain supported alternatives. The algorithm below is library-agnostic once face boxes are available.
- `@mediapipe/tasks-vision` (recommended default)
  - Pros: Fast CPU inference, WASM (no native build), solid accuracy.
  - Cons: Larger WASM/model asset.
- `@vladmandic/face-api` + `@tensorflow/tfjs-node` (or `-gpu`)
  - Pros: Mature; multiple detectors (TinyFaceDetector/SSD); landmarks.
  - Cons: Heavier native deps (libtensorflow), larger install.
- `opencv4nodejs` (OpenCV DNN SSD or Haar cascades)
  - Pros: Flexible, ubiquitous.
  - Cons: Requires OpenCV native install/build.

## 3. API Delta — POST `/api/suggest-crop`
- Content-Type and `image` field remain unchanged. Add optional parameters:
  - `minConfidence` (number, default 0.6): discard faces below this score.
  - `debug` (boolean, default false): include detected face boxes in the response.
- Response (adds optional field when `debug=true`):
  - Base: `{ y: number; naturalWidth: number; naturalHeight: number }`
  - Debug: `faces: Array<{ x: number; y: number; width: number; height: number; confidence?: number }>` (natural coordinates after EXIF rotation)
- Behavior change: `y` is selected to maximize included faces; if not all fit, larger faces are preferred.

Example (debug)
```bash
curl -sS -X POST 'http://127.0.0.1:8787/api/suggest-crop?debug=true&minConfidence=0.65' \
  -F image=@/path/to/group_photo.png
```

## 4. Algorithm (Supersedes `suggest-crop` selection only)
- Let target aspect ratio R = 800/480. Crop band has width = naturalWidth and height `cropHeight = naturalWidth / R`. Max travel `maxY = max(0, naturalHeight - cropHeight)` as defined in `backend.md`.
- Detect faces on the oriented, sRGB image buffer to get boxes `{ x, y, width, height, confidence? }` in natural coordinates.
- Filter faces by `confidence >= minConfidence`.
- Compute face area `A = width * height`, sort faces by descending area (rank 0 = largest).
- Inclusion rule: a face counts as included if its vertical center `cy = y + height/2` lies in `[Y, Y + cropHeight]`.
- For each face, valid crop starts that include it form interval `I = [cy - cropHeight, cy]` clamped to `[0, maxY]`.
- Choose `Y` that lies in the maximum number of intervals (sweep-line over interval endpoints). Tie-breakers:
  1) Prefer sets that include lower ranks first (lexicographic by area rank).
  2) Then prefer greater sum of included areas.
  3) Then prefer `Y` that better centers included faces (closest to average `cy`).
- Fallback: if no faces detected, center the band vertically.

Pseudocode
```ts
type Box = { x: number; y: number; width: number; height: number; confidence?: number };

function suggestYForFaces(meta: { width: number; height: number }, faces: Box[], minConfidence = 0.6): number {
  const R = 800 / 480;
  const cropHeight = Math.round(meta.width / R);
  const maxY = Math.max(0, meta.height - cropHeight);

  const filtered = faces.filter(f => (f.confidence ?? 1) >= minConfidence);
  if (filtered.length === 0) return Math.max(0, Math.min(maxY, Math.round((meta.height - cropHeight) / 2)));

  const ranked = filtered
    .map(f => ({ ...f, area: f.width * f.height, cy: f.y + f.height / 2 }))
    .sort((a, b) => b.area - a.area);

  const endpoints: { y: number; type: 'start' | 'end'; rank: number; area: number }[] = [];
  ranked.forEach((f, rank) => {
    const start = Math.max(0, Math.floor(f.cy - cropHeight));
    const end = Math.min(maxY, Math.ceil(f.cy));
    if (start <= end) {
      endpoints.push({ y: start, type: 'start', rank, area: f.area });
      endpoints.push({ y: end, type: 'end', rank, area: f.area });
    }
  });
  endpoints.sort((a, b) => a.y - b.y || (a.type === 'start' ? -1 : 1));

  const active = new Set<number>();
  const areas = new Map<number, number>();

  let bestY = 0, bestCount = -1, bestAreaSum = -1;
  let bestRanks = new Set<number>();
  let prevY = 0;

  for (const ep of endpoints) {
    if (ep.y > prevY && active.size > 0) {
      const yMid = Math.min(maxY, Math.max(0, Math.floor((prevY + ep.y) / 2)));
      const count = active.size;
      let areaSum = 0; for (const r of active) areaSum += areas.get(r) || 0;
      const ranks = new Set(active);

      const betterCount = count > bestCount;
      const betterRanks = !betterCount && count === bestCount && lexBetter(ranks, bestRanks);
      const betterArea = !betterCount && !betterRanks && count === bestCount && areaSum > bestAreaSum;
      if (betterCount || betterRanks || betterArea) {
        bestCount = count; bestRanks = ranks; bestAreaSum = areaSum; bestY = yMid;
      }
    }
    if (ep.type === 'start') { active.add(ep.rank); areas.set(ep.rank, ep.area); }
    else { active.delete(ep.rank); }
    prevY = ep.y;
  }

  return Math.max(0, Math.min(maxY, bestY));

  function lexBetter(a: Set<number>, b: Set<number>): boolean {
    const max = Math.max(a.size, b.size) + 64;
    for (let r = 0; r < max; r++) { const ain = a.has(r), bin = b.has(r); if (ain !== bin) return ain && !bin; }
    return false;
  }
}
```

## 5. Prerequisites & Assets (Delta)
- Face detection model/runtime assets must be available locally:
  - MediaPipe: FaceDetector WASM/model files (configurable path or lazy download at startup).
  - face-api.js: TinyFaceDetector/SSD model JSON + weights.
  - OpenCV: SSD prototxt + caffemodel, or Haar cascades.

## 6. Dependencies (Delta)
- One of the following (choose at build/run time):
  - `@mediapipe/tasks-vision`
  - `@vladmandic/face-api` and `@tensorflow/tfjs-node`
  - `opencv4nodejs` (requires OpenCV)

## 7. Acceptance Criteria (Delta)
- `suggest-crop` maximizes the count of included faces (by center criterion). If not all fit, larger faces are preferred lexicographically by area.
- Stable and performant: <500ms on ~2–5 MP images on a modern laptop with the recommended detector.
- Fallback when no faces: vertically centered crop.


