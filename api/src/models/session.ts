import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// One session per generator lesson. The Course→Module→Session hierarchy is
// new in Phase A; the existing flat module model still works for legacy
// courses that have no sessions.

export interface SessionActivityDoc {
  activityId: string;
  sequenceOrder: number;
  type: string;                // mini_lecture | discussion | demonstration | practice | role_play | case_analysis | group_work | assessment | break
  title: string;
  description: string;
  durationMinutes: number;
  teachingMethod: string;
  instructorActions: string[];
  studentActions: string[];
  resources: string[];
}

export interface FormativeCheckDoc {
  checkId: string;
  type: string;                // mcq | quick_poll | discussion_question | reflection
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  linkedMLO: string | null;
  durationMinutes: number;
}

export type SessionType =
  | 'lecture'
  | 'seminar'
  | 'workshop'
  | 'tutorial'
  | 'lab'
  | 'assessment'
  | 'exam';

export type SessionStatus = 'upcoming' | 'in_progress' | 'completed';

export interface SessionDoc {
  _id: Types.ObjectId;
  moduleId: Types.ObjectId;
  courseId: Types.ObjectId;        // denormalized for query performance
  number: number;                  // sequential within module
  title: string;
  description: string;
  type: SessionType | null;
  plannedMinutes: number | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  location: string | null;
  status: SessionStatus;
  completedAt: Date | null;
  completedBy: Types.ObjectId | null;
  notes: string;                   // private — faculty/superadmin only
  // Curriculum-generator fields.
  sourceLessonId: string | null;
  linkedMLOs: string[];            // codes like "M1-LO1"
  bloomLevel: string | null;
  objectives: string[];
  activities: SessionActivityDoc[];
  formativeChecks: FormativeCheckDoc[];
  // True for sessions we synthesized (e.g., "Assessment" sessions to host
  // assignment-pack variants). Lets the UI flag them.
  synthesized: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema = new Schema<SessionActivityDoc>(
  {
    activityId: { type: String, required: true },
    sequenceOrder: { type: Number, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    durationMinutes: { type: Number, required: true, min: 0 },
    teachingMethod: { type: String, default: '' },
    instructorActions: { type: [String], default: [] },
    studentActions: { type: [String], default: [] },
    resources: { type: [String], default: [] },
  },
  { _id: false, versionKey: false },
);

const FormativeCheckSchema = new Schema<FormativeCheckDoc>(
  {
    checkId: { type: String, required: true },
    type: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], default: [] },
    correctAnswer: { type: String, default: '' },
    explanation: { type: String, default: '' },
    linkedMLO: { type: String, default: null },
    durationMinutes: { type: Number, default: 0 },
  },
  { _id: false, versionKey: false },
);

const SessionSchema = new Schema<SessionDoc>(
  {
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    number: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, default: '', maxlength: 8000 },
    type: {
      type: String,
      enum: ['lecture', 'seminar', 'workshop', 'tutorial', 'lab', 'assessment', 'exam'],
      default: null,
    },
    plannedMinutes: { type: Number, default: null },
    scheduledStart: { type: Date, default: null },
    scheduledEnd: { type: Date, default: null },
    location: { type: String, default: null },
    status: {
      type: String,
      enum: ['upcoming', 'in_progress', 'completed'],
      default: 'upcoming',
      index: true,
    },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '', maxlength: 8000 },
    sourceLessonId: { type: String, default: null },
    linkedMLOs: { type: [String], default: [] },
    bloomLevel: { type: String, default: null },
    objectives: { type: [String], default: [] },
    activities: { type: [ActivitySchema], default: [] },
    formativeChecks: { type: [FormativeCheckSchema], default: [] },
    synthesized: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

// One number per module while alive — re-imports overwrite.
SessionSchema.index(
  { moduleId: 1, number: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
SessionSchema.index({ courseId: 1, scheduledStart: 1 });
// Re-import idempotency: same generator lesson shouldn't be persisted twice
// for the same course.
SessionSchema.index(
  { courseId: 1, sourceLessonId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceLessonId: { $type: 'string' } },
  },
);

export type HydratedSession = HydratedDocument<SessionDoc>;

export const SessionModel =
  (mongoose.models.Session as mongoose.Model<SessionDoc> | undefined) ??
  model<SessionDoc>('Session', SessionSchema);
