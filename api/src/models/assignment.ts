import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

export type AssignmentDeliveryVariant =
  | 'self_study'
  | 'hybrid'
  | 'in_person'
  | 'summative';

export interface AssignmentRubricCriterionDoc {
  criterionName: string;
  linkedMLOs: string[];
  weight: number;
  fail: string;
  pass: string;
  merit: string;
  distinction: string;
}

export interface AssignmentEvidenceRequirementDoc {
  artefactType: string;
  wordCountOrDuration: string;
  fileType: string;
  additionalNotes: string;
}

export interface AssignmentExamSectionDoc {
  section: string;            // "Section A: ..." etc.
  marks: number;
  questionCount: number;
  timeAllocation: string;
  plosAssessed: string[];
}

export interface AssignmentDoc {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  moduleId: Types.ObjectId | null;
  // New in Phase A: Sessions become the canonical attachment point for
  // assignments. moduleId is kept for backward compatibility.
  sessionId: Types.ObjectId | null;
  authorUserId: Types.ObjectId;
  title: string;
  instructions: string;
  dueAt: Date;
  maxScore: number;
  state: 'open' | 'closed';
  // Curriculum-generator fields.
  sourceAssignmentPackId: string | null;
  deliveryVariant: AssignmentDeliveryVariant | null;
  assignmentType: string | null;       // 'practical' | 'exam' | 'case_study' | etc.
  weighting: number | null;            // percentage of module/course mark
  linkedMLOs: string[];
  submissionRequirements: AssignmentEvidenceRequirementDoc[];
  rubric: AssignmentRubricCriterionDoc[];
  sectionBreakdown: AssignmentExamSectionDoc[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const RubricCriterionSchema = new Schema<AssignmentRubricCriterionDoc>(
  {
    criterionName: { type: String, required: true },
    linkedMLOs: { type: [String], default: [] },
    weight: { type: Number, default: 0, min: 0, max: 100 },
    fail: { type: String, default: '' },
    pass: { type: String, default: '' },
    merit: { type: String, default: '' },
    distinction: { type: String, default: '' },
  },
  { _id: false, versionKey: false },
);

const EvidenceRequirementSchema = new Schema<AssignmentEvidenceRequirementDoc>(
  {
    artefactType: { type: String, required: true },
    wordCountOrDuration: { type: String, default: '' },
    fileType: { type: String, default: '' },
    additionalNotes: { type: String, default: '' },
  },
  { _id: false, versionKey: false },
);

const ExamSectionSchema = new Schema<AssignmentExamSectionDoc>(
  {
    section: { type: String, required: true },
    marks: { type: Number, default: 0 },
    questionCount: { type: Number, default: 0 },
    timeAllocation: { type: String, default: '' },
    plosAssessed: { type: [String], default: [] },
  },
  { _id: false, versionKey: false },
);

const AssignmentSchema = new Schema<AssignmentDoc>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    // Optional module/session pointer — if set the assignment shows inside
    // that session. If null the assignment is course-level.
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      default: null,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
      index: true,
    },
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, maxlength: 240 },
    instructions: { type: String, required: true, maxlength: 32000 },
    dueAt: { type: Date, required: true },
    maxScore: { type: Number, required: true, min: 1, max: 1000 },
    state: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    sourceAssignmentPackId: { type: String, default: null },
    deliveryVariant: {
      type: String,
      enum: ['self_study', 'hybrid', 'in_person', 'summative'],
      default: null,
    },
    assignmentType: { type: String, default: null },
    weighting: { type: Number, default: null },
    linkedMLOs: { type: [String], default: [] },
    submissionRequirements: { type: [EvidenceRequirementSchema], default: [] },
    rubric: { type: [RubricCriterionSchema], default: [] },
    sectionBreakdown: { type: [ExamSectionSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

AssignmentSchema.index({ courseId: 1, dueAt: 1 });
// Re-import idempotency: same generator pack on the same course updates in
// place rather than duplicating. Sparse so manually-created assignments
// without a source id don't conflict.
AssignmentSchema.index(
  { courseId: 1, sourceAssignmentPackId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceAssignmentPackId: { $type: 'string' } },
  },
);

export type HydratedAssignment = HydratedDocument<AssignmentDoc>;

export const Assignment =
  (mongoose.models.Assignment as mongoose.Model<AssignmentDoc> | undefined) ??
  mongoose.model<AssignmentDoc>('Assignment', AssignmentSchema);
