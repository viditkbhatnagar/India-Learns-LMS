import { Counter } from '../models/index.js';

async function nextSeq(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc.seq;
}

export async function nextUserCode(year: number): Promise<string> {
  const seq = await nextSeq(`user_code_${year}`);
  return `IL-${year}-${String(seq).padStart(4, '0')}`;
}
