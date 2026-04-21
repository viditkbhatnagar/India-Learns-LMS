import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  acceptInvite,
  changePassword,
  confirmPasswordReset,
  login,
  logout,
  refresh,
  requestPasswordReset,
} from '../services/authService.js';
import { buildLoginLimiter, buildPasswordResetLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import {
  REFRESH_COOKIE_NAME,
  clearedRefreshCookieOptions,
  refreshCookieOptions,
} from '../utils/cookies.js';

const LoginBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
  deviceId: z.string().min(1).max(128),
});

const AcceptInviteBody = z.object({
  token: z.string().min(1),
  password: z.string().min(1).max(256),
  deviceId: z.string().min(1).max(128),
});

const ResetRequestBody = z.object({
  email: z.string().email().max(254),
});

const ResetConfirmBody = z.object({
  token: z.string().min(1),
  password: z.string().min(1).max(256),
});

const PasswordChangeBody = z.object({
  current: z.string().min(1).max(256),
  next: z.string().min(1).max(256),
});

const RefreshBody = z
  .object({
    deviceId: z.string().min(1).max(128).optional(),
  })
  .default({});

function ctx(req: Request): { ip: string; ua: string; deviceId: string } {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
    deviceId: typeof req.body?.deviceId === 'string' ? req.body.deviceId : '',
  };
}

export function authRouter(): Router {
  const router = Router();

  router.post(
    '/login',
    buildLoginLimiter(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = LoginBody.parse(req.body);
        const pair = await login(body.email, body.password, {
          ...ctx(req),
          deviceId: body.deviceId,
        });
        res.cookie(REFRESH_COOKIE_NAME, pair.refreshToken, refreshCookieOptions());
        res.status(200).json({ data: pair.response });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/invite/accept',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = AcceptInviteBody.parse(req.body);
        const pair = await acceptInvite(body.token, body.password, {
          ...ctx(req),
          deviceId: body.deviceId,
        });
        res.cookie(REFRESH_COOKIE_NAME, pair.refreshToken, refreshCookieOptions());
        res.status(200).json({ data: pair.response });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/refresh',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = RefreshBody.parse(req.body ?? {});
        const presented = req.cookies?.[REFRESH_COOKIE_NAME];
        const pair = await refresh(presented ?? '', {
          ...ctx(req),
          deviceId: body.deviceId ?? ctx(req).deviceId,
        });
        res.cookie(REFRESH_COOKIE_NAME, pair.refreshToken, refreshCookieOptions());
        res.status(200).json({ data: pair.response });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/logout',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const presented = req.cookies?.[REFRESH_COOKIE_NAME];
        await logout(presented, req.auth?.user ?? null, {
          ...ctx(req),
          deviceId: '',
        });
        res.cookie(REFRESH_COOKIE_NAME, '', clearedRefreshCookieOptions());
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/password/reset/request',
    buildPasswordResetLimiter(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = ResetRequestBody.parse(req.body);
        await requestPasswordReset(body.email, {
          ip: ctx(req).ip,
          ua: ctx(req).ua,
        });
        res.status(202).json({ data: { ok: true } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/password/reset/confirm',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = ResetConfirmBody.parse(req.body);
        await confirmPasswordReset(body.token, body.password, {
          ...ctx(req),
          deviceId: '',
        });
        res.status(200).json({ data: { ok: true } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/password/change',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = PasswordChangeBody.parse(req.body);
        await changePassword(req.auth!.user, body.current, body.next, {
          ...ctx(req),
          deviceId: '',
        });
        res.cookie(REFRESH_COOKIE_NAME, '', clearedRefreshCookieOptions());
        res.status(200).json({ data: { ok: true } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
