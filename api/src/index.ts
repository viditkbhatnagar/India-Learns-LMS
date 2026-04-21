import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDb();
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
