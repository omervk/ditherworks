import { FastifyInstance } from 'fastify';

export async function registerSuggestRoute(app: FastifyInstance) {
  app.post('/api/suggest-crop', async (req, reply) => {
    const mp = await req.file();
    if (!mp) {
      return reply.code(400).send({ error: 'image file is required' });
    }
    // For initial implementation, always return y=0 with natural dimensions
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of mp.file) chunks.push(Buffer.from(chunk));
      const buf = Buffer.concat(chunks);

      // Use Web-like Image parsing is non-trivial; rely on sharp metadata for dimensions
      // Delay importing sharp until needed
      const { default: sharp } = await import('sharp');
      const meta = await sharp(buf, { failOn: 'none' }).rotate().metadata();
      if (!meta.width || !meta.height) {
        return reply.code(415).send({ error: 'unsupported or unreadable image' });
      }
      return reply.send({ y: 0, naturalWidth: meta.width, naturalHeight: meta.height });
    } catch (err) {
      req.log.error({ err }, 'failed to suggest crop');
      return reply.code(500).send({ error: 'failed to process image' });
    }
  });
}


