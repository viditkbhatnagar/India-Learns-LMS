import type {
  TicketCategory,
  TicketCommentVisibility,
  TicketPriority,
  TicketState,
} from '../enums.js';

export interface TicketAttachmentDto {
  url: string;
  name: string;
  size: number;
}

export interface TicketDto {
  id: string;
  code: string;
  category: TicketCategory;
  priority: TicketPriority;
  studentId: string;
  linkedCourseId: string | null;
  linkedInvoiceId: string | null;
  subject: string;
  description: string;
  state: TicketState;
  assigneeUserId: string | null;
  assignedAt: string | null;
  firstAckAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string;
  resolvedByUserId: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  reopenedFromId: string | null;
  parentTicketId: string | null;
  slaAckDeadline: string;
  slaResolveDeadline: string;
  slaAckBreached: boolean;
  slaResolveBreached: boolean;
  slaAckBreachedAt: string | null;
  slaResolveBreachedAt: string | null;
  attachments: TicketAttachmentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketCommentDto {
  id: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  visibility: TicketCommentVisibility;
  attachments: TicketAttachmentDto[];
  createdAt: string;
}

export interface TicketDetailDto {
  ticket: TicketDto;
  comments: TicketCommentDto[];
}

export interface CreateTicketInput {
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  linkedCourseId?: string | null;
  linkedInvoiceId?: string | null;
  attachments?: TicketAttachmentDto[];
}

export interface AddCommentInput {
  body: string;
  visibility?: TicketCommentVisibility;
  attachments?: TicketAttachmentDto[];
}

export interface TransitionTicketInput {
  to: TicketState;
  note?: string;
}

export interface ReopenRequestInput {
  reason: string;
}

export interface ReopenInput {
  note?: string;
}

export interface TicketListQuery {
  category?: TicketCategory;
  state?: TicketState;
  assigneeUserId?: string;
  studentId?: string;
  slaBreached?: 'ack' | 'resolve' | 'any';
  limit?: number;
}

export interface SlaTimersJobResult {
  processed: number;
  ackBreached: number;
  resolveBreached: number;
  skipped: number;
  errors: Array<{ ticketId: string; message: string }>;
}
