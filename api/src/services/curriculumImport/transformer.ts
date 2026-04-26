import type {
  AssignmentVariant,
  GeneratorModule,
  Lesson,
  ModuleAssignmentPack,
  PPTDeck,
  Workflow,
} from './schema.js';

// Pure transformer: parsed generator workflow → normalized intermediate
// representation the persister can write transactionally. Programmatic
// decisions (defaults, fallbacks, synthesized sessions) are documented
// inline so the next reader can audit them.

const DEFAULT_DUE_OFFSET_DAYS_VARIANT = 30;
const DEFAULT_DUE_OFFSET_DAYS_SUMMATIVE = 90;
const SUMMATIVE_DEFAULT_MAX_SCORE = 100;
const VARIANT_DEFAULT_MAX_SCORE = 100;
const FALLBACK_MAX_SCORE = 100;

export interface TransformedCourse {
  name: string;
  slug: string;
  summary: string;
  sourceWorkflowId: string;
  sourceWorkflowVersion: string;
  programLearningOutcomes: Array<{
    outcomeId: string;
    code: string;
    outcomeNumber: number | null;
    statement: string;
    bloomLevel: string;
    linkedKSCs: string[];
  }>;
}

export interface TransformedModule {
  key: string; // sourceModuleId — used as join key during persistence
  sourceModuleId: string;
  code: string | null;
  title: string;
  order: number;
  aim: string;
  prerequisites: string[];
  coreElective: 'core' | 'elective';
  totalHours: number | null;
  contactHours: number | null;
  selfStudyHours: number | null;
  learningOutcomes: Array<{
    mloId: string;
    code: string;
    statement: string;
    bloomLevel: string;
    verb: string;
    linkedPLOs: string[];
    linkedKSCs: string[];
  }>;
}

export interface TransformedSession {
  moduleKey: string; // join key → TransformedModule.key
  sessionKey: string; // unique key (lessonId or synthesized id)
  number: number;
  title: string;
  description: string;
  type: 'lecture' | 'seminar' | 'workshop' | 'tutorial' | 'lab' | 'assessment' | 'exam' | null;
  plannedMinutes: number | null;
  bloomLevel: string | null;
  objectives: string[];
  linkedMLOs: string[];
  activities: Array<{
    activityId: string;
    sequenceOrder: number;
    type: string;
    title: string;
    description: string;
    durationMinutes: number;
    teachingMethod: string;
    instructorActions: string[];
    studentActions: string[];
    resources: string[];
  }>;
  formativeChecks: Array<{
    checkId: string;
    type: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    linkedMLO: string | null;
    durationMinutes: number;
  }>;
  sourceLessonId: string | null;
  synthesized: boolean;
  notes: string;
}

export interface TransformedMaterial {
  scope: 'session' | 'module' | 'assignment';
  // For 'session' / 'assignment' scopes the persister joins via the *Key.
  sessionKey?: string;
  moduleKey?: string;
  assignmentKey?: string;
  type: 'slides' | 'reading' | 'pdf' | 'video' | 'link' | 'practice' | 'reflection' | 'file' | 'case';
  title: string;
  body: unknown;
  url: string | null;
  sizeBytes: number | null;
  expectedHours: number | null;
  sourceDeckId: string | null;
  sourceLessonId: string | null;
  slideCount: number | null;
}

export interface TransformedAssignment {
  assignmentKey: string;
  moduleKey: string | null; // null for the summative
  sessionKey: string;
  title: string;
  instructions: string;
  dueAtOffsetDays: number; // persister adds to import time
  maxScore: number;
  sourceAssignmentPackId: string;
  deliveryVariant: 'self_study' | 'hybrid' | 'in_person' | 'summative';
  assignmentType: string | null;
  weighting: number | null;
  linkedMLOs: string[];
  submissionRequirements: Array<{
    artefactType: string;
    wordCountOrDuration: string;
    fileType: string;
    additionalNotes: string;
  }>;
  rubric: Array<{
    criterionName: string;
    linkedMLOs: string[];
    weight: number;
    fail: string;
    pass: string;
    merit: string;
    distinction: string;
  }>;
  sectionBreakdown: Array<{
    section: string;
    marks: number;
    questionCount: number;
    timeAllocation: string;
    plosAssessed: string[];
  }>;
}

export interface TransformedImport {
  course: TransformedCourse;
  modules: TransformedModule[];
  sessions: TransformedSession[];
  materials: TransformedMaterial[];
  assignments: TransformedAssignment[];
  warnings: string[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function pickCourseName(w: Workflow): string {
  const fromStep1 = w.step1?.programTitle?.trim();
  if (fromStep1) return fromStep1;
  return w.projectName.trim();
}

function pickCourseSummary(w: Workflow): string {
  return (
    w.step1?.executiveSummary
    ?? w.step1?.programDescription
    ?? ''
  ).slice(0, 8000);
}

function transformCourse(w: Workflow, warnings: string[]): TransformedCourse {
  const name = pickCourseName(w);
  if (!name) warnings.push('Course name fell back to projectName because step1.programTitle was empty.');
  const slug = `${slugify(name)}-${w._id.slice(-6)}`;
  return {
    name,
    slug,
    summary: pickCourseSummary(w),
    sourceWorkflowId: w._id,
    sourceWorkflowVersion: w.updatedAt,
    programLearningOutcomes: (w.step3?.outcomes ?? []).map((o) => ({
      outcomeId: o.id,
      code: o.code,
      outcomeNumber: o.outcomeNumber ?? null,
      statement: o.statement,
      bloomLevel: o.bloomLevel ?? '',
      linkedKSCs: o.linkedKSCs ?? [],
    })),
  };
}

function transformModule(m: GeneratorModule): TransformedModule {
  return {
    key: m.id,
    sourceModuleId: m.id,
    code: m.code ?? null,
    title: m.title,
    order: m.sequence,
    aim: m.description ?? '',
    prerequisites: m.prerequisites ?? [],
    // Generator has no core/elective marker — default 'core', staff can edit.
    coreElective: 'core',
    totalHours: m.totalHours ?? null,
    contactHours: m.contactHours ?? null,
    selfStudyHours: m.selfStudyHours ?? null,
    learningOutcomes: (m.mlos ?? []).map((mlo) => ({
      mloId: mlo.id,
      code: mlo.code,
      statement: mlo.statement,
      bloomLevel: mlo.bloomLevel ?? '',
      verb: mlo.verb ?? '',
      linkedPLOs: mlo.linkedPLOs ?? [],
      // Generator names this `competencyLinks` on MLOs but `linkedKSCs` on
      // PLOs — we normalize both to `linkedKSCs` in the LMS.
      linkedKSCs: mlo.competencyLinks ?? [],
    })),
  };
}

function transformSession(
  lesson: Lesson,
  moduleKey: string,
  warnings: string[],
): TransformedSession {
  return {
    moduleKey,
    sessionKey: lesson.lessonId,
    number: lesson.lessonNumber,
    title: lesson.lessonTitle,
    description: (lesson.objectives ?? []).join('\n'),
    type: null,
    plannedMinutes: lesson.duration ?? null,
    bloomLevel: lesson.bloomLevel ?? null,
    objectives: lesson.objectives ?? [],
    linkedMLOs: lesson.linkedMLOs ?? [],
    activities: (lesson.activities ?? []).map((a) => ({
      activityId: a.activityId,
      sequenceOrder: a.sequenceOrder,
      type: a.type,
      title: a.title,
      description: a.description ?? '',
      durationMinutes: a.duration ?? 0,
      teachingMethod: a.teachingMethod ?? '',
      instructorActions: a.instructorActions ?? [],
      studentActions: a.studentActions ?? [],
      resources: a.resources ?? [],
    })),
    formativeChecks: (lesson.formativeChecks ?? []).map((fc, i) => {
      const ans = fc.correctAnswer;
      return {
        checkId: fc.id ?? `${lesson.lessonId}-fc-${i + 1}`,
        type: fc.type,
        question: fc.question ?? '',
        options: fc.options ?? [],
        correctAnswer: ans === undefined || ans === null ? '' : String(ans),
        explanation: fc.explanation ?? '',
        linkedMLO: fc.linkedMLO ?? null,
        durationMinutes: fc.duration ?? 0,
      };
    }),
    sourceLessonId: lesson.lessonId,
    synthesized: false,
    notes: extractInstructorNotes(lesson, warnings),
  };
}

function extractInstructorNotes(lesson: Lesson, warnings: string[]): string {
  const n = lesson.instructorNotes;
  if (!n) return '';
  if (typeof n === 'string') return n;
  if (typeof n === 'object') {
    try {
      // Generator emits a structured object — flatten into a readable string
      // for the private notes field.
      const lines: string[] = [];
      const obj = n as Record<string, unknown>;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string') lines.push(`${k}:\n${v}`);
        else if (Array.isArray(v)) lines.push(`${k}:\n${v.map((x) => `- ${String(x)}`).join('\n')}`);
      }
      return lines.join('\n\n').slice(0, 8000);
    } catch {
      warnings.push(`Could not stringify instructorNotes for lesson ${lesson.lessonId}.`);
      return '';
    }
  }
  return '';
}

function transformPPTMaterials(
  group: { moduleId: string; pptDecks: PPTDeck[] },
  lessonIdToModuleKey: Map<string, string>,
  warnings: string[],
): TransformedMaterial[] {
  const out: TransformedMaterial[] = [];
  for (const deck of group.pptDecks) {
    const moduleKey = lessonIdToModuleKey.get(deck.lessonId);
    if (!moduleKey) {
      warnings.push(
        `PPT deck ${deck.deckId} references lesson ${deck.lessonId} which is not in any module's lesson plan — skipped.`,
      );
      continue;
    }
    out.push({
      scope: 'session',
      sessionKey: deck.lessonId,
      type: 'slides',
      title: `Slides — ${deck.lessonTitle}`,
      body: deck.slides,
      url: null,
      sizeBytes: null,
      expectedHours: null,
      sourceDeckId: deck.deckId,
      sourceLessonId: deck.lessonId,
      slideCount: deck.slideCount,
    });
  }
  return out;
}

function safeAssignmentId(
  variant: AssignmentVariant,
  pack: ModuleAssignmentPack,
  generatorModule: GeneratorModule | undefined,
): string {
  // Known generator bug: when module.code was undefined at generation time
  // the variant's assignmentId comes back as `"undefined-<variant>"`. Fall
  // back to a stable composite of moduleCode + delivery variant.
  if (variant.assignmentId.startsWith('undefined')) {
    const code = generatorModule?.code ?? pack.moduleId;
    return `${code}-${variant.deliveryVariant}`;
  }
  return variant.assignmentId;
}

function flattenBrief(brief: unknown): string {
  if (!brief) return '';
  if (typeof brief === 'string') return brief;
  if (typeof brief !== 'object') return '';
  const obj = brief as Record<string, unknown>;
  const sections: string[] = [];
  if (typeof obj.studentFacingIntro === 'string') sections.push(obj.studentFacingIntro);
  if (typeof obj.workplaceContext === 'string') sections.push(`\n## Context\n${obj.workplaceContext}`);
  if (Array.isArray(obj.stepByStepInstructions)) {
    sections.push(`\n## Steps\n${obj.stepByStepInstructions.map((s) => `- ${String(s)}`).join('\n')}`);
  }
  if (Array.isArray(obj.deliverables)) {
    sections.push(`\n## Deliverables\n${obj.deliverables.map((s) => `- ${String(s)}`).join('\n')}`);
  }
  return sections.join('\n').slice(0, 32000);
}

function transformAssignmentVariant(
  variant: AssignmentVariant,
  pack: ModuleAssignmentPack,
  generatorModule: GeneratorModule | undefined,
  assessmentSessionKey: string,
): TransformedAssignment {
  const assignmentKey = safeAssignmentId(variant, pack, generatorModule);
  return {
    assignmentKey,
    moduleKey: pack.moduleId,
    sessionKey: assessmentSessionKey,
    title: variant.overview.title,
    instructions: flattenBrief(variant.brief),
    dueAtOffsetDays: DEFAULT_DUE_OFFSET_DAYS_VARIANT,
    maxScore: VARIANT_DEFAULT_MAX_SCORE,
    sourceAssignmentPackId: assignmentKey,
    deliveryVariant: variant.deliveryVariant,
    assignmentType: variant.overview.assignmentType ?? null,
    weighting: variant.overview.weighting ?? null,
    linkedMLOs: Array.from(
      new Set((variant.assessedOutcomes ?? []).map((o) => o.mloId).filter(Boolean)),
    ),
    submissionRequirements: (variant.evidenceRequirements ?? []).map((e) => ({
      artefactType: e.artefactType,
      wordCountOrDuration: e.wordCountOrDuration ?? '',
      fileType: e.fileType ?? '',
      additionalNotes: e.additionalNotes ?? '',
    })),
    rubric: (variant.rubric ?? []).map((r) => ({
      criterionName: r.criterionName,
      linkedMLOs: r.linkedMLOs ?? [],
      weight: r.weight ?? 0,
      fail: r.fail ?? '',
      pass: r.pass ?? '',
      merit: r.merit ?? '',
      distinction: r.distinction ?? '',
    })),
    sectionBreakdown: [],
  };
}

function buildModuleAssessmentSession(
  pack: ModuleAssignmentPack,
  generatorModule: GeneratorModule | undefined,
  highestLessonNumberInModule: number,
): TransformedSession {
  const number = highestLessonNumberInModule + 1;
  return {
    moduleKey: pack.moduleId,
    sessionKey: `${pack.moduleId}-assessment`,
    number,
    title: `${generatorModule?.code ?? pack.moduleId} — Assessment`,
    description: 'Assessment session — holds the assignment variants for this module.',
    type: 'assessment',
    plannedMinutes: null,
    bloomLevel: null,
    objectives: [],
    linkedMLOs: [],
    activities: [],
    formativeChecks: [],
    sourceLessonId: null,
    synthesized: true,
    notes: 'Auto-generated by curriculum import to host assignment-pack variants. Faculty can move assignments to a different session if preferred.',
  };
}

function transformSummative(
  w: Workflow,
  finalModuleKey: string | null,
  finalModuleHighestLessonNumber: number,
): { session: TransformedSession; assignment: TransformedAssignment } | null {
  const s13 = w.step13;
  if (!s13?.overview?.examTitle || !finalModuleKey) return null;

  const sessionKey = `${w._id}-summative`;
  const session: TransformedSession = {
    moduleKey: finalModuleKey,
    sessionKey,
    number: finalModuleHighestLessonNumber + 2, // +1 is taken by the assessment session
    title: 'Final Summative Exam',
    description: s13.overview.examPurpose ?? '',
    type: 'exam',
    plannedMinutes: null,
    bloomLevel: null,
    objectives: [],
    linkedMLOs: [],
    activities: [],
    formativeChecks: [],
    sourceLessonId: null,
    synthesized: true,
    notes: 'Auto-generated by curriculum import to host the summative exam.',
  };
  const sectionBreakdown = (s13.overview.sectionBreakdown ?? []).map((sb) => ({
    section: sb.section,
    marks: sb.marks,
    questionCount: sb.questionCount,
    timeAllocation: sb.timeAllocation ?? '',
    plosAssessed: sb.plosAssessed ?? [],
  }));
  const linkedMLOs = Array.from(
    new Set([
      ...(s13.sectionA ?? []).flatMap((q) => q.linkedMLOs ?? []),
      ...(s13.sectionC ?? []).flatMap((t) => t.linkedMLOs ?? []),
    ]),
  );
  const assignment: TransformedAssignment = {
    assignmentKey: `${w._id}-summative`,
    moduleKey: null,
    sessionKey,
    title: s13.overview.examTitle,
    instructions: s13.overview.examPurpose ?? '',
    dueAtOffsetDays: DEFAULT_DUE_OFFSET_DAYS_SUMMATIVE,
    maxScore: s13.overview.totalMarks ?? SUMMATIVE_DEFAULT_MAX_SCORE,
    sourceAssignmentPackId: `${w._id}-summative`,
    deliveryVariant: 'summative',
    assignmentType: 'exam',
    weighting: s13.overview.totalWeighting ?? null,
    linkedMLOs,
    submissionRequirements: [],
    rubric: [],
    sectionBreakdown,
  };
  return { session, assignment };
}

export function transformWorkflow(w: Workflow): TransformedImport {
  const warnings: string[] = [];

  const course = transformCourse(w, warnings);

  const generatorModules = w.step4?.modules ?? [];
  const moduleByKey = new Map<string, GeneratorModule>();
  for (const m of generatorModules) moduleByKey.set(m.id, m);

  const modules: TransformedModule[] = generatorModules.map(transformModule);

  // Lesson → Session.
  // The CHRP workflow surfaced two real-world gotchas the original
  // transformer didn't guard against:
  //   1. step10.moduleLessonPlans can have DUPLICATE entries for the same
  //      moduleId (the generator emitted two plan groups for mod5 and
  //      mod6, each with the same 9 lessons). Inserting the dupes hits
  //      the unique sparse index on (courseId, sourceLessonId) on the
  //      second pass, throwing mid-batch and silently dropping every
  //      session after the failure point.
  //   2. Even within a single plan, a lessonId can repeat. We dedup at
  //      the (lessonId) granularity to guarantee at most one Session per
  //      generator lesson.
  // First-occurrence wins; later duplicates are warned about.
  const lessonPlans = w.step10?.moduleLessonPlans ?? [];
  const sessions: TransformedSession[] = [];
  const lessonIdToModuleKey = new Map<string, string>();
  const highestLessonNumberByModule = new Map<string, number>();
  const seenPlanModules = new Set<string>();
  const seenLessonIds = new Set<string>();

  for (const plan of lessonPlans) {
    if (!moduleByKey.has(plan.moduleId)) {
      warnings.push(
        `Lesson plan for module ${plan.moduleId} has no matching module in step4 — skipped.`,
      );
      continue;
    }
    if (seenPlanModules.has(plan.moduleId)) {
      warnings.push(
        `Duplicate lesson-plan group for module ${plan.moduleId} (${plan.moduleCode}) in step10 — keeping the first occurrence (${plan.lessons.length} lessons skipped).`,
      );
      continue;
    }
    seenPlanModules.add(plan.moduleId);
    let high = 0;
    for (const lesson of plan.lessons) {
      if (seenLessonIds.has(lesson.lessonId)) {
        warnings.push(
          `Duplicate lessonId ${lesson.lessonId} in module ${plan.moduleId} — skipped.`,
        );
        continue;
      }
      seenLessonIds.add(lesson.lessonId);
      sessions.push(transformSession(lesson, plan.moduleId, warnings));
      lessonIdToModuleKey.set(lesson.lessonId, plan.moduleId);
      if (lesson.lessonNumber > high) high = lesson.lessonNumber;
    }
    highestLessonNumberByModule.set(plan.moduleId, high);
  }

  // PPT decks → Materials (slides) attached per session. Defensive
  // dedup by deckId — the unique sparse index on (courseId, sourceDeckId)
  // would silently throw mid-batch if the generator ever emits the same
  // deckId twice.
  const seenDeckIds = new Set<string>();
  const materials: TransformedMaterial[] = [];
  for (const group of w.step11?.modulePPTDecks ?? []) {
    for (const m of transformPPTMaterials(group, lessonIdToModuleKey, warnings)) {
      const deckId = m.sourceDeckId;
      if (deckId && seenDeckIds.has(deckId)) {
        warnings.push(
          `Duplicate PPT deckId ${deckId} in step11 — skipped.`,
        );
        continue;
      }
      if (deckId) seenDeckIds.add(deckId);
      materials.push(m);
    }
  }

  // Assignment packs → synthesized assessment session per module + 1..3
  // assignments per pack. Defensive dedup at module + assignment-id
  // granularity for the same reason as step10/step11.
  const assignments: TransformedAssignment[] = [];
  const seenPackModules = new Set<string>();
  const seenAssignmentKeys = new Set<string>();
  for (const pack of w.step12?.moduleAssignmentPacks ?? []) {
    if (!moduleByKey.has(pack.moduleId)) {
      warnings.push(
        `Assignment pack for module ${pack.moduleId} has no matching module in step4 — skipped.`,
      );
      continue;
    }
    if (seenPackModules.has(pack.moduleId)) {
      warnings.push(
        `Duplicate assignment-pack group for module ${pack.moduleId} in step12 — skipped.`,
      );
      continue;
    }
    seenPackModules.add(pack.moduleId);
    const high = highestLessonNumberByModule.get(pack.moduleId) ?? 0;
    const assessSession = buildModuleAssessmentSession(
      pack,
      moduleByKey.get(pack.moduleId),
      high,
    );
    sessions.push(assessSession);

    const { variants } = pack;
    const variantList: AssignmentVariant[] = [];
    if (variants.self_study) variantList.push(variants.self_study);
    if (variants.hybrid) variantList.push(variants.hybrid);
    if (variants.in_person) variantList.push(variants.in_person);

    for (const v of variantList) {
      const transformed = transformAssignmentVariant(
        v,
        pack,
        moduleByKey.get(pack.moduleId),
        assessSession.sessionKey,
      );
      if (seenAssignmentKeys.has(transformed.assignmentKey)) {
        warnings.push(
          `Duplicate assignmentKey ${transformed.assignmentKey} (after fallback) — skipped.`,
        );
        continue;
      }
      seenAssignmentKeys.add(transformed.assignmentKey);
      assignments.push(transformed);
    }
  }

  // Summative exam: attach to final module.
  const finalModule = modules.length > 0 ? modules[modules.length - 1]! : null;
  const finalModuleKey = finalModule?.key ?? null;
  const finalHighest = finalModuleKey
    ? (highestLessonNumberByModule.get(finalModuleKey) ?? 0)
    : 0;
  const summative = transformSummative(w, finalModuleKey, finalHighest);
  if (summative) {
    sessions.push(summative.session);
    assignments.push(summative.assignment);
  } else if (w.step13?.overview?.examTitle) {
    warnings.push('Summative exam present in workflow but no modules found to attach it to — skipped.');
  }

  return {
    course,
    modules,
    sessions,
    materials,
    assignments,
    warnings,
  };
}

// Re-exports for tests.
export const transformerInternals = {
  slugify,
  pickCourseName,
  pickCourseSummary,
  safeAssignmentId,
  FALLBACK_MAX_SCORE,
};
