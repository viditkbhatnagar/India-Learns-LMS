import type { Types } from 'mongoose';
import type {
  EntranceAttemptAdminDto,
  EntranceCandidateDetailDto,
  EntranceCandidateRowDto,
  EntranceExamAdminDto,
  GradeEntranceTextInput,
  UpdateEntranceExamInput,
} from 'india-learns-shared-types';
import {
  EntranceAttempt,
  EntranceCandidate,
  EntranceExam,
  type EntranceAttemptDoc,
  type HydratedEntranceExam,
} from '../../models/index.js';
import { HttpError } from '../../middleware/error.js';
import { recordAudit } from '../auditService.js';
import {
  toAttemptAdminDto,
  toCandidatePublicDto,
  toCandidateRowDto,
  toExamAdminDto,
} from './entranceMapping.js';

export interface AdminCtx {
  actorUserId: Types.ObjectId;
  ip: string;
  ua: string;
}

async function loadExam(examId: string): Promise<HydratedEntranceExam> {
  const exam = await EntranceExam.findById(examId);
  if (!exam) throw new HttpError(404, 'NOT_FOUND', 'Entrance exam not found.');
  return exam;
}

/** All entrance exams, newest first. Usually just the one active paper. */
export async function listExams(): Promise<EntranceExamAdminDto[]> {
  const exams = await EntranceExam.find().sort({ createdAt: -1 });
  return exams.map(toExamAdminDto);
}

export async function getExamAdmin(examId: string): Promise<EntranceExamAdminDto> {
  return toExamAdminDto(await loadExam(examId));
}

export async function updateExam(
  examId: string,
  input: UpdateEntranceExamInput,
  ctx: AdminCtx,
): Promise<EntranceExamAdminDto> {
  const exam = await loadExam(examId);
  const before = toExamAdminDto(exam);

  if (input.state !== undefined) exam.state = input.state;
  if (input.durationMinutes !== undefined) exam.durationMinutes = input.durationMinutes;
  if (input.maxAttempts !== undefined) exam.maxAttempts = input.maxAttempts;
  if (input.opensAt !== undefined) exam.opensAt = input.opensAt ? new Date(input.opensAt) : null;
  if (input.closesAt !== undefined) exam.closesAt = input.closesAt ? new Date(input.closesAt) : null;

  if (exam.opensAt && exam.closesAt && exam.closesAt.getTime() <= exam.opensAt.getTime()) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Close time must be after open time.');
  }

  await exam.save();
  const after = toExamAdminDto(exam);

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'entrance.exam.updated',
    targetType: 'EntranceExam',
    targetId: exam._id,
    before,
    after,
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return after;
}

/** Roster with per-candidate status + best score across all their attempts. */
export async function listCandidates(examId: string): Promise<EntranceCandidateRowDto[]> {
  const exam = await loadExam(examId);
  const candidates = await EntranceCandidate.find({ examId: exam._id }).sort({ name: 1 });
  const attempts = await EntranceAttempt.find({ examId: exam._id });
  const byCandidate = new Map<string, EntranceAttemptDoc[]>();
  for (const a of attempts) {
    const key = String(a.candidateId);
    const list = byCandidate.get(key) ?? [];
    list.push(a);
    byCandidate.set(key, list);
  }
  return candidates.map((c) =>
    toCandidateRowDto(c, exam, byCandidate.get(String(c._id)) ?? []),
  );
}

export async function getCandidateDetail(
  candidateId: string,
): Promise<EntranceCandidateDetailDto> {
  const candidate = await EntranceCandidate.findById(candidateId);
  if (!candidate) throw new HttpError(404, 'NOT_FOUND', 'Candidate not found.');
  const exam = await loadExam(String(candidate.examId));
  const attempts = await EntranceAttempt.find({ candidateId: candidate._id }).sort({
    attemptNumber: -1,
  });
  return {
    candidate: toCandidatePublicDto(candidate),
    maxAttempts: exam.maxAttempts,
    attempts: attempts.map((a) => toAttemptAdminDto(a, exam, candidate)),
  };
}

export async function getAttemptAdmin(attemptId: string): Promise<EntranceAttemptAdminDto> {
  const attempt = await EntranceAttempt.findById(attemptId);
  if (!attempt) throw new HttpError(404, 'NOT_FOUND', 'Attempt not found.');
  const exam = await loadExam(String(attempt.examId));
  const candidate = await EntranceCandidate.findById(attempt.candidateId);
  if (!candidate) throw new HttpError(404, 'NOT_FOUND', 'Candidate not found.');
  return toAttemptAdminDto(attempt, exam, candidate);
}

/** Score a written (text) question — the only manually graded part of the paper. */
export async function gradeTextAnswer(
  attemptId: string,
  input: GradeEntranceTextInput,
  ctx: AdminCtx,
): Promise<EntranceAttemptAdminDto> {
  const attempt = await EntranceAttempt.findById(attemptId);
  if (!attempt) throw new HttpError(404, 'NOT_FOUND', 'Attempt not found.');
  if (attempt.status === 'in_progress') {
    throw new HttpError(
      409,
      'ENTRANCE_NOT_SUBMITTED',
      'Cannot grade an attempt that has not been submitted.',
    );
  }
  const exam = await loadExam(String(attempt.examId));
  const candidate = await EntranceCandidate.findById(attempt.candidateId);
  if (!candidate) throw new HttpError(404, 'NOT_FOUND', 'Candidate not found.');

  const q = exam.questions[input.questionIndex];
  if (!q) throw new HttpError(422, 'VALIDATION_FAILED', 'Unknown question index.');
  if (q.kind !== 'text') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Only written questions are manually graded.');
  }
  if (input.marks < 0 || input.marks > q.points) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `Marks must be between 0 and ${q.points}.`,
    );
  }

  const before = toAttemptAdminDto(attempt, exam, candidate);
  attempt.manualScoreMarks = input.marks;
  attempt.manualComment = input.comment ?? '';
  attempt.totalScoreMarks = attempt.autoScoreMarks + input.marks;
  attempt.status = 'graded';
  attempt.gradedByUserId = ctx.actorUserId;
  attempt.gradedAt = new Date();
  await attempt.save();
  const after = toAttemptAdminDto(attempt, exam, candidate);

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'entrance.attempt.graded',
    targetType: 'EntranceAttempt',
    targetId: attempt._id,
    before,
    after,
    details: { candidateId: String(candidate._id), marks: input.marks },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return after;
}
