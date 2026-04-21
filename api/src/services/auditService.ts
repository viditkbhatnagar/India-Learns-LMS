import { Types } from 'mongoose';
import type { AuditAction } from 'india-learns-shared-types';
import { AuditLog } from '../models/index.js';
import { logger } from '../config/logger.js';

const SCRUB_FIELDS = new Set([
  'passwordHash',
  'passwordHistoryHashes',
  'loginFailCount',
  'lockedUntil',
]);

export function scrubUser(
  user: unknown,
): Record<string, unknown> | null {
  if (!user || typeof user !== 'object') return null;
  const output: Record<string, unknown> = {};
  Object.entries(user as Record<string, unknown>).forEach(([k, v]) => {
    if (SCRUB_FIELDS.has(k) || k === '__v') return;
    if (k === '_id' && v instanceof Types.ObjectId) {
      output.id = v.toString();
      return;
    }
    output[k] = v;
  });
  return output;
}

export interface AuditInput {
  actorUserId: Types.ObjectId | null;
  action: AuditAction;
  targetType: string;
  targetId: Types.ObjectId | null;
  before?: unknown;
  after?: unknown;
  details?: Record<string, unknown> | null;
  ip?: string;
  ua?: string;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before ?? null,
      after: input.after ?? null,
      details: input.details ?? null,
      ip: input.ip ?? '',
      ua: input.ua ?? '',
      at: new Date(),
    });
  } catch (err) {
    // Audit failures must never cascade into the request path — log loudly and
    // continue. The alternative (500 on login when AuditLog collection is
    // unreachable) is worse than a missing audit row.
    logger.error({ err, action: input.action }, 'audit.write_failed');
  }
}
