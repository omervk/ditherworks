import { FastifyInstance } from 'fastify';
import { subscribe } from '../lib/progress';

export async function registerProgressRoute(app: FastifyInstance) {
  app.get('/api/progress/:jobId', async (req, reply) => {
    const jobId = (req.params as { jobId: string }).jobId;
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    // Establish subscription
    const cleanup = subscribe(jobId, reply.raw);

    // Flush headers and a comment to open the stream
    try { reply.raw.write(': connected\n\n'); } catch {}

    // Clean up when client disconnects
    reply.raw.on('close', () => {
      cleanup();
    });

    return reply; // keep the stream open
  });
}


