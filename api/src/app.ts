import path from 'node:path';
import { existsSync } from 'node:fs';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
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
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // In single-service prod this same process serves the SPA (see the
          // web/dist static block below), so this CSP governs the app HTML.
          // The Showcase viewer embeds brochure PDFs via <iframe src="blob:…">;
          // the blob: scheme is NOT covered by the default `default-src 'self'`
          // fallback, so allow same-origin + blob frames explicitly. Everything
          // else stays at helmet's secure defaults.
          'frame-src': ["'self'", 'blob:'],
        },
      },
    }),
  );
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

  // Kill-switch service worker. Served from the server (never from vite build)
  // so it takes priority over any previously-registered workbox SW. When an
  // older SW performs its routine update check it will fetch this path (that
  // fetch bypasses the old SW's fetch handler by browser spec), see a new SW
  // script, install + activate it. The new SW unregisters itself and forces
  // all open clients to reload → next load is SW-free. This rescues users
  // stuck on a stale "You're offline" cached precache from an earlier deploy.
  const killSwitchSw = `// India Learns — SW kill-switch. Unregisters + reloads all clients.
self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      if (self.caches && self.caches.keys) {
        const keys = await self.caches.keys();
        await Promise.all(keys.map((k) => self.caches.delete(k)));
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (_) {}
      }
    } catch (_) {}
  })());
});
`;
  app.get('/sw.js', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
    res.status(200).send(killSwitchSw);
  });

  // Optional single-service mode: same Node process also serves the built web
  // app from `web/dist`. Enabled when SERVE_WEB_FROM is set OR the default
  // `./web/dist` path exists relative to the process cwd. Render single-
  // service deploys run from the repo root, so the default resolves correctly
  // without extra configuration.
  const webDistPath = env.SERVE_WEB_FROM
    ? path.resolve(env.SERVE_WEB_FROM)
    : path.resolve(process.cwd(), 'web', 'dist');
  if (existsSync(path.join(webDistPath, 'index.html'))) {
    logger.info({ webDistPath }, 'serving web app from same origin');
    app.use(
      express.static(webDistPath, {
        // index.html is served via the SPA fallback below (never cached); every
        // other asset is content-hashed by Vite so cache aggressively.
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (/\/assets\//.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    // SPA fallback: any non-API GET that didn't hit a static file returns
    // index.html so React Router can handle the route client-side.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') {
        next();
        return;
      }
      if (req.path.startsWith('/v1') || req.path.startsWith('/health')) {
        next();
        return;
      }
      res.sendFile(path.join(webDistPath, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
