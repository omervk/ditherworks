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

export async function convertToBmp565WithDither(input: Buffer, cropY: number): Promise<Buffer> {
  const src = sharp(input, { failOn: 'none' }).rotate().toColourspace('srgb');
  const meta = await src.metadata();
  if (!meta.width || !meta.height) throw new Error('Unable to read image dimensions');

  const naturalWidth = meta.width;
  const naturalHeight = meta.height;
  // Compute a safe crop rectangle that always fits in source image
  const fullWidthCropHeight = Math.floor(naturalWidth / TARGET_ASPECT);

  let extractLeft = 0;
  let extractTop = 0;
  let extractWidth = naturalWidth;
  let extractHeight = 0;

  if (fullWidthCropHeight <= naturalHeight) {
    // Full-width crop fits; allow vertical positioning via cropY
    extractHeight = fullWidthCropHeight;
    const maxTop = Math.max(0, naturalHeight - extractHeight);
    extractTop = Math.max(0, Math.min(Math.floor(cropY), maxTop));
  } else {
    // Image is wider than target aspect; use full height and center horizontally
    extractHeight = naturalHeight;
    extractWidth = Math.floor(naturalHeight * TARGET_ASPECT);
    extractLeft = Math.max(0, Math.floor((naturalWidth - extractWidth) / 2));
    extractTop = 0; // no vertical room when using full height
  }

  const preprocessed = await src
    .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'cover', position: 'centre' })
    .toFormat('png')
    .toBuffer();

  const bmp = await runMagick(
    ['png:-', '-dither', 'FloydSteinberg', '-posterize', '2', '-depth', '5,6,5', 'bmp3:-'],
    preprocessed
  );

  return bmp;
}

export const ImageConstants = { TARGET_WIDTH, TARGET_HEIGHT, TARGET_ASPECT } as const;


