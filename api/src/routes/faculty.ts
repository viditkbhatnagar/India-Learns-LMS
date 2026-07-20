import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createFacultyAccount,
  listFacultyAccounts,
  resetFacultyPassword,
  toFacultyAccountDto,
} from '../services/facultyAccountService.js';

// Admin faculty-account management. Admin/superadmin create faculty logins
// with an auto-generated, persisted (encrypted) password shown back in the
// admin table. Staff-only throughout.

const phoneE164Schema = z
  .string()
  .transform((s) => s.replace(/[\s()-]/g, ''))
  .refine((s) => /^\+\d{6,15}$/.test(s), {
    message: 'Enter a valid phone in E.164 format, e.g. +919812345678.',
  });

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  phoneE164: phoneE164Schema,
});

function actorCtx(req: Request) {
  return {
    role: req.auth!.role,
    actorUserId: req.auth!.userId,
    ip: req.ip ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function facultyRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admin', 'superadmin'));

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await listFacultyAccounts(actorCtx(req));
      res.status(200).json({ data: { items } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateBody.parse(req.body);
      const { user, temporaryPassword } = await createFacultyAccount(body, actorCtx(req));
      res.status(201).json({
        data: {
          faculty: toFacultyAccountDto(user, temporaryPassword, 0),
          temporaryPassword,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { temporaryPassword } = await resetFacultyPassword(req.params.id ?? '', actorCtx(req));
      res.status(200).json({ data: { temporaryPassword } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
