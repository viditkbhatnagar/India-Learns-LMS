import type {
  AdmissionMode,
  ApplicationState,
  PaymentMethod,
  ProgramRequiredDocType,
} from '../enums.js';

// M1 — Application is a skeleton tied to an applicant User. PII (DOB, gov ID
// upload refs, statement, etc.) lands on the Application doc in M2/M3; M1
// only carries the lifecycle fields below.
export interface ApplicationDto {
  id: string;
  code: string;
  applicantUserId: string;
  applicantName: string;
  applicantEmail: string;
  programId: string | null;
  state: ApplicationState;
  submittedAt: string | null;
  decision: {
    decision: 'admit' | 'deny' | 'waitlist' | null;
    decidedAt: string | null;
    decidedBy: string | null;
    // Surfaced to the applicant portal (M5 + M7) so the green admit banner
    // can show "Welcome to the program" or a denied applicant can read the
    // officer's published message.
    reasonApplicant: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicantSignupInput {
  email: string;
  name: string;
  phoneE164: string;
  password: string;
  // Optional marketing opt-in (PAGE OUTLINE §4.2). UTM tags captured on the
  // landing page can be threaded here in M8 — keep the contract loose for now.
  commsOptIn?: boolean;
  programId?: string;
}

export interface ApplicantSignupResponse {
  application: ApplicationDto;
  accessToken: string;
  accessTokenExpiresIn: number;
}

export interface OfficerApplicationListQuery {
  state?: ApplicationState;
  programId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface OfficerApplicationListResponse {
  items: ApplicationDto[];
  total: number;
  page: number;
  limit: number;
}

// M2 — Program admissions config exposed on the public /apply/programs feed.
// M10 — documentType reuses the shared ProgramRequiredDocType so SSLC /
// Plus Two / Degree / Transfer Certificate / Passport Photo flow through
// automatically.
export interface PublicProgramDocReqDto {
  documentType: ProgramRequiredDocType;
  label: string;
  required: boolean;
}

export interface PublicProgramDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  admissionMode: AdmissionMode;
  applicationFeePaise: number;
  requiredDocs: PublicProgramDocReqDto[];
  requiresStatement: boolean;
  requiresReferences: boolean;
  referencesMinCount: number;
  referencesMaxCount: number;
  statementWordLimit: number;
}

export interface PublicCohortDto {
  id: string;
  programId: string;
  name: string;
  startDate: string;
  endDate: string;
  seatsRemaining: number;
  capacity: number;
}

// M2 — Application draft. The web sends a single JSON record keyed by step
// name; the server stores it untouched plus a parallel `completedSteps`
// array. The step shapes below are loose by design — strict validation
// happens at submit time (M4).
export interface ApplicationDraftStep2Personal {
  legalFirstName: string;
  middleName?: string | null;
  legalLastName: string;
  preferredName?: string | null;
  dateOfBirthIst: string;
  genderIdentity?: string | null;
  citizenship: string;
  countryOfBirth?: string | null;
  primaryLanguage?: string | null;
}

export interface ApplicationDraftStep3Contact {
  address: {
    street: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  };
  mobilePhoneE164: string;
  altPhoneE164?: string | null;
  emergency: {
    name: string;
    relationship: string;
    phoneE164: string;
  };
}

export interface ApplicationDraftStep4Program {
  programId: string;
  batchId?: string | null;
  intendedStartTerm?: string | null;
  modeOfStudy?: 'on_campus' | 'online' | 'hybrid' | null;
  fullPartTime?: 'full_time' | 'part_time' | null;
  secondChoiceProgramId?: string | null;
}

export interface ApplicationDraftStep5AcademicEntry {
  institutionName: string;
  country: string;
  fromDate: string;
  toDate?: string | null;
  credentialEarned?: string | null;
  gpaOrEquivalent?: string | null;
  standardizedTestScores?: string | null;
}

export type ApplicationDraftStep5Academic = ApplicationDraftStep5AcademicEntry[];

export type ApplicationDraftStepName =
  | 'step2_personal'
  | 'step3_contact'
  | 'step4_program'
  | 'step5_academic'
  | 'step6_documents'
  | 'step7_statement'
  | 'step8_references'
  | 'step9_consents';

export interface ApplicationDraftDto {
  id: string;
  applicationId: string;
  data: Partial<Record<ApplicationDraftStepName, unknown>>;
  completedSteps: ApplicationDraftStepName[];
  lastModifiedAt: string;
  updatedAt: string;
}

export interface SaveDraftInput {
  step: ApplicationDraftStepName;
  // Opaque payload; the server validates loose shape and stores. Strict
  // validation happens at submit-time in M4.
  payload: unknown;
  // Mark this step as "complete enough" to enable the Next button on the
  // form. Officer dashboard shows this as a progress bar.
  markComplete?: boolean;
}

// M3a — Document upload. Two-call protocol: (1) request a signed upload
// ticket (Cloudinary), (2) PUT the file to Cloudinary, (3) tell the API the
// upload landed.
export interface SignedUploadTicketDto {
  url: string;
  headers: Record<string, string>;
  key: string;
  expiresAt: string;
  fields?: Record<string, string>;
}

// M10 — `documentType` here is the *applicant-visible* set (program-required
// subset). The storage model can also hold `referee_letter`, but the DTO
// re-maps it to `other` on the way out so officer/applicant views stay
// consistent. See applicationDocumentService.toApplicationDocumentDto.
export interface ApplicationDocumentDto {
  id: string;
  applicationId: string;
  documentType: ProgramRequiredDocType;
  label: string;
  url: string;
  key: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  uploadedByRole: 'applicant' | 'referee';
}

export interface SignDocumentUploadInput {
  documentType: ApplicationDocumentDto['documentType'];
  mimeType: string;
  sizeBytes: number;
}

export interface RegisterDocumentInput {
  documentType: ApplicationDocumentDto['documentType'];
  label?: string;
  url: string;
  key: string;
  sizeBytes: number;
  mimeType: string;
}

// M3a — Statement / SOP. One field for now; M5 reviewer screen reads it
// alongside the application.
export interface SaveStatementInput {
  statement: string;
}

// M3b — Referees.
export interface RefereeDto {
  id: string;
  applicationId: string;
  name: string;
  relationship: string;
  organization: string;
  email: string;
  phoneE164: string | null;
  status: 'invited' | 'reminded' | 'uploaded' | 'expired';
  invitedAt: string;
  remindedAt: string | null;
  uploadedAt: string | null;
  // Letter URL only visible to the officer; the applicant sees status only.
  letterUrl?: string | null;
}

export interface AddRefereeInput {
  name: string;
  relationship: string;
  organization: string;
  email: string;
  phoneE164?: string | null;
}

export interface RefereeUploadContextDto {
  // Public payload returned to the referee after they click the email link.
  // Strictly minimal — no applicant PII beyond first name + program name.
  applicantFirstName: string;
  programName: string | null;
  refereeName: string;
  refereeEmail: string;
  expiresAt: string;
}

// M4 — Consents (PAGE OUTLINE §4.10). FERPA-style discrete acks — each is
// captured as a separate boolean+timestamp.
export interface ApplicationConsentsDto {
  truthfulness: ConsentAckDto;
  terms: ConsentAckDto;
  ferpaNotice: ConsentAckDto;
  priorEducationAuth: ConsentAckDto;
  communications: ConsentAckDto;
}

export interface ConsentAckDto {
  acknowledged: boolean;
  atUtc: string | null;
  version: string;
}

// M4 — Submit input. Server validates completeness and consent state, then
// transitions Application from `draft` to `submitted`.
export interface SubmitApplicationInput {
  // The applicant explicitly re-confirms consents at submit time. Each must
  // be true; the server stamps `atUtc` and `version` on the Application doc.
  truthfulness: boolean;
  terms: boolean;
  ferpaNotice: boolean;
  priorEducationAuth: boolean;
  communications: boolean;
}

// M4 — Withdraw input. Reason is optional; if provided, persisted with the
// state transition for the officer to see.
export interface WithdrawApplicationInput {
  reason?: string;
}

// M5 — Officer-side payloads.
export interface ReviewerNoteDto {
  id: string;
  applicationId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface AddReviewerNoteInput {
  body: string;
}

export interface ApplicationDecisionInput {
  decision: 'admit' | 'deny' | 'waitlist';
  reasonInternal?: string;
  reasonApplicant?: string;
}

export interface OfficerApplicationDetailDto extends ApplicationDto {
  draft: ApplicationDraftDto | null;
  documents: ApplicationDocumentDto[];
  referees: RefereeDto[];
  notes: ReviewerNoteDto[];
  statement: string | null;
  consents: ApplicationConsentsDto | null;
  // M6 — fee row visible to the reviewer so they know whether the admit gate
  // is open. null until application is submitted.
  fee: ApplicationFeeDto | null;
}

export interface AdmissionsAuditChainEntryDto {
  id: string;
  applicationId: string | null;
  actorUserId: string | null;
  action: string;
  details: Record<string, unknown> | null;
  at: string;
  prevHash: string | null;
  chainHash: string;
}

export interface AdmissionsAuditChainDto {
  entries: AdmissionsAuditChainEntryDto[];
  headHash: string;
  verified: boolean;
  brokenAt: string | null;
}

// M6 — Application fee tracking.
export interface ApplicationFeeDto {
  id: string;
  applicationId: string;
  programId: string;
  amountPaise: number;
  status: 'pending' | 'paid' | 'waived';
  paidAt: string | null;
  waivedAt: string | null;
  waivedReason: string | null;
}

export interface RecordApplicationPaymentInput {
  amountPaise: number;
  method: PaymentMethod;
  reference?: string;
  receivedAt?: string;
  notes?: string;
}

export interface ApplicationPaymentDto {
  id: string;
  applicationFeeId: string;
  amountPaise: number;
  method: PaymentMethod;
  reference: string;
  receivedAt: string;
  recordedByUserId: string;
  notes: string;
}

export interface WaiveApplicationFeeInput {
  reason: string;
}

// M7 — Applicant → Student conversion. The applicant accepts the offer, the
// API mints a Student User code and creates Enrollment rows via the existing
// enrollmentService. Officers can assign a cohort first for program_only
// programs.

export interface AssignCohortInput {
  batchId: string;
}

export interface AcceptOfferResult {
  // The applicant becomes a student User with this human-readable code.
  studentCode: string;
  // Enrollments created (one per course in the batch's program).
  enrollmentIds: string[];
}

// M8 — Admissions funnel analytics.
export interface AdmissionsAnalyticsDto {
  totals: {
    draft: number;
    submitted: number;
    under_review: number;
    decision_pending: number;
    admitted: number;
    denied: number;
    waitlisted: number;
    withdrawn: number;
  };
  byProgram: Array<{
    programId: string;
    programName: string;
    counts: AdmissionsAnalyticsDto['totals'];
  }>;
  timeToDecision: {
    p50Hours: number | null;
    p95Hours: number | null;
    sampleSize: number;
  };
  // Drop-off per draft step — count of applicants who completed up to each
  // step but didn't advance. Sourced from ApplicationDraft.completedSteps.
  dropOff: Array<{ step: string; reachedCount: number }>;
  generatedAt: string;
}
