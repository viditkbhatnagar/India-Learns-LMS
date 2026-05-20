import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { registerCertificateListener } from './services/certificateService.js';
import { recoverStrandedSessions } from './services/sessionService.js';
import { initSocketServer } from './chat/socketServer.js';

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDb();
  // M8 — wire `course.completed` → certificate issuance before the server
  // starts accepting requests so race conditions at boot don't drop events.
  registerCertificateListener();
  // Phase B-2 — recover any sessions stranded mid-reorder by a previous
  // crash. Cheap: counts the parking range and bails fast when empty.
  // Failure must NOT block boot.
  try {
    const r = await recoverStrandedSessions();
    if (r.sessionsRecovered > 0) {
      logger.warn(r, 'session.reorder.recovery — orphans repaired on boot');
    }
  } catch (err) {
    logger.error({ err }, 'session.reorder.recovery failed — booting anyway');
  }
  const app = createApp();

  // M10m — Use an explicit http.Server so Socket.IO can attach to the
  // same listener as Express. Express alone exposes `app.listen()` which
  // returns a Server, but Socket.IO is happier when you pass it the
  // server reference up-front.
  const server = createServer(app);
  initSocketServer(server);
  server.listen(env.PORT, () => {
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
