import { z } from 'zod';

// Zod schemas for the curriculum-generator's CurriculumWorkflow document.
// Written against the real response shape (see curriculum-import/SCHEMA-NOTES.md
// and curriculum-import/sample-workflow-{slim,full}.json) — the v0.1 PDF had
// a few field-name mistakes; this file is authoritative.
//
// Strategy: every step is `.passthrough()` so unknown extras don't break
// imports when the generator adds fields. Required keys are only the ones
// the LMS actually uses downstream in the transformer. Everything else is
// `.optional()` / `.nullable()` because real workflows can have nulls in
// step1 and empty arrays scattered throughout.

// --- step3: Program Learning Outcomes ---
const ProgramLearningOutcomeSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    outcomeNumber: z.number().nullish(),
    statement: z.string(),
    bloomLevel: z.string().nullish(),
    verb: z.string().nullish(),
    linkedKSCs: z.array(z.string()).default([]),
  })
  .passthrough();

const Step3Schema = z
  .object({
    outcomes: z.array(ProgramLearningOutcomeSchema).default([]),
  })
  .passthrough()
  .optional();

// --- step4: Modules + MLOs ---
const ModuleLearningOutcomeSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    statement: z.string(),
    bloomLevel: z.string().nullish(),
    verb: z.string().nullish(),
    linkedPLOs: z.array(z.string()).default([]),
    competencyLinks: z.array(z.string()).default([]),
  })
  .passthrough();

const GeneratorModuleSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    title: z.string(),
    description: z.string().default(''),
    phase: z.string().nullish(),
    sequence: z.number(),
    credits: z.number().nullish(),
    contactHours: z.number().nullish(),
    selfStudyHours: z.number().nullish(),
    totalHours: z.number().nullish(),
    prerequisites: z.array(z.string()).default([]),
    linkedPLOs: z.array(z.string()).default([]),
    mlos: z.array(ModuleLearningOutcomeSchema).default([]),
  })
  .passthrough();

const Step4Schema = z
  .object({
    modules: z.array(GeneratorModuleSchema).default([]),
  })
  .passthrough()
  .optional();

// --- step10: Lesson plans (one Session per lesson) ---
const ActivitySchema = z
  .object({
    activityId: z.string(),
    sequenceOrder: z.number(),
    type: z.string(),
    title: z.string(),
    description: z.string().default(''),
    duration: z.number().nullish(),
    teachingMethod: z.string().nullish(),
    instructorActions: z.array(z.string()).default([]),
    studentActions: z.array(z.string()).default([]),
    resources: z.array(z.string()).default([]),
  })
  .passthrough();

const FormativeCheckSchema = z
  .object({
    id: z.string().nullish(),
    type: z.string(),
    question: z.string().nullish(),
    options: z.array(z.string()).default([]),
    correctAnswer: z.union([z.string(), z.number()]).nullish(),
    explanation: z.string().nullish(),
    linkedMLO: z.string().nullish(),
    duration: z.number().nullish(),
  })
  .passthrough();

const LessonMaterialsSchema = z
  .object({
    pptDeckRef: z.string().nullish(),
    caseFiles: z.array(z.unknown()).default([]),
    readingReferences: z.array(z.unknown()).default([]),
  })
  .passthrough();

const LessonSchema = z
  .object({
    lessonId: z.string(),
    lessonNumber: z.number(),
    lessonTitle: z.string(),
    duration: z.number().nullish(),
    bloomLevel: z.string().nullish(),
    objectives: z.array(z.string()).default([]),
    linkedMLOs: z.array(z.string()).default([]),
    linkedPLOs: z.array(z.string()).default([]),
    activities: z.array(ActivitySchema).default([]),
    formativeChecks: z.array(FormativeCheckSchema).default([]),
    materials: LessonMaterialsSchema.optional(),
    independentStudy: z.unknown().optional(),
    instructorNotes: z.unknown().optional(),
  })
  .passthrough();

const ModuleLessonPlanSchema = z
  .object({
    moduleId: z.string(),
    moduleCode: z.string(),
    moduleTitle: z.string(),
    totalLessons: z.number(),
    totalContactHours: z.number().nullish(),
    lessons: z.array(LessonSchema).default([]),
  })
  .passthrough();

const Step10Schema = z
  .object({
    moduleLessonPlans: z.array(ModuleLessonPlanSchema).default([]),
    summary: z.unknown().optional(),
  })
  .passthrough()
  .optional();

// --- step11: PPT decks (slides as JSON) ---
const SlideSchema = z
  .object({
    slideNumber: z.number(),
    slideType: z.string(),
    title: z.string().nullish(),
    content: z.unknown(),
    speakerNotes: z.string().nullish(),
  })
  .passthrough();

const PPTDeckSchema = z
  .object({
    deckId: z.string(),
    lessonId: z.string(),
    lessonNumber: z.number(),
    lessonTitle: z.string(),
    deliveryMode: z.string().nullish(),
    slideCount: z.number(),
    slides: z.array(SlideSchema).default([]),
  })
  .passthrough();

const ModulePPTDeckGroupSchema = z
  .object({
    moduleId: z.string(),
    moduleCode: z.string(),
    moduleTitle: z.string(),
    totalLessons: z.number(),
    pptDecks: z.array(PPTDeckSchema).default([]),
  })
  .passthrough();

const Step11Schema = z
  .object({
    modulePPTDecks: z.array(ModulePPTDeckGroupSchema).default([]),
    summary: z.unknown().optional(),
  })
  .passthrough()
  .optional();

// --- step12: Assignment packs (variants keyed by delivery mode) ---
const RubricCriterionSchema = z
  .object({
    criterionName: z.string(),
    linkedMLOs: z.array(z.string()).default([]),
    weight: z.number().default(0),
    fail: z.string().nullish(),
    pass: z.string().nullish(),
    merit: z.string().nullish(),
    distinction: z.string().nullish(),
  })
  .passthrough();

const EvidenceRequirementSchema = z
  .object({
    artefactType: z.string(),
    wordCountOrDuration: z.string().nullish(),
    fileType: z.string().nullish(),
    additionalNotes: z.string().nullish(),
  })
  .passthrough();

const AssessedOutcomeSchema = z
  .object({
    mloId: z.string(),
    mloStatement: z.string().nullish(),
    linkedPLOs: z.array(z.string()).default([]),
  })
  .passthrough();

const AssignmentVariantSchema = z
  .object({
    assignmentId: z.string(),
    deliveryVariant: z.enum(['self_study', 'hybrid', 'in_person']),
    overview: z
      .object({
        title: z.string(),
        moduleCode: z.string().nullish(),
        moduleTitle: z.string().nullish(),
        assignmentType: z.string().nullish(),
        weighting: z.number().nullish(),
        groupOrIndividual: z.string().nullish(),
        submissionFormat: z.string().nullish(),
        deliveryVariant: z.string().nullish(),
      })
      .passthrough(),
    assessedOutcomes: z.array(AssessedOutcomeSchema).default([]),
    brief: z.unknown().optional(),
    rubric: z.array(RubricCriterionSchema).default([]),
    evidenceRequirements: z.array(EvidenceRequirementSchema).default([]),
    academicIntegrity: z.string().nullish(),
    accessibilityOptions: z.string().nullish(),
  })
  .passthrough();

const AssignmentVariantsRecordSchema = z
  .object({
    self_study: AssignmentVariantSchema.optional(),
    hybrid: AssignmentVariantSchema.optional(),
    in_person: AssignmentVariantSchema.optional(),
  })
  .passthrough();

const ModuleAssignmentPackSchema = z
  .object({
    moduleId: z.string(),
    moduleTitle: z.string(),
    variants: AssignmentVariantsRecordSchema,
  })
  .passthrough();

const Step12Schema = z
  .object({
    moduleAssignmentPacks: z.array(ModuleAssignmentPackSchema).default([]),
    summary: z.unknown().optional(),
  })
  .passthrough()
  .optional();

// --- step13: Summative exam (single object) ---
const ExamSectionBreakdownSchema = z
  .object({
    section: z.string(),
    marks: z.number(),
    questionCount: z.number(),
    timeAllocation: z.string().nullish(),
    plosAssessed: z.array(z.string()).default([]),
  })
  .passthrough();

const SectionAQuestionSchema = z
  .object({
    questionId: z.string(),
    type: z.string(),
    questionText: z.string(),
    options: z.array(z.string()).default([]),
    correctAnswer: z.union([z.string(), z.number()]).nullish(),
    marks: z.number().default(0),
    bloomLevel: z.string().nullish(),
    linkedMLOs: z.array(z.string()).default([]),
    linkedPLOs: z.array(z.string()).default([]),
    rationale: z.string().nullish(),
  })
  .passthrough();

const SectionCTaskSchema = z
  .object({
    taskId: z.string(),
    taskDescription: z.string().nullish(),
    // `instructions` can be a string, array of strings, or richer object —
    // varies per generator output. We don't render it directly in Phase A,
    // so accept any shape and flatten downstream.
    instructions: z.unknown().optional(),
    marks: z.number().default(0),
    modelAnswer: z.unknown().optional(),
    assessmentCriteria: z.unknown().optional(),
    linkedMLOs: z.array(z.string()).default([]),
    linkedPLOs: z.array(z.string()).default([]),
  })
  .passthrough();

const Step13Schema = z
  .object({
    overview: z
      .object({
        examTitle: z.string(),
        credentialName: z.string().nullish(),
        examPurpose: z.string().nullish(),
        totalWeighting: z.number().nullish(),
        totalDuration: z.string().nullish(),
        totalMarks: z.number().nullish(),
        deliveryModes: z.array(z.string()).default([]),
        permittedMaterials: z.string().nullish(),
        sectionBreakdown: z.array(ExamSectionBreakdownSchema).default([]),
      })
      .passthrough(),
    sectionA: z.array(SectionAQuestionSchema).default([]),
    sectionBIncluded: z.boolean().default(false),
    sectionC: z.array(SectionCTaskSchema).default([]),
    markingScheme: z.unknown().optional(),
    integrityAndSecurity: z.unknown().optional(),
    accessibilityProvisions: z.unknown().optional(),
    summary: z.unknown().optional(),
    validation: z.unknown().optional(),
    generatedAt: z.string().nullish(),
    approvedAt: z.string().nullish(),
  })
  .passthrough()
  .optional();

// --- step1: Program foundation (mostly nullable in real workflows) ---
const Step1Schema = z
  .object({
    programTitle: z.string().nullish(),
    programDescription: z.string().nullish(),
    programPurpose: z.string().nullish(),
    programAims: z.array(z.string()).default([]),
    academicLevel: z.string().nullish(),
    creditFramework: z.unknown().optional(),
    targetLearner: z.unknown().optional(),
    delivery: z.unknown().optional(),
    careerPathways: z.array(z.string()).default([]),
    executiveSummary: z.string().nullish(),
  })
  .passthrough()
  .optional();

// --- top-level workflow ---
export const WorkflowSchema = z
  .object({
    _id: z.string(),
    projectName: z.string(),
    createdBy: z.string().nullish(),
    currentStep: z.number(),
    status: z.string(),                  // wide enum on the generator side
    stepProgress: z.array(z.unknown()).default([]),
    step1: Step1Schema,
    step2: z.unknown().optional(),
    step3: Step3Schema,
    step4: Step4Schema,
    step5: z.unknown().optional(),
    step6: z.unknown().optional(),
    step7: z.unknown().optional(),
    step8: z.unknown().optional(),
    step9: z.unknown().optional(),
    step10: Step10Schema,
    step11: Step11Schema,
    step12: Step12Schema,
    step13: Step13Schema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

// Generator API envelope: every response is `{ success, data }`.
export const WorkflowEnvelopeSchema = z.object({
  success: z.literal(true),
  data: WorkflowSchema,
});

export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowEnvelope = z.infer<typeof WorkflowEnvelopeSchema>;
export type GeneratorModule = z.infer<typeof GeneratorModuleSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type PPTDeck = z.infer<typeof PPTDeckSchema>;
export type AssignmentVariant = z.infer<typeof AssignmentVariantSchema>;
export type ModuleAssignmentPack = z.infer<typeof ModuleAssignmentPackSchema>;

// Predicates the import service needs.

/** Workflow has been generated through step 13. */
export function isWorkflowComplete(w: Workflow): boolean {
  // Generator marks step13 as `approved` once approved; before that the
  // workflow can still have currentStep=13 with status="review_pending".
  // For Phase A we accept any workflow that has a populated step13.
  return Boolean(w.step13?.overview?.examTitle);
}
