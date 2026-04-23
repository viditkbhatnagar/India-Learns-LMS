import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

export interface AssignmentDoc {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  moduleId: Types.ObjectId | null;
  authorUserId: Types.ObjectId;
  title: string;
  instructions: string;
  dueAt: Date;
  maxScore: number;
  state: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

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
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, maxlength: 240 },
    instructions: { type: String, required: true, maxlength: 8000 },
    dueAt: { type: Date, required: true },
    maxScore: { type: Number, required: true, min: 1, max: 1000 },
    state: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
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

export type HydratedAssignment = HydratedDocument<AssignmentDoc>;

export const Assignment =
  (mongoose.models.Assignment as mongoose.Model<AssignmentDoc> | undefined) ??
  mongoose.model<AssignmentDoc>('Assignment', AssignmentSchema);
