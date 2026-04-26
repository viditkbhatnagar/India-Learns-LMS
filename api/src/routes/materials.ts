import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getMaterialForStaff,
  toMaterialDetailDto,
} from '../services/materialService.js';

const STAFF_ROLES = ['faculty', 'admin', 'superadmin'] as const;

/** Mounted at /v1/materials. */
export function materialsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole(...STAFF_ROLES));

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const material = await getMaterialForStaff(req.auth!, req.params.id ?? '');
      res.json({ data: { material: toMaterialDetailDto(material) } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
