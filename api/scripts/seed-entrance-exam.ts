/**
 * Seed the Fashion College entrance exam + its 14 temporary candidate logins.
 *
 *   npm run seed:entrance -w api                # create exam + missing candidates
 *   ENTRANCE_RESET=1 npm run seed:entrance -w api   # wipe + recreate everything
 *
 * Optional window envs (IST times as ISO 8601, e.g. 2026-07-10T10:00:00+05:30):
 *   ENTRANCE_STATE=live ENTRANCE_OPENS_AT=... ENTRANCE_CLOSES_AT=...
 *
 * Writes plaintext credentials to <repoRoot>/entrance-credentials.csv (gitignored)
 * for distribution. Only the Argon2id hash is stored in the database.
 */
import { randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import {
  EntranceAttempt,
  EntranceCandidate,
  EntranceExam,
} from '../src/models/index.js';
import type { EntranceQuestionDoc } from '../src/models/entrance/entranceExam.js';
import { hashPassword } from '../src/services/passwordService.js';

const EXAM_TITLE = 'Entrance Examination – Fashion College (After Plus Two)';
const DURATION_MINUTES = 45;

const MCQ_MARKS = 5;
const TEXT_MARKS = 5;

const mcq = (
  section: string,
  text: string,
  options: string[],
  correctIndex: number,
): EntranceQuestionDoc => ({
  section,
  text,
  kind: 'mcq',
  options,
  correctIndex,
  points: MCQ_MARKS,
});

const SEC_A = 'Section A – Fashion Awareness';
const SEC_B = 'Section B – Creativity & Observation';
const SEC_C = 'Section C – Logical & Visual Thinking';
const SEC_D = 'Section D – General Aptitude & Fashion Interest';

// 19 MCQs (answer key baked in) + 1 written question (Q20).
const QUESTIONS: EntranceQuestionDoc[] = [
  mcq(SEC_A, 'Which of the following best describes fashion?', [
    'A permanent style that never changes',
    'A popular style or trend at a particular time',
    'A type of fabric only',
    'A sewing technique',
  ], 1),
  mcq(SEC_A, 'Which element of design refers to the brightness or darkness of a colour?', [
    'Texture', 'Value', 'Shape', 'Pattern',
  ], 1),
  mcq(SEC_A, 'Which garment is traditionally worn in Kerala?', [
    'Kimono', 'Hanbok', 'Kasavu Saree', 'Poncho',
  ], 2),
  mcq(SEC_A, 'Which profession mainly creates new clothing collections?', [
    'Fashion Designer', 'Accountant', 'Chef', 'Pharmacist',
  ], 0),
  mcq(SEC_A, 'Sustainability in fashion mainly means:', [
    'Buying only expensive clothes',
    'Making and using clothing in environmentally and socially responsible ways',
    'Wearing only black clothes',
    'Following every fashion trend',
  ], 1),
  mcq(SEC_B, 'Which colour combination is considered complementary?', [
    'Blue and Green', 'Red and Green', 'Yellow and Orange', 'Pink and Red',
  ], 1),
  mcq(SEC_B, 'A mood board is mainly used to:', [
    'Stitch garments',
    'Collect ideas and inspiration for a design',
    'Measure fabric',
    'Print labels',
  ], 1),
  mcq(SEC_B, 'Which fabric is obtained from plants?', [
    'Silk', 'Wool', 'Cotton', 'Leather',
  ], 2),
  mcq(SEC_B, 'If a garment has repeated floral motifs, the design element being emphasized is:', [
    'Pattern', 'Weight', 'Height', 'Volume',
  ], 0),
  mcq(SEC_B, 'Which quality is most important for a fashion student?', [
    'Creativity', 'Curiosity to learn', 'Observation skills', 'All of the above',
  ], 3),
  mcq(SEC_C, 'Which shape is commonly associated with stability in design?', [
    'Triangle', 'Circle', 'Square', 'Spiral',
  ], 2),
  mcq(SEC_C, 'Which sequence comes next? 1, 3, 5, 7, ____', [
    '8', '9', '10', '11',
  ], 1),
  mcq(SEC_C, 'A customer wants clothing suitable for hot weather. Which fabric would be the best choice?', [
    'Velvet', 'Denim', 'Cotton', 'Fur',
  ], 2),
  mcq(SEC_C, 'Which of the following is NOT a primary colour?', [
    'Red', 'Blue', 'Green', 'Yellow',
  ], 2),
  mcq(SEC_C, 'If a garment is too loose at the waist, what is the most suitable alteration?', [
    'Increase sleeve length', 'Take in the waist', 'Add pockets', 'Shorten the collar',
  ], 1),
  mcq(SEC_D, 'Why do fashion designers research trends before designing?', [
    'To copy others exactly',
    'To understand customer preferences and market needs',
    'To avoid using colours',
    'To reduce garment sizes',
  ], 1),
  mcq(SEC_D, 'Which software is commonly used for creating presentations?', [
    'Microsoft PowerPoint', 'Calculator', 'Paint Brush only', 'Notepad',
  ], 0),
  mcq(SEC_D, 'Which of the following best demonstrates teamwork during a fashion show?', [
    'Ignoring team members',
    'Working with designers, models, and stylists to complete the event',
    'Refusing to share ideas',
    'Working alone',
  ], 1),
  mcq(SEC_D, 'Which accessory is worn around the neck?', [
    'Belt', 'Necklace', 'Bracelet', 'Anklet',
  ], 1),
  // Q20 — written answer (text box). Graded manually by a teacher.
  {
    section: SEC_D,
    text: 'Why do you want to study fashion? Write a short answer describing your interest.',
    kind: 'text',
    options: [],
    correctIndex: null,
    points: TEXT_MARKS,
  },
];

// Candidates from Exam.xlsx. Phone (digits only) is the username.
const CANDIDATES: { name: string; phone: string }[] = [
  { name: 'Amritha', phone: '9895474826' },
  { name: 'Suvidhya', phone: '8075535364' },
  { name: 'Asna', phone: '8593060137' },
  { name: 'Ayisha Nidha', phone: '7907793285' },
  { name: 'Husna', phone: '7902768332' },
  { name: 'Renjana', phone: '7012885828' },
  { name: 'Unaisa', phone: '9048810237' },
  { name: 'Safan', phone: '9072057462' },
  { name: 'Sivahha', phone: '8089259973' },
  { name: 'Josmy', phone: '9744539488' },
  { name: 'Ramiya', phone: '9488432954' },
  { name: 'Asluba', phone: '9048680750' },
  { name: 'Seja', phone: '9846814710' },
  { name: 'Sruthi', phone: '7306068664' },
];

// Unambiguous alphabet (no O/0/I/l/1) — passwords are handed out on paper.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function generatePassword(len = 10): string {
  // Ensure at least one letter and one digit so the same secret would also
  // satisfy the User password policy if the module ever converges.
  for (;;) {
    let out = '';
    for (let i = 0; i < len; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
    if (/[a-z]/.test(out) && /\d/.test(out)) return out;
  }
}

const SeedEnv = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required for seeding.'),
  ENTRANCE_RESET: z.string().optional(),
  ENTRANCE_STATE: z.enum(['draft', 'live', 'closed']).optional(),
  ENTRANCE_OPENS_AT: z.string().optional(),
  ENTRANCE_CLOSES_AT: z.string().optional(),
});

async function main(): Promise<void> {
  const parsed = SeedEnv.safeParse(process.env);
  if (!parsed.success) {
    logger.fatal({ issues: parsed.error.flatten().fieldErrors }, 'seed env invalid');
    process.exit(2);
  }
  const env = parsed.data;
  const reset = env.ENTRANCE_RESET === '1' || env.ENTRANCE_RESET === 'true';

  await connectDb(env.MONGODB_URI);

  if (reset) {
    const existingExams = await EntranceExam.find({ title: EXAM_TITLE }).select('_id');
    const ids = existingExams.map((e) => e._id);
    if (ids.length > 0) {
      await EntranceAttempt.deleteMany({ examId: { $in: ids } });
      await EntranceCandidate.deleteMany({ examId: { $in: ids } });
      await EntranceExam.deleteMany({ _id: { $in: ids } });
      logger.warn({ removed: ids.length }, 'entrance: reset — removed existing exam(s)');
    }
  }

  // Upsert the exam by title.
  let exam = await EntranceExam.findOne({ title: EXAM_TITLE });
  const totalMarks = QUESTIONS.reduce((sum, q) => sum + q.points, 0);
  if (!exam) {
    exam = await EntranceExam.create({
      title: EXAM_TITLE,
      instructions:
        'Answer all questions. Each MCQ carries 5 marks and the written question carries 5 marks. Choose the most appropriate answer. Duration: 45 minutes. Maximum marks: 100.',
      durationMinutes: DURATION_MINUTES,
      totalMarks,
      questions: QUESTIONS,
      state: env.ENTRANCE_STATE ?? 'draft',
      opensAt: env.ENTRANCE_OPENS_AT ? new Date(env.ENTRANCE_OPENS_AT) : null,
      closesAt: env.ENTRANCE_CLOSES_AT ? new Date(env.ENTRANCE_CLOSES_AT) : null,
    });
    logger.info({ id: String(exam._id), totalMarks }, 'entrance: exam created');
  } else {
    // Refresh the question set + window on re-run so edits re-apply.
    exam.questions = QUESTIONS;
    exam.totalMarks = totalMarks;
    exam.durationMinutes = DURATION_MINUTES;
    if (env.ENTRANCE_STATE) exam.state = env.ENTRANCE_STATE;
    if (env.ENTRANCE_OPENS_AT !== undefined) {
      exam.opensAt = env.ENTRANCE_OPENS_AT ? new Date(env.ENTRANCE_OPENS_AT) : null;
    }
    if (env.ENTRANCE_CLOSES_AT !== undefined) {
      exam.closesAt = env.ENTRANCE_CLOSES_AT ? new Date(env.ENTRANCE_CLOSES_AT) : null;
    }
    await exam.save();
    logger.info({ id: String(exam._id) }, 'entrance: exam updated');
  }

  const created: { name: string; phone: string; password: string }[] = [];
  const skipped: string[] = [];

  for (const c of CANDIDATES) {
    const phone = c.phone.replace(/\D/g, '');
    const existing = await EntranceCandidate.findOne({ phone });
    if (existing) {
      skipped.push(`${c.name} (${phone})`);
    } else {
      const password = generatePassword();
      const passwordHash = await hashPassword(password);
      await EntranceCandidate.create({
        examId: exam._id,
        name: c.name,
        phone,
        passwordHash,
        active: true,
      });
      created.push({ name: c.name, phone, password });
    }
  }

  if (created.length > 0) {
    const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
    const outPath = path.join(repoRoot, 'entrance-credentials.csv');
    const rows = [
      'Name,Phone,Password',
      ...created.map((c) => `"${c.name}",${c.phone},${c.password}`),
    ];
    writeFileSync(outPath, `${rows.join('\n')}\n`, 'utf8');
    logger.info({ outPath, created: created.length }, 'entrance: credentials written');
    // Also echo to the console so the operator sees them immediately.
    console.log('\n=== Entrance exam credentials (distribute these) ===');
    console.table(created);
  }
  if (skipped.length > 0) {
    logger.warn(
      { skipped },
      'entrance: candidates already existed — passwords unchanged (use ENTRANCE_RESET=1 to regenerate)',
    );
  }

  await disconnectDb();
}

main().catch(async (err) => {
  logger.fatal({ err }, 'entrance seed failed');
  try {
    await disconnectDb();
  } catch {
    // noop
  }
  process.exit(1);
});
