import type { DomainEventType } from 'india-learns-shared-types';
import { DomainEvent, type HydratedDomainEvent } from '../models/index.js';
import { logger } from '../config/logger.js';
import { nowUtc } from './clockService.js';

// Minimal domain-event plumbing. We persist every publish to `DomainEvent` so
// consumers can be added in later milestones (M8 Certifier.io) without racing
// against the writing path. In-process listeners registered via
// `registerListener` are invoked best-effort and never block the publisher —
// if a listener throws, the event still ends up persisted and a later cron
// (M8) can sweep unconsumed rows.

type Listener = (
  payload: Record<string, unknown>,
  event: HydratedDomainEvent,
) => Promise<void> | void;

const LISTENERS: Record<DomainEventType, Listener[]> = {
  'course.completed': [],
  'certificate.issued': [],
};

export function registerListener(type: DomainEventType, fn: Listener): void {
  LISTENERS[type].push(fn);
}

export function clearListeners(type?: DomainEventType): void {
  if (type) {
    LISTENERS[type] = [];
    return;
  }
  (Object.keys(LISTENERS) as DomainEventType[]).forEach((t) => {
    LISTENERS[t] = [];
  });
}

export async function publishDomainEvent(
  type: DomainEventType,
  payload: Record<string, unknown>,
): Promise<HydratedDomainEvent> {
  const event = await DomainEvent.create({
    type,
    payload,
    publishedAt: nowUtc(),
    consumedAt: null,
    consumerError: null,
  });
  for (const listener of LISTENERS[type]) {
    try {
      await listener(payload, event);
    } catch (err) {
      logger.warn({ err, type, eventId: event._id.toString() }, 'domain_event.listener_failed');
    }
  }
  return event;
}

export async function markConsumed(eventId: string): Promise<void> {
  await DomainEvent.updateOne(
    { _id: eventId, consumedAt: null },
    { $set: { consumedAt: nowUtc(), consumerError: null } },
  );
}
