import type { Types } from 'mongoose';
import type { TicketCategory } from 'india-learns-shared-types';
import { Course, User, type HydratedUser } from '../models/index.js';
import { nextRoutingSlot } from './counterService.js';

// PRD §10.1 — routing table:
//   academic       → course faculty if linked, else round-robin Faculty with isCourseCoordinator
//   administration → round-robin admin in deptTag='operations' (falls back to any admin)
//   technical      → round-robin admin in deptTag='it' (falls back to any admin)
//   finance        → round-robin finance
//   complaints     → first superadmin (notifications go to whole superadmin pool)

export interface RouteTicketInput {
  category: TicketCategory;
  linkedCourseId: Types.ObjectId | null;
}

export interface RouteResult {
  assigneeUserId: Types.ObjectId | null;
  notifyUserIds: Types.ObjectId[];
}

async function pickRoundRobin(
  candidates: HydratedUser[],
  bucket: string,
): Promise<HydratedUser | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;
  const sorted = [...candidates].sort((a, b) => (a._id.toString() < b._id.toString() ? -1 : 1));
  const slot = await nextRoutingSlot(bucket);
  const idx = (slot - 1) % sorted.length;
  return sorted[idx] ?? null;
}

async function findActive(filter: Record<string, unknown>): Promise<HydratedUser[]> {
  return User.find({
    ...filter,
    status: 'active',
    deletedAt: null,
  });
}

export async function routeTicket(input: RouteTicketInput): Promise<RouteResult> {
  switch (input.category) {
    case 'academic': {
      if (input.linkedCourseId) {
        const course = await Course.findById(input.linkedCourseId);
        const facultyIds = course?.facultyIds ?? [];
        if (facultyIds.length > 0) {
          // Round-robin among the course's own faculty so assignment spreads
          // when a course has multiple instructors.
          const facultyDocs = await findActive({
            _id: { $in: facultyIds },
            role: 'faculty',
          });
          const picked = await pickRoundRobin(
            facultyDocs,
            `faculty_course_${input.linkedCourseId.toString()}`,
          );
          if (picked) {
            return { assigneeUserId: picked._id, notifyUserIds: [picked._id] };
          }
        }
      }
      // Fall back to any faculty coordinator.
      const coords = await findActive({
        role: 'faculty',
        isCourseCoordinator: true,
      });
      const picked = await pickRoundRobin(coords, 'faculty_coord');
      return {
        assigneeUserId: picked?._id ?? null,
        notifyUserIds: picked ? [picked._id] : [],
      };
    }
    case 'administration': {
      const preferred = await findActive({ role: 'admin', deptTag: 'operations' });
      let picked = await pickRoundRobin(preferred, 'admin_ops');
      if (!picked) {
        const fallback = await findActive({ role: 'admin' });
        picked = await pickRoundRobin(fallback, 'admin_any');
      }
      return {
        assigneeUserId: picked?._id ?? null,
        notifyUserIds: picked ? [picked._id] : [],
      };
    }
    case 'technical': {
      const preferred = await findActive({ role: 'admin', deptTag: 'it' });
      let picked = await pickRoundRobin(preferred, 'admin_it');
      if (!picked) {
        const fallback = await findActive({ role: 'admin' });
        picked = await pickRoundRobin(fallback, 'admin_any');
      }
      return {
        assigneeUserId: picked?._id ?? null,
        notifyUserIds: picked ? [picked._id] : [],
      };
    }
    case 'finance': {
      const finance = await findActive({ role: 'finance' });
      const picked = await pickRoundRobin(finance, 'finance');
      return {
        assigneeUserId: picked?._id ?? null,
        notifyUserIds: picked ? [picked._id] : [],
      };
    }
    case 'complaints': {
      const supers = await findActive({ role: 'superadmin' });
      const sorted = [...supers].sort((a, b) => (a._id.toString() < b._id.toString() ? -1 : 1));
      const first = sorted[0] ?? null;
      return {
        assigneeUserId: first?._id ?? null,
        notifyUserIds: sorted.map((u) => u._id),
      };
    }
    default: {
      const exhaustive: never = input.category;
      return exhaustive;
    }
  }
}

/** PRD §10.4 — SLA breach alerts cc the assignee's "manager" (admin pool). */
export async function findAdminRecipientsForBreach(): Promise<Types.ObjectId[]> {
  const admins = await findActive({ role: 'admin' });
  return admins.map((a) => a._id);
}
