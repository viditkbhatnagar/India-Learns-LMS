import type { Types } from 'mongoose';
import type { SlaTimersJobResult } from 'india-learns-shared-types';
import { Ticket } from '../models/index.js';
import { recordAudit } from './auditService.js';
import { nowUtc } from './clockService.js';
import { enqueueNotification } from './notificationService.js';
import { findAdminRecipientsForBreach } from './ticketRoutingService.js';

// Cron scans open/assigned/in_progress tickets and flips the two breach flags
// at most once each. The atomic guard on `slaAckBreached: false` (or
// `slaResolveBreached: false`) ensures idempotency across parallel cron
// invocations and repeat runs after a test time-travel.

const ACTIVE_STATES = ['open', 'assigned', 'in_progress'] as const;

async function notifyBreach(
  kind: 'ack' | 'resolve',
  ticketId: Types.ObjectId,
  code: string,
  assigneeUserId: Types.ObjectId | null,
): Promise<void> {
  const adminIds = await findAdminRecipientsForBreach();
  const recipients = new Map<string, Types.ObjectId>();
  adminIds.forEach((id) => recipients.set(id.toString(), id));
  if (assigneeUserId) recipients.set(assigneeUserId.toString(), assigneeUserId);
  const list = Array.from(recipients.values());
  if (list.length === 0) return;
  const type = kind === 'ack'
    ? 'ticket.sla_ack_breached'
    : 'ticket.sla_resolve_breached';
  const label = kind === 'ack' ? 'acknowledgement' : 'resolution';
  await enqueueNotification({
    type,
    recipients: list,
    title: `SLA breach (${label}) — ${code}`,
    body: `Ticket ${code} has breached its ${label} SLA.`,
    data: {
      ticketId: ticketId.toString(),
      ticketCode: code,
      kind,
    },
  });
}

export async function computeBreaches(
  now: Date = nowUtc(),
): Promise<SlaTimersJobResult> {
  const result: SlaTimersJobResult = {
    processed: 0,
    ackBreached: 0,
    resolveBreached: 0,
    skipped: 0,
    errors: [],
  };

  const candidates = await Ticket.find({
    state: { $in: ACTIVE_STATES },
    $or: [
      { slaAckBreached: false, slaAckDeadline: { $lt: now } },
      { slaResolveBreached: false, slaResolveDeadline: { $lt: now } },
    ],
  });

  for (const ticket of candidates) {
    result.processed += 1;
    const ticketId = ticket._id;
    const { code } = ticket;
    try {
      // Acknowledgement breach: the student has had nobody engage yet AND the
      // 24h deadline has passed. Once `firstAckAt` is set, subsequent runs are
      // no-ops (the filter below requires it to still be null).
      if (!ticket.slaAckBreached && ticket.slaAckDeadline < now && !ticket.firstAckAt) {
        const flipped = await Ticket.updateOne(
          { _id: ticketId, slaAckBreached: false, firstAckAt: null },
          { $set: { slaAckBreached: true, slaAckBreachedAt: now } },
        );
        if (flipped.modifiedCount > 0) {
          result.ackBreached += 1;
          await recordAudit({
            actorUserId: null,
            action: 'ticket.sla_ack_breached',
            targetType: 'Ticket',
            targetId: ticketId,
            details: { ticketCode: code, deadline: ticket.slaAckDeadline.toISOString() },
          });
          await notifyBreach('ack', ticketId, code, ticket.assigneeUserId);
        }
      }

      if (!ticket.slaResolveBreached && ticket.slaResolveDeadline < now) {
        const flipped = await Ticket.updateOne(
          { _id: ticketId, slaResolveBreached: false },
          { $set: { slaResolveBreached: true, slaResolveBreachedAt: now } },
        );
        if (flipped.modifiedCount > 0) {
          result.resolveBreached += 1;
          await recordAudit({
            actorUserId: null,
            action: 'ticket.sla_resolve_breached',
            targetType: 'Ticket',
            targetId: ticketId,
            details: {
              ticketCode: code,
              deadline: ticket.slaResolveDeadline.toISOString(),
            },
          });
          await notifyBreach('resolve', ticketId, code, ticket.assigneeUserId);
        }
      }

      if (
        ticket.slaAckBreached
        && ticket.slaResolveBreached
        && !result.ackBreached
        && !result.resolveBreached
      ) {
        result.skipped += 1;
      }
    } catch (err) {
      result.errors.push({
        ticketId: ticketId.toString(),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
