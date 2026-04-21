import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { RubricCriterionKind } from 'india-learns-shared-types';

export interface RubricCriterionDoc {
  label: string;
  kind: RubricCriterionKind;
  maxScore: number | null;
  scale: string[];
}

export interface RubricDoc {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  name: string;
  criteria: RubricCriterionDoc[];
  isTemplate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CriterionSchema = new Schema<RubricCriterionDoc>(
  {
    label: { type: String, required: true, maxlength: 240 },
    kind: {
      type: String,
      enum: ['numeric', 'scale'],
      required: true,
    },
    maxScore: { type: Number, default: null, min: 1 },
    scale: {
      type: [{ type: String, maxlength: 200 }],
      default: [],
    },
  },
  { _id: false },
);

const RubricSchema = new Schema<RubricDoc>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 240 },
    criteria: { type: [CriterionSchema], default: [] },
    isTemplate: { type: Boolean, default: false, index: true },
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

RubricSchema.index({ courseId: 1, isTemplate: 1 });

export type HydratedRubric = HydratedDocument<RubricDoc>;

export const Rubric =
  (mongoose.models.Rubric as mongoose.Model<RubricDoc> | undefined) ??
  model<RubricDoc>('Rubric', RubricSchema);
