import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { HealthResponse } from 'india-learns-shared-types';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { initSentry } from './config/sentry.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFound } from './middleware/error.js';
import { v1Router } from './routes/index.js';

export function createApp(): Express {
  const env = loadEnv();
  initSentry();
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ requestId: req.requestId }),
    }),
  );
  app.use(
    express.json({
      limit: '1mb',
      // Capture the raw body so requireJobAuth can verify HMAC over the exact
      // bytes the client signed. Parsed body is still available via req.body.
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(cookieParser());

  const healthHandler = (_req: Request, res: Response<HealthResponse>): void => {
    res.json({
      ok: true,
      commit: env.GIT_SHA,
      uptimeSec: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    });
  };
  app.get('/health', healthHandler);
  // M9 — Render's default health probe path; also serves as the public liveness
  // endpoint for BetterStack / UptimeRobot per Runbook §7.
  app.get('/healthz', healthHandler);

  app.use('/v1', v1Router());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
