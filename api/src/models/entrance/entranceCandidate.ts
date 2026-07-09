import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// A temporary entrance-exam login. Deliberately NOT a `User`: these accounts
// carry no role, can reach only `/v1/entrance/*`, and are meant to be disposable
// once the exam window closes. Username is the candidate's phone number.
export interface EntranceCandidateDoc {
  _id: Types.ObjectId;
  examId: Types.ObjectId;
  name: string;
  phone: string;
  passwordHash: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EntranceCandidateSchema = new Schema<EntranceCandidateDoc>(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'EntranceExam',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    // Stored normalized (digits only) so login lookups are exact. Unique across
    // the whole entrance module — one login per phone number.
    phone: { type: String, required: true, unique: true, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        // Never leak the hash, even by accident.
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export type HydratedEntranceCandidate = HydratedDocument<EntranceCandidateDoc>;

export const EntranceCandidate =
  (mongoose.models.EntranceCandidate as
    | mongoose.Model<EntranceCandidateDoc>
    | undefined) ??
  model<EntranceCandidateDoc>('EntranceCandidate', EntranceCandidateSchema);
