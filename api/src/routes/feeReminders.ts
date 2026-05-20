import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { sendManualReminder } from '../services/feeReminderService.js';

export function feeRemindersRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/reminders/send/:installmentId',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await sendManualReminder(req.params.installmentId ?? '');
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
