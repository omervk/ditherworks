import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { registerSuggestRoute } from './routes/suggest';
import { registerConvertRoute } from './routes/convert';

const PORT = 8787;
const HOST = '127.0.0.1';

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  // Only enable CORS if not using Vite proxy; safe local defaults
  if (process.env.ENABLE_CORS === '1') {
    await app.register(cors, { origin: false });
  }

  await app.register(multipart, {
    limits: {
      files: 200,
      fileSize: 30 * 1024 * 1024,
    },
  });

  // Health endpoint
  app.get('/api/health', async () => {
    return { status: 'ok' } as const;
  });

  await registerSuggestRoute(app);
  await registerConvertRoute(app);

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export type AppInstance = Awaited<ReturnType<typeof buildServer>>;
export { buildServer };


