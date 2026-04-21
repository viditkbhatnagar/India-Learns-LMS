import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
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

interface MongoDuplicateError {
  code: number;
  keyValue?: Record<string, unknown>;
}

function isMongoDuplicate(err: unknown): err is MongoDuplicateError {
  return Boolean(
    err
      && typeof err === 'object'
      && 'code' in err
      && (err as { code: unknown }).code === 11000,
  );
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

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request failed validation.',
        details: err.flatten(),
      },
    } satisfies ErrorEnvelope);
    return;
  }

  if (isMongoDuplicate(err)) {
    const keys = Object.keys(err.keyValue ?? {});
    let code = 'CONFLICT';
    let message = 'Duplicate value.';
    if (keys.includes('email')) {
      code = 'USER_EXISTS';
      message = 'A user with this email already exists.';
    } else if (keys.includes('slug')) {
      code = 'SLUG_EXISTS';
      message = 'A record with this slug already exists.';
    } else if (keys.includes('studentId') && keys.includes('courseId')) {
      code = 'ENROLLMENT_DUPLICATE';
      message = 'Student already has an active enrolment for this course.';
    }
    res.status(409).json({
      error: { code, message, details: err.keyValue },
    } satisfies ErrorEnvelope);
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected error';
  logger.error({ err, requestId: req.requestId }, 'unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error', details: { hint: message } },
  } satisfies ErrorEnvelope);
}
