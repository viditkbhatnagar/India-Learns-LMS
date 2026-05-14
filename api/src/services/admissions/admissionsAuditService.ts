import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import type {
  AdmissionsAuditAction,
  AdmissionsAuditChainDto,
  AdmissionsAuditChainEntryDto,
} from 'india-learns-shared-types';
import {
  AdmissionsAuditLog,
  type HydratedAdmissionsAuditLog,
} from '../../models/index.js';

// M5 — Tamper-evident audit append + verify (D-A4).
//
// Append-only at the service layer: only `appendAdmissionsAudit` writes to
// `admissionsAuditLogs`. No update/delete is exposed. Each row's `chainHash`
// is sha256(prevHash + canonicalJson(row body)), where row body is the
// concrete fields (applicationId, actorUserId, action, details, at). The
// chain is verifiable end-to-end by re-computing — see `verifyAuditChain`.

export interface AppendAuditInput {
  applicationId: Types.ObjectId | null;
  actorUserId: Types.ObjectId | null;
  action: AdmissionsAuditAction;
  details?: Record<string, unknown> | null;
  at?: Date;
}

function canonicalJson(value: Record<string, unknown>): string {
  // Sort keys for deterministic stringification — JSON.stringify is order-
  // preserving but not order-deterministic across insertion paths.
  const keys = Object.keys(value).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = value[k];
  return JSON.stringify(ordered);
}

export function computeChainHash(
  prevHash: string | null,
  body: {
    applicationId: string | null;
    actorUserId: string | null;
    action: string;
    details: Record<string, unknown> | null;
    at: string;
  },
): string {
  const payload = canonicalJson({
    prevHash,
    body: canonicalJson(body as unknown as Record<string, unknown>),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function appendAdmissionsAudit(
  input: AppendAuditInput,
): Promise<HydratedAdmissionsAuditLog> {
  // Walk forward by always reading the latest row at write time. Race risk
  // is low (admissions writes are infrequent) but if two writes interleave
  // they'll both reference the same prevHash and one will fail the unique
  // chainHash index — the caller can retry. M9 hardening will add a more
  // robust optimistic-locking loop.
  const last = await AdmissionsAuditLog.findOne({}).sort({ at: -1, _id: -1 });
  const prevHash = last?.chainHash ?? null;
  const at = input.at ?? new Date();
  const body = {
    applicationId: input.applicationId ? input.applicationId.toString() : null,
    actorUserId: input.actorUserId ? input.actorUserId.toString() : null,
    action: input.action,
    details: input.details ?? null,
    at: at.toISOString(),
  };
  const chainHash = computeChainHash(prevHash, body);
  return AdmissionsAuditLog.create({
    applicationId: input.applicationId,
    actorUserId: input.actorUserId,
    action: input.action,
    details: input.details ?? null,
    at,
    prevHash,
    chainHash,
  });
}

export async function verifyAuditChain(
  applicationId: Types.ObjectId | null,
): Promise<AdmissionsAuditChainDto> {
  const filter = applicationId ? { applicationId } : {};
  const rows = await AdmissionsAuditLog.find(filter).sort({ at: 1, _id: 1 });
  let expectedPrev: string | null = applicationId ? null : null;
  let verified = true;
  let brokenAt: string | null = null;
  const entries: AdmissionsAuditChainEntryDto[] = [];
  // When filtering by application, the prev hash continuity check is local
  // (first row's prevHash may be anything pre-existing in the global chain).
  // We still verify each row's chainHash matches its own body and prevHash.
  for (const r of rows) {
    const body = {
      applicationId: r.applicationId ? r.applicationId.toString() : null,
      actorUserId: r.actorUserId ? r.actorUserId.toString() : null,
      action: r.action,
      details: r.details ?? null,
      at: r.at.toISOString(),
    };
    const recomputed = computeChainHash(r.prevHash, body);
    if (recomputed !== r.chainHash) {
      verified = false;
      brokenAt = r.at.toISOString();
      break;
    }
    if (expectedPrev !== null && r.prevHash !== expectedPrev) {
      // Application-scoped views won't have continuous prevHash between
      // rows; we only enforce continuity in the global view (when
      // applicationId is null and rows are sequential in time).
      if (!applicationId) {
        verified = false;
        brokenAt = r.at.toISOString();
        break;
      }
    }
    expectedPrev = r.chainHash;
    entries.push({
      id: String(r._id),
      applicationId: r.applicationId ? r.applicationId.toString() : null,
      actorUserId: r.actorUserId ? r.actorUserId.toString() : null,
      action: r.action,
      details: (r.details as Record<string, unknown> | null) ?? null,
      at: r.at.toISOString(),
      prevHash: r.prevHash,
      chainHash: r.chainHash,
    });
  }
  const head = entries.length > 0 ? entries[entries.length - 1]!.chainHash : '';
  return { entries, headHash: head, verified, brokenAt };
}

export async function headHash(): Promise<string | null> {
  const last = await AdmissionsAuditLog.findOne({}).sort({ at: -1, _id: -1 });
  return last?.chainHash ?? null;
}
