import { Types } from 'mongoose';
import type { PublicCohortDto, PublicProgramDto } from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import {
  Batch,
  Program,
  type HydratedProgram,
} from '../../models/index.js';

export async function listAdmissionsEnabledPrograms(): Promise<PublicProgramDto[]> {
  const programs = await Program.find({
    admissionsEnabled: true,
    isActive: true,
    deletedAt: null,
  }).sort({ name: 1 });
  return programs.map(toPublicProgramDto);
}

export async function listOpenCohortsForProgram(
  programId: string,
): Promise<PublicCohortDto[]> {
  if (!Types.ObjectId.isValid(programId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  }
  const program = await Program.findById(programId);
  if (!program || !program.admissionsEnabled || program.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  }
  if (program.admissionMode !== 'cohort_pick') {
    // The form only renders cohort options for cohort_pick programs.
    // program_only programs return an empty list (the officer assigns later).
    return [];
  }
  const cohorts = await Batch.find({
    programId: program._id,
    openForApplications: true,
    deletedAt: null,
    seatsRemaining: { $gt: 0 },
  }).sort({ startDate: 1 });
  return cohorts.map((c) => ({
    id: String(c._id),
    programId: c.programId.toString(),
    name: c.name,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    seatsRemaining: c.seatsRemaining,
    capacity: c.capacity,
  }));
}

export function toPublicProgramDto(doc: HydratedProgram): PublicProgramDto {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    admissionMode: doc.admissionMode,
    applicationFeePaise: doc.applicationFeePaise,
    requiredDocs: doc.requiredDocs.map((d) => ({
      documentType: d.documentType,
      label: d.label,
      required: d.required,
    })),
    requiresStatement: doc.requiresStatement,
    requiresReferences: doc.requiresReferences,
    referencesMinCount: doc.referencesMinCount,
    referencesMaxCount: doc.referencesMaxCount,
    statementWordLimit: doc.statementWordLimit,
  };
}
