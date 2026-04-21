import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class HttpError extends Error {
  status: number;

  code: string;

  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } } satisfies ErrorEnvelope);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    } satisfies ErrorEnvelope);
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected error';
  logger.error({ err, requestId: req.requestId }, 'unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error', details: { hint: message } },
  } satisfies ErrorEnvelope);
}
