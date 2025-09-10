import { FastifyInstance } from 'fastify';
import archiver from 'archiver';
import pLimit from 'p-limit';
import { convertToBmp565WithDither } from '../lib/image';

// Note: p-limit is not installed; implement a minimal concurrency limiter inline
function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    const fn = queue.shift();
    if (fn) fn();
  };
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      const res = await fn();
      return res;
    } finally {
      next();
    }
  };
}

export async function registerConvertRoute(app: FastifyInstance) {
  app.post('/api/convert', async (req, reply) => {
    const parts = req.parts();

    type Manifest = { images: Array<{ fileName: string; y: number }> };
    const files: Record<string, Buffer> = {};
    let manifestObj: Manifest | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'files') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(Buffer.from(chunk));
        files[part.filename] = Buffer.concat(chunks);
      } else if (part.type === 'field' && part.fieldname === 'manifest') {
        try {
          manifestObj = JSON.parse(part.value as string) as Manifest;
        } catch {
          return reply.code(400).send({ error: 'invalid manifest JSON' });
        }
      }
    }

    if (!manifestObj) return reply.code(400).send({ error: 'manifest is required' });
    if (!manifestObj.images || !Array.isArray(manifestObj.images) || manifestObj.images.length === 0) {
      return reply.code(400).send({ error: 'manifest.images must be a non-empty array' });
    }

    // Validate manifest matches uploaded files
    for (const img of manifestObj.images) {
      if (typeof img.fileName !== 'string' || typeof img.y !== 'number') {
        return reply.code(400).send({ error: 'invalid manifest entry' });
      }
      if (!(img.fileName in files)) {
        return reply.code(400).send({ error: `missing file for ${img.fileName}` });
      }
    }

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', 'attachment; filename="converted.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('warning', (err: unknown) => req.log.warn({ err }, 'zip warning'));
    archive.on('error', (err: unknown) => {
      req.log.error({ err }, 'zip error');
      try { archive.destroy(); } catch {}
      if (!reply.sent) {
        // If streaming hasn't started, return JSON error
        reply.code(500).type('application/json').send({ error: 'zip error' });
      } else {
        // If streaming already started, just destroy the connection
        try { reply.raw.destroy(err as Error); } catch {}
      }
    });

    // Pipe archive to reply
    archive.pipe(reply.raw);

    const limit = createLimiter(2);

    // Process each image sequentially or with limited concurrency
    const tasks = manifestObj.images.map((img) =>
      limit(async () => {
        const input = files[img.fileName];
        try {
          const bmp = await convertToBmp565WithDither(input, img.y);
          const base = img.fileName.replace(/\.[^/.]+$/, '');
          const outName = `${base}_800x480.bmp`;
          archive.append(bmp, { name: outName });
        } catch (err) {
          req.log.error({ err, file: img.fileName }, 'failed to convert image');
          throw err;
        }
      })
    );

    try {
      await Promise.all(tasks);
      await archive.finalize();
    } catch (err) {
      req.log.error({ err }, 'convert failed');
      try { archive.destroy(); } catch {}
      if (!reply.sent) {
        return reply
          .code(500)
          .type('application/json')
          .send({ error: 'conversion failed' });
      }
      // If already streaming, ensure the socket is closed
      try { reply.raw.destroy(err as Error); } catch {}
      return; // do not return reply instance
    }

    return; // stream handled; do not return reply instance
  });
}
