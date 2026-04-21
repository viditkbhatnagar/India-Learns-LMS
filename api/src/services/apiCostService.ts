import type { Types } from 'mongoose';
import type { ApiCostProvider } from 'india-learns-shared-types';
import { ApiCostLedger } from '../models/index.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';
import { nowUtc } from './clockService.js';

// M8 — PRD §15 cost tracking. One row per adapter call, with the paise rate
// snapshotted at write time so historical aggregates stay stable when rates
// are reconciled against real invoices (Q-M8-01). Writes are fire-and-forget:
// failure to record a cost row must NOT fail the underlying adapter call.

export interface RecordApiCostInput {
  provider: ApiCostProvider;
  operation: string;
  units?: number;
  refType?: string;
  refId?: Types.ObjectId | null;
}

function unitRate(provider: ApiCostProvider): number {
  const env = loadEnv();
  switch (provider) {
    case 'email':
      return env.EMAIL_UNIT_PAISE;
    case 'whatsapp':
      return env.WHATSAPP_UNIT_PAISE;
    case 'storage':
      return env.STORAGE_UNIT_PAISE;
    case 'certifier':
      return env.CERTIFIER_UNIT_PAISE;
    default:
      return 0;
  }
}

export async function recordApiCost(input: RecordApiCostInput): Promise<void> {
  try {
    await ApiCostLedger.create({
      provider: input.provider,
      operation: input.operation,
      units: input.units ?? 1,
      unitPaise: unitRate(input.provider),
      atUtc: nowUtc(),
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    });
  } catch (err) {
    logger.warn({ err, provider: input.provider, op: input.operation }, 'api_cost.record_failed');
  }
}
