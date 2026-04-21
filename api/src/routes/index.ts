import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';

export function v1Router(): Router {
  const router = Router();
  router.use('/auth', authRouter());
  router.use('/users', usersRouter());
  return router;
}
