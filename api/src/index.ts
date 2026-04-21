import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { registerCertificateListener } from './services/certificateService.js';

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDb();
  // M8 — wire `course.completed` → certificate issuance before the server
  // starts accepting requests so race conditions at boot don't drop events.
  registerCertificateListener();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, commit: env.GIT_SHA }, 'il-api listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    server.close(() => logger.info('http server closed'));
    await disconnectDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((err) => logger.error({ err }, 'shutdown failed'));
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((err) => logger.error({ err }, 'shutdown failed'));
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
