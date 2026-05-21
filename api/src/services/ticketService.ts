import { Types } from 'mongoose';
import type {
  AddCommentInput,
  CreateTicketInput,
  TicketAttachmentDto,
  TicketCategory,
  TicketCommentDto,
  TicketCommentVisibility,
  TicketDetailDto,
  TicketDto,
  TicketListQuery,
  TicketPriority,
  TicketState,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Ticket,
  TicketComment,
  type HydratedTicket,
  type HydratedTicketComment,
} from '../models/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { recordAudit } from './auditService.js';
import { nowUtc } from './clockService.js';
import { nextTicketCode } from './counterService.js';
import { enqueueNotification } from './notificationService.js';
import { renderTemplate } from './notificationTemplates.js';
import { routeTicket } from './ticketRoutingService.js';
import { addBusinessDaysWithLoad } from './businessDayService.js';

const DAY_MS = 86_400_000;
const ACK_SLA_MS = 24 * 60 * 60 * 1000;
const STANDARD_RESOLVE_DAYS = 5; // calendar days for non-complaints
const COMPLAINT_RESOLVE_BD = 15; // business days for complaints
const REOPEN_WINDOW_MS = 7 * DAY_MS;

// M10r — `finance` role removed; staff = admin / superadmin / faculty.
type StaffRole = 'admin' | 'superadmin' | 'faculty';
const STAFF_ROLES: ReadonlySet<StaffRole> = new Set(['admin', 'superadmin', 'faculty']);

export interface TicketCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

function isStaffRole(role: string): role is StaffRole {
  return STAFF_ROLES.has(role as StaffRole);
}

function serializeAttachment(a: TicketAttachmentDto): TicketAttachmentDto {
  return { url: a.url, name: a.name, size: a.size };
}

export function toTicketDto(doc: HydratedTicket): TicketDto {
  return {
    id: doc._id.toString(),
    code: doc.code,
    category: doc.category,
    priority: doc.priority,
    studentId: doc.studentId.toString(),
    linkedCourseId: doc.linkedCourseId ? doc.linkedCourseId.toString() : null,
    linkedInvoiceId: doc.linkedInvoiceId ? doc.linkedInvoiceId.toString() : null,
    subject: doc.subject,
    description: doc.description,
    state: doc.state,
    assigneeUserId: doc.assigneeUserId ? doc.assigneeUserId.toString() : null,
    coAssigneeUserIds: (doc.coAssigneeUserIds ?? []).map((id) => id.toString()),
    assignedAt: doc.assignedAt ? doc.assignedAt.toISOString() : null,
    firstAckAt: doc.firstAckAt ? doc.firstAckAt.toISOString() : null,
    resolvedAt: doc.resolvedAt ? doc.resolvedAt.toISOString() : null,
    resolutionNote: doc.resolutionNote ?? '',
    resolvedByUserId: doc.resolvedByUserId ? doc.resolvedByUserId.toString() : null,
    closedAt: doc.closedAt ? doc.closedAt.toISOString() : null,
    reopenedAt: doc.reopenedAt ? doc.reopenedAt.toISOString() : null,
    reopenedFromId: doc.reopenedFromId ? doc.reopenedFromId.toString() : null,
    parentTicketId: doc.parentTicketId ? doc.parentTicketId.toString() : null,
    slaAckDeadline: doc.slaAckDeadline.toISOString(),
    slaResolveDeadline: doc.slaResolveDeadline.toISOString(),
    slaAckBreached: doc.slaAckBreached,
    slaResolveBreached: doc.slaResolveBreached,
    slaAckBreachedAt: doc.slaAckBreachedAt ? doc.slaAckBreachedAt.toISOString() : null,
    slaResolveBreachedAt: doc.slaResolveBreachedAt ? doc.slaResolveBreachedAt.toISOString() : null,
    attachments: doc.attachments.map(serializeAttachment),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toTicketCommentDto(doc: HydratedTicketComment): TicketCommentDto {
  return {
    id: doc._id.toString(),
    ticketId: doc.ticketId.toString(),
    authorUserId: doc.authorUserId.toString(),
    body: doc.body,
    visibility: doc.visibility,
    attachments: doc.attachments.map(serializeAttachment),
    createdAt: doc.createdAt.toISOString(),
  };
}

async function computeResolveDeadline(
  category: TicketCategory,
  from: Date,
): Promise<Date> {
  if (category === 'complaints') {
    return addBusinessDaysWithLoad(from, COMPLAINT_RESOLVE_BD);
  }
  return new Date(from.getTime() + STANDARD_RESOLVE_DAYS * DAY_MS);
}

async function countPriorClosedTickets(
  studentId: Types.ObjectId,
): Promise<number> {
  return Ticket.countDocuments({
    studentId,
    state: { $in: ['resolved', 'closed'] },
  });
}

export async function createTicket(
  actor: AuthContext,
  input: CreateTicketInput,
  ctx: TicketCtx,
): Promise<HydratedTicket> {
  if (actor.role !== 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Only students may raise tickets.');
  }
  const subject = (input.subject ?? '').trim();
  const description = (input.description ?? '').trim();
  if (!subject) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'subject is required.');
  }
  if (!description) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'description is required.');
  }

  const studentId = actor.userId;

  // D-008 / PRD §10.3: Complaint may only be raised after a prior resolved or
  // closed ticket exists for this student (escalation-only).
  if (input.category === 'complaints') {
    const prior = await countPriorClosedTickets(studentId);
    if (prior === 0) {
      throw new HttpError(
        409,
        'COMPLAINT_PRECONDITION_UNMET',
        'A Complaint ticket requires a prior resolved or closed ticket from another category.',
      );
    }
  }

  const linkedCourseId = input.linkedCourseId
    ? new Types.ObjectId(input.linkedCourseId)
    : null;
  const linkedInvoiceId = input.linkedInvoiceId
    ? new Types.ObjectId(input.linkedInvoiceId)
    : null;

  const priority: TicketPriority = input.priority
    ?? (input.category === 'complaints' ? 'urgent' : 'medium');

  const now = nowUtc();
  const slaAckDeadline = new Date(now.getTime() + ACK_SLA_MS);
  const slaResolveDeadline = await computeResolveDeadline(input.category, now);

  const code = await nextTicketCode(input.category, now.getUTCFullYear());

  const routing = await routeTicket({
    category: input.category,
    linkedCourseId,
  });

  const ticket = await Ticket.create({
    code,
    category: input.category,
    priority,
    studentId,
    linkedCourseId,
    linkedInvoiceId,
    subject,
    description,
    state: routing.assigneeUserId ? 'assigned' : 'open',
    assigneeUserId: routing.assigneeUserId,
    assignedAt: routing.assigneeUserId ? now : null,
    slaAckDeadline,
    slaResolveDeadline,
    slaAckBreached: false,
    slaResolveBreached: false,
    attachments: input.attachments ?? [],
  });

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'ticket.created',
    targetType: 'Ticket',
    targetId: ticket._id,
    after: ticket.toJSON(),
    details: {
      category: ticket.category,
      code: ticket.code,
      assigneeUserId: ticket.assigneeUserId?.toString() ?? null,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  if (routing.assigneeUserId) {
    await recordAudit({
      actorUserId: ctx.actorUserId,
      action: 'ticket.assigned',
      targetType: 'Ticket',
      targetId: ticket._id,
      details: {
        assigneeUserId: routing.assigneeUserId.toString(),
        category: ticket.category,
      },
      ip: ctx.ip,
      ua: ctx.ua,
    });
  }

  // Assignee + (for complaints) all superadmins get the creation alert.
  try {
    const notifyIds = routing.notifyUserIds.length > 0
      ? routing.notifyUserIds
      : [];
    if (notifyIds.length > 0) {
      const rendered = renderTemplate('ticket.created', {
        category: ticket.category,
        code: ticket.code,
        subject: ticket.subject,
        descriptionPreview: ticket.description.slice(0, 500),
      });
      await enqueueNotification({
        type: 'ticket.created',
        recipients: notifyIds,
        title: rendered.title,
        body: rendered.body,
        data: {
          ticketId: ticket._id.toString(),
          ticketCode: ticket.code,
          category: ticket.category,
          state: ticket.state,
        },
      });
    }
  } catch {
    // Notification failure never blocks ticket creation.
  }

  return ticket;
}

function illegalTransition(from: TicketState, to: TicketState): HttpError {
  return new HttpError(
    409,
    'TICKET_STATE_INVALID',
    `Illegal ticket transition: ${from} → ${to}.`,
  );
}

const ALLOWED_TRANSITIONS: Record<TicketState, readonly TicketState[]> = {
  open: ['assigned', 'in_progress'],
  assigned: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],
};

export async function transitionTicket(
  actor: AuthContext,
  ticketId: string,
  to: TicketState,
  note: string | undefined,
  ctx: TicketCtx,
): Promise<HydratedTicket> {
  if (!isStaffRole(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Only staff may transition tickets.');
  }
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  const from = ticket.state;
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw illegalTransition(from, to);
  }
  const before = ticket.toJSON();
  const now = nowUtc();
  ticket.state = to;
  if (to === 'assigned' && !ticket.assignedAt) {
    ticket.assignedAt = now;
    if (!ticket.assigneeUserId) ticket.assigneeUserId = actor.userId;
  }
  if (to === 'in_progress') {
    if ((from === 'resolved' || from === 'closed')) {
      const anchor = ticket.closedAt ?? ticket.resolvedAt;
      if (!anchor) {
        throw illegalTransition(from, to);
      }
      if (now.getTime() - anchor.getTime() > REOPEN_WINDOW_MS) {
        throw new HttpError(
          409,
          'REOPEN_WINDOW_EXPIRED',
          'Tickets can only be reopened within 7 days of resolution or closure.',
        );
      }
      ticket.reopenedAt = now;
      ticket.reopenedFromId = ticket._id;
      ticket.resolvedAt = null;
      ticket.resolvedByUserId = null;
      ticket.closedAt = null;
    }
  }
  if (to === 'resolved') {
    ticket.resolvedAt = now;
    ticket.resolvedByUserId = actor.userId;
    if (note) ticket.resolutionNote = note;
  }
  if (to === 'closed') {
    ticket.closedAt = now;
  }
  await ticket.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: from === to ? 'ticket.state_changed' : 'ticket.state_changed',
    targetType: 'Ticket',
    targetId: ticket._id,
    before,
    after: ticket.toJSON(),
    details: { from, to, note: note ?? null },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  // PRD §14.3: state change notifies the student (and loops in the assignee
  // on reopen). WhatsApp is via il_ticket_update.
  const recipients: Types.ObjectId[] = [ticket.studentId];
  if (ticket.assigneeUserId && !ticket.assigneeUserId.equals(ticket.studentId)) {
    recipients.push(ticket.assigneeUserId);
  }
  try {
    const rendered = renderTemplate('ticket.state_changed', {
      code: ticket.code,
      state: ticket.state,
      note: note && note.length > 0 ? `Status: ${ticket.state}\nNote: ${note}` : null,
    });
    await enqueueNotification({
      type: 'ticket.state_changed',
      recipients,
      title: rendered.title,
      body: rendered.body,
      data: {
        ticketId: ticket._id.toString(),
        ticketCode: ticket.code,
        state: ticket.state,
      },
    });
  } catch {
    // non-fatal
  }

  return ticket;
}

/**
 * Reassign a ticket. `newAssigneeId=null` unassigns the primary. Optional
 * `coAssigneeIds` array sets the additional people looped in alongside
 * the primary — SLA still counts against the primary but co-assignees
 * get every notification and can comment. Admin + superadmin only.
 */
export async function assignTicket(
  actor: AuthContext,
  ticketId: string,
  newAssigneeId: string | null,
  ctx: TicketCtx,
  coAssigneeIds?: string[],
): Promise<HydratedTicket> {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may reassign tickets.');
  }
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }

  const before = {
    assigneeUserId: ticket.assigneeUserId?.toString() ?? null,
    coAssigneeUserIds: (ticket.coAssigneeUserIds ?? []).map((i) => i.toString()),
    state: ticket.state,
  };

  const { User } = await import('../models/index.js');

  // Validate + resolve primary.
  if (newAssigneeId === null) {
    ticket.assigneeUserId = null;
    ticket.assignedAt = null;
  } else {
    if (!Types.ObjectId.isValid(newAssigneeId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'assigneeUserId is not a valid id.');
    }
    const assignee = await User.findById(newAssigneeId);
    if (!assignee) throw new HttpError(404, 'NOT_FOUND', 'Assignee not found.');
    if (!isStaffRole(assignee.role)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'Assignee must be admin, superadmin, or faculty.',
      );
    }
    ticket.assigneeUserId = assignee._id;
    ticket.assignedAt = nowUtc();
    if (ticket.state === 'open') ticket.state = 'assigned';
  }

  // Validate + resolve co-assignees (optional).
  if (coAssigneeIds !== undefined) {
    const unique = Array.from(
      new Set(coAssigneeIds.filter((id) => Types.ObjectId.isValid(id))),
    );
    const filtered = unique.filter((id) => id !== ticket.assigneeUserId?.toString());
    if (filtered.length > 0) {
      const coUsers = await User.find({
        _id: { $in: filtered.map((id) => new Types.ObjectId(id)) },
      }).select('_id role');
      for (const u of coUsers) {
        if (!isStaffRole(u.role)) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'Co-assignees must be staff (admin/superadmin/faculty).',
          );
        }
      }
      ticket.coAssigneeUserIds = coUsers.map((u) => u._id);
    } else {
      ticket.coAssigneeUserIds = [];
    }
  }

  await ticket.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'ticket.reassigned',
    targetType: 'Ticket',
    targetId: ticket._id,
    before,
    after: {
      assigneeUserId: ticket.assigneeUserId?.toString() ?? null,
      coAssigneeUserIds: ticket.coAssigneeUserIds.map((i) => i.toString()),
      state: ticket.state,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  // Notify everyone looped into the ticket.
  const recipients = [
    ...(ticket.assigneeUserId ? [ticket.assigneeUserId] : []),
    ...ticket.coAssigneeUserIds,
  ];
  if (recipients.length > 0) {
    try {
      const rendered = renderTemplate('ticket.assignment_updated', {
        code: ticket.code,
        subject: ticket.subject,
      });
      await enqueueNotification({
        type: 'ticket.assigned',
        recipients,
        title: rendered.title,
        body: rendered.body,
        data: { ticketId: ticket._id.toString(), ticketCode: ticket.code },
      });
    } catch {
      // non-fatal
    }
  }

  return ticket;
}

export async function reopenTicket(
  actor: AuthContext,
  ticketId: string,
  note: string | undefined,
  ctx: TicketCtx,
): Promise<HydratedTicket> {
  if (!isStaffRole(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Only staff may reopen tickets.');
  }
  const ticket = await transitionTicket(actor, ticketId, 'in_progress', note, ctx);
  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'ticket.reopened',
    targetType: 'Ticket',
    targetId: ticket._id,
    details: { note: note ?? null },
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return ticket;
}

export async function requestReopen(
  actor: AuthContext,
  ticketId: string,
  reason: string,
  ctx: TicketCtx,
): Promise<HydratedTicket> {
  if (actor.role !== 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Only students may request reopening.');
  }
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  const original = await Ticket.findById(ticketId);
  if (!original) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  if (!original.studentId.equals(actor.userId)) {
    throw new HttpError(403, 'FORBIDDEN', 'You can only reopen your own tickets.');
  }
  if (!['resolved', 'closed'].includes(original.state)) {
    throw new HttpError(
      409,
      'TICKET_STATE_INVALID',
      'Only resolved or closed tickets can be reopened.',
    );
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'reason is required.');
  }

  // PRD §10.2: student reopen becomes a new child ticket (spec-compliant vs
  // direct reopen). Inherits category + linked IDs from the parent.
  const now = nowUtc();
  const slaAckDeadline = new Date(now.getTime() + ACK_SLA_MS);
  const slaResolveDeadline = await computeResolveDeadline(original.category, now);
  const code = await nextTicketCode(original.category, now.getUTCFullYear());

  const routing = await routeTicket({
    category: original.category,
    linkedCourseId: original.linkedCourseId,
  });

  const child = await Ticket.create({
    code,
    category: original.category,
    priority: original.priority,
    studentId: original.studentId,
    linkedCourseId: original.linkedCourseId,
    linkedInvoiceId: original.linkedInvoiceId,
    subject: `Re: ${original.subject}`.slice(0, 240),
    description: `Reopen requested from ${original.code}.\n\nReason: ${trimmedReason}`,
    state: routing.assigneeUserId ? 'assigned' : 'open',
    assigneeUserId: routing.assigneeUserId,
    assignedAt: routing.assigneeUserId ? now : null,
    slaAckDeadline,
    slaResolveDeadline,
    parentTicketId: original._id,
  });

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'ticket.reopen_requested',
    targetType: 'Ticket',
    targetId: child._id,
    details: {
      parentTicketId: original._id.toString(),
      parentCode: original.code,
      reason: trimmedReason,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  try {
    if (routing.notifyUserIds.length > 0) {
      const rendered = renderTemplate('ticket.reopen_request', {
        childCode: child.code,
        parentCode: original.code,
        reason: trimmedReason,
      });
      await enqueueNotification({
        type: 'ticket.created',
        recipients: routing.notifyUserIds,
        title: rendered.title,
        body: rendered.body,
        data: {
          ticketId: child._id.toString(),
          ticketCode: child.code,
          parentTicketId: original._id.toString(),
          state: child.state,
        },
      });
    }
  } catch {
    // non-fatal
  }

  return child;
}

export async function addComment(
  actor: AuthContext,
  ticketId: string,
  input: AddCommentInput,
  ctx: TicketCtx,
): Promise<HydratedTicketComment> {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }

  const body = (input.body ?? '').trim();
  if (!body) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'body is required.');
  }

  // Visibility: students can only write public comments.
  let visibility: TicketCommentVisibility = input.visibility ?? 'public';
  if (actor.role === 'student') {
    visibility = 'public';
  } else if (!isStaffRole(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Role cannot comment on tickets.');
  }

  // ACL + state gating.
  if (actor.role === 'student') {
    if (!ticket.studentId.equals(actor.userId)) {
      throw new HttpError(403, 'FORBIDDEN', 'You can only comment on your own tickets.');
    }
    if (!['open', 'assigned', 'in_progress'].includes(ticket.state)) {
      throw new HttpError(
        409,
        'TICKET_STATE_INVALID',
        'Cannot comment on a resolved or closed ticket.',
      );
    }
  }

  const now = nowUtc();
  const comment = await TicketComment.create({
    ticketId: ticket._id,
    authorUserId: actor.userId,
    body,
    visibility,
    attachments: input.attachments ?? [],
  });

  // First staff public comment satisfies the acknowledgement SLA and, if the
  // ticket is still 'open', nudges it to 'assigned'.
  if (isStaffRole(actor.role) && visibility === 'public' && !ticket.firstAckAt) {
    ticket.firstAckAt = now;
    if (ticket.state === 'open') {
      ticket.state = 'assigned';
      if (!ticket.assigneeUserId) ticket.assigneeUserId = actor.userId;
      if (!ticket.assignedAt) ticket.assignedAt = now;
    }
    await ticket.save();
  }

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'ticket.comment.added',
    targetType: 'TicketComment',
    targetId: comment._id,
    after: comment.toJSON(),
    details: {
      ticketId: ticket._id.toString(),
      ticketCode: ticket.code,
      visibility,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  // Notify the counterparty — staff → student, student → assignee —
  // plus any staff @-mentioned by the author and every co-assignee looped
  // into the ticket. Students can't mention (server clears the list).
  try {
    const recipientSet = new Map<string, Types.ObjectId>();
    const addRecipient = (id: Types.ObjectId | null | undefined): void => {
      if (!id) return;
      const key = id.toString();
      if (key === actor.userId.toString()) return; // never notify the author
      if (!recipientSet.has(key)) recipientSet.set(key, id);
    };

    if (actor.role === 'student') {
      addRecipient(ticket.assigneeUserId);
      for (const id of ticket.coAssigneeUserIds ?? []) addRecipient(id);
    } else if (visibility === 'public') {
      addRecipient(ticket.studentId);
      addRecipient(ticket.assigneeUserId);
      for (const id of ticket.coAssigneeUserIds ?? []) addRecipient(id);
    } else {
      // internal note: only loop in staff already on the ticket.
      addRecipient(ticket.assigneeUserId);
      for (const id of ticket.coAssigneeUserIds ?? []) addRecipient(id);
    }

    // @mentions — staff-only (students' mentionUserIds is ignored upstream).
    if (isStaffRole(actor.role) && input.mentionUserIds && input.mentionUserIds.length > 0) {
      const mentionIds = Array.from(
        new Set(input.mentionUserIds.filter((id) => Types.ObjectId.isValid(id))),
      ).map((id) => new Types.ObjectId(id));
      if (mentionIds.length > 0) {
        const { User } = await import('../models/index.js');
        const mentioned = await User.find({ _id: { $in: mentionIds } }).select('_id role');
        for (const u of mentioned) {
          if (isStaffRole(u.role)) addRecipient(u._id);
        }
      }
    }

    const recipients = Array.from(recipientSet.values());
    if (recipients.length > 0) {
      const rendered = renderTemplate('ticket.commented', {
        code: ticket.code,
        bodyPreview: body.slice(0, 500),
      });
      await enqueueNotification({
        type: 'ticket.commented',
        recipients,
        title: rendered.title,
        body: rendered.body,
        data: {
          ticketId: ticket._id.toString(),
          ticketCode: ticket.code,
          commentId: comment._id.toString(),
        },
      });
    }
  } catch {
    // non-fatal
  }

  return comment;
}

export interface TicketAccessCheck {
  allowed: boolean;
  reason?: string;
}

export function canActorSeeTicket(actor: AuthContext, ticket: HydratedTicket): TicketAccessCheck {
  if (actor.role === 'admin' || actor.role === 'superadmin') {
    return { allowed: true };
  }
  if (actor.role === 'student') {
    if (ticket.studentId.equals(actor.userId)) return { allowed: true };
    return { allowed: false, reason: 'not_owner' };
  }
  if (actor.role === 'faculty') {
    if (ticket.assigneeUserId && ticket.assigneeUserId.equals(actor.userId)) {
      return { allowed: true };
    }
    if (ticket.category === 'academic') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'not_assigned' };
  }
  return { allowed: false, reason: 'role_forbidden' };
}

export async function getTicketDetail(
  actor: AuthContext,
  ticketId: string,
): Promise<TicketDetailDto> {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new HttpError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  const access = canActorSeeTicket(actor, ticket);
  if (!access.allowed) {
    throw new HttpError(403, 'FORBIDDEN', 'Not permitted to view this ticket.');
  }
  const commentFilter: Record<string, unknown> = { ticketId: ticket._id };
  if (actor.role === 'student') {
    commentFilter.visibility = 'public';
  }
  const comments = await TicketComment.find(commentFilter).sort({ createdAt: 1 });
  return {
    ticket: toTicketDto(ticket),
    comments: comments.map(toTicketCommentDto),
  };
}

function applyListFilters(
  filter: Record<string, unknown>,
  query: TicketListQuery,
): Record<string, unknown> {
  if (query.category) filter.category = query.category;
  if (query.state) filter.state = query.state;
  if (query.assigneeUserId) {
    if (!Types.ObjectId.isValid(query.assigneeUserId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'assigneeUserId invalid.');
    }
    filter.assigneeUserId = new Types.ObjectId(query.assigneeUserId);
  }
  if (query.studentId) {
    if (!Types.ObjectId.isValid(query.studentId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'studentId invalid.');
    }
    filter.studentId = new Types.ObjectId(query.studentId);
  }
  if (query.slaBreached === 'ack') filter.slaAckBreached = true;
  else if (query.slaBreached === 'resolve') filter.slaResolveBreached = true;
  else if (query.slaBreached === 'any') {
    filter.$or = [{ slaAckBreached: true }, { slaResolveBreached: true }];
  }
  return filter;
}

export async function listForStudent(
  studentId: Types.ObjectId,
  query: TicketListQuery,
): Promise<TicketDto[]> {
  const filter: Record<string, unknown> = { studentId };
  applyListFilters(filter, { ...query, studentId: undefined, assigneeUserId: undefined });
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).limit(limit);
  return tickets.map(toTicketDto);
}

export async function listForAdmin(query: TicketListQuery): Promise<TicketDto[]> {
  const filter: Record<string, unknown> = {};
  applyListFilters(filter, query);
  const limit = Math.min(500, Math.max(1, query.limit ?? 100));
  const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).limit(limit);
  return tickets.map(toTicketDto);
}

export async function listForStaff(
  actor: AuthContext,
  query: TicketListQuery,
): Promise<TicketDto[]> {
  const baseFilter: Record<string, unknown> = {};
  applyListFilters(baseFilter, query);
  // Staff see: tickets assigned to them, plus (for faculty) the academic
  // category they own so coordinators can browse their inbox.
  // [M10r] finance role removed — admin sees everything via the
  // admin/superadmin short-circuit above; finance-category tickets land on
  // admin via the routing service.
  const orClauses: Record<string, unknown>[] = [{ assigneeUserId: actor.userId }];
  if (actor.role === 'faculty') orClauses.push({ category: 'academic' });
  const limit = Math.min(500, Math.max(1, query.limit ?? 100));
  const combined = baseFilter.$or
    ? { $and: [baseFilter, { $or: orClauses }] }
    : { ...baseFilter, $or: orClauses };
  const tickets = await Ticket.find(combined).sort({ createdAt: -1 }).limit(limit);
  return tickets.map(toTicketDto);
}
