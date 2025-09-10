## Overview

Image Crop Craft is a local-first React app for loading a folder of images, previewing a fixed-aspect crop (800×480), adjusting the vertical position, and batch converting by sending image data and crop positions to a backend (currently simulated).

## Tech Stack

- Vite + React (TypeScript), React Router v6
- Tailwind CSS + shadcn/ui (Radix under the hood), cva, clsx/tailwind-merge
- Sonner + shadcn Toaster for notifications
- TanStack Query wired (not yet used for data fetching)

## App Structure

- `index.html` → `src/main.tsx` mounts React root
- `src/App.tsx` composes providers: `QueryClientProvider`, `TooltipProvider`, toasters, `BrowserRouter`
- Routes: `/` → `pages/Index`, `*` → `pages/NotFound`
- UI primitives under `src/components/ui/` (shadcn-generated components)
- Feature components: `ImageUpload`, `ImageGallery`, `ImageCropPreview`
- Utilities: `lib/utils.ts` (`cn` helper), Tailwind theme in `tailwind.config.ts`

## Routing

- React Router v6 `BrowserRouter` with two routes: home and catch-all 404
- `NotFound` logs path to console and links back to `/`

## Data Flow (Images → Convert)

1. `ImageUpload` accepts files/folder (drag-and-drop via react-dropzone) and returns `File[]` to `Index`
2. `Index` stores `images: File[]` and shows `ImageGallery`
3. `ImageGallery` creates `ObjectURL`s, reads natural dimensions, simulates backend crop suggestion (`cropY` 0–100)
4. Each image renders `ImageCropPreview` (draggable vertical crop band). Child calls back with `onCropPositionChange`
5. "Convert All" triggers `Index.onConvert(imageData)`; currently logs payload and shows toasts

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

## Extension Points

- Replace simulated crop suggestion and conversion with real backend API via TanStack Query
- Persist crop positions (local storage or backend) and support exports (ZIP/download)
- Add keyboard nudging, zoom, and multi-aspect presets; improve accessibility testing


