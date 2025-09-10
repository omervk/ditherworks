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
  const cropHeight = Math.round(naturalWidth / TARGET_ASPECT);
  const maxY = Math.max(0, naturalHeight - cropHeight);
  const top = Math.max(0, Math.min(cropY, maxY));

  const preprocessed = await src
    .extract({ left: 0, top, width: naturalWidth, height: cropHeight })
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'fill' })
    .toFormat('png')
    .toBuffer();

  const bmp = await runMagick(
    ['png:-', '-dither', 'FloydSteinberg', '-posterize', '2', '-depth', '5,6,5', 'bmp3:-'],
    preprocessed
  );

  return bmp;
}

export const ImageConstants = { TARGET_WIDTH, TARGET_HEIGHT, TARGET_ASPECT } as const;


