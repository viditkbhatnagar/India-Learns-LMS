import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { HealthResponse } from 'india-learns-shared-types';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFound } from './middleware/error.js';
import { v1Router } from './routes/index.js';

export function createApp(): Express {
  const env = loadEnv();
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
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req: Request, res: Response<HealthResponse>) => {
    res.json({
      ok: true,
      commit: env.GIT_SHA,
      uptimeSec: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    });
  });

  app.use('/v1', v1Router());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
