export { User } from './user.js';
export type { UserDoc, HydratedUser } from './user.js';
export { Announcement } from './announcement.js';
export type { AnnouncementDoc, HydratedAnnouncement } from './announcement.js';
export { Assignment } from './assignment.js';
export type {
  AssignmentDoc,
  HydratedAssignment,
  AssignmentDeliveryVariant,
  AssignmentRubricCriterionDoc,
  AssignmentEvidenceRequirementDoc,
  AssignmentExamSectionDoc,
} from './assignment.js';
export { AssignmentSubmission, SUBMISSION_STATUSES } from './assignmentSubmission.js';
export type {
  AssignmentSubmissionDoc,
  HydratedAssignmentSubmission,
  SubmissionStatus,
  SubmissionRubricScoreDoc,
} from './assignmentSubmission.js';
export { InviteToken } from './inviteToken.js';
export type { InviteTokenDoc } from './inviteToken.js';
export { RefreshToken } from './refreshToken.js';
export type { RefreshTokenDoc } from './refreshToken.js';
export { AuditLog } from './auditLog.js';
export type { AuditLogDoc } from './auditLog.js';
export { Counter } from './counter.js';
export type { CounterDoc } from './counter.js';
export { Program } from './program.js';
export type { ProgramDoc, HydratedProgram } from './program.js';
export { Course } from './course.js';
export type {
  CourseDoc,
  HydratedCourse,
  ProgramLearningOutcomeDoc,
} from './course.js';
export { ModuleModel } from './module.js';
export type {
  ModuleDoc,
  HydratedModule,
  ModuleContentBlockDoc,
  ModuleLearningOutcomeDoc,
} from './module.js';
export { SessionModel } from './session.js';
export type {
  SessionDoc,
  HydratedSession,
  SessionActivityDoc,
  FormativeCheckDoc,
  SessionType,
  SessionStatus,
} from './session.js';
export { Material } from './material.js';
export type {
  MaterialDoc,
  HydratedMaterial,
  MaterialType,
} from './material.js';
export { AttendanceRecord, ATTENDANCE_STATUSES } from './attendanceRecord.js';
export type {
  AttendanceRecordDoc,
  HydratedAttendanceRecord,
  AttendanceStatus,
} from './attendanceRecord.js';
export { Batch } from './batch.js';
export type { BatchDoc, HydratedBatch } from './batch.js';
export { Enrollment } from './enrollment.js';
export type { EnrollmentDoc, HydratedEnrollment } from './enrollment.js';
export { TimetableEntry } from './timetableEntry.js';
export type {
  TimetableEntryDoc,
  HydratedTimetableEntry,
} from './timetableEntry.js';
export { TimetableOverride } from './timetableOverride.js';
export type {
  TimetableOverrideDoc,
  HydratedTimetableOverride,
} from './timetableOverride.js';
export { Holiday } from './holiday.js';
export type { HolidayDoc, HydratedHoliday } from './holiday.js';
export { Notification } from './notification.js';
export type {
  NotificationDoc,
  HydratedNotification,
} from './notification.js';
export { FeeStructure } from './feeStructure.js';
export type {
  FeeStructureDoc,
  FeeComponentDoc,
  HydratedFeeStructure,
} from './feeStructure.js';
export { Invoice } from './invoice.js';
export type { InvoiceDoc, HydratedInvoice } from './invoice.js';
export { FeeInstallment } from './feeInstallment.js';
export type {
  FeeInstallmentDoc,
  HydratedFeeInstallment,
  ReminderSentEntry,
} from './feeInstallment.js';
export { Payment } from './payment.js';
export type {
  PaymentDoc,
  PaymentAllocation,
  HydratedPayment,
} from './payment.js';
export { Receipt } from './receipt.js';
export type { ReceiptDoc, HydratedReceipt } from './receipt.js';
export { CreditNote } from './creditNote.js';
export type { CreditNoteDoc, HydratedCreditNote } from './creditNote.js';
export { Ticket } from './ticket.js';
export type {
  TicketDoc,
  HydratedTicket,
  TicketAttachmentDoc,
} from './ticket.js';
export { TicketComment } from './ticketComment.js';
export type {
  TicketCommentDoc,
  HydratedTicketComment,
} from './ticketComment.js';
export { Quiz } from './quiz.js';
export type { QuizDoc, QuizQuestionDoc, HydratedQuiz } from './quiz.js';
export { QuizAttempt } from './quizAttempt.js';
export type {
  QuizAttemptDoc,
  QuizAttemptAnswerDoc,
  HydratedQuizAttempt,
} from './quizAttempt.js';
export { Exam } from './exam.js';
export type { ExamDoc, ExamQuestionDoc, HydratedExam } from './exam.js';
export { ExamAttempt } from './examAttempt.js';
export type {
  ExamAttemptDoc,
  ExamAttemptAnswerDoc,
  ExamAttemptEssayDoc,
  ExamAttemptGradeDoc,
  ExamAttemptRubricScoreDoc,
  HydratedExamAttempt,
} from './examAttempt.js';
export { Rubric } from './rubric.js';
export type { RubricDoc, RubricCriterionDoc, HydratedRubric } from './rubric.js';
export { FeedbackEntry } from './feedbackEntry.js';
export type {
  FeedbackEntryDoc,
  FeedbackScoreDoc,
  HydratedFeedbackEntry,
} from './feedbackEntry.js';
export { DomainEvent } from './domainEvent.js';
export type { DomainEventDoc, HydratedDomainEvent } from './domainEvent.js';
export { NotificationPrefs } from './notificationPrefs.js';
export type {
  NotificationPrefsDoc,
  HydratedNotificationPrefs,
} from './notificationPrefs.js';
export { ApiCostLedger } from './apiCostLedger.js';
export type {
  ApiCostLedgerDoc,
  HydratedApiCostLedger,
} from './apiCostLedger.js';
export { Application } from './admissions/application.js';
export type {
  ApplicationDoc,
  ApplicationDecisionDoc,
  HydratedApplication,
} from './admissions/application.js';
export {
  ApplicationDraft,
  APPLICATION_DRAFT_STEPS,
} from './admissions/applicationDraft.js';
export type {
  ApplicationDraftDoc,
  ApplicationDraftStep,
  HydratedApplicationDraft,
} from './admissions/applicationDraft.js';
export {
  ApplicationDocument,
  APPLICATION_DOCUMENT_TYPES,
} from './admissions/applicationDocument.js';
export type {
  ApplicationDocumentDoc,
  ApplicationDocumentType,
  HydratedApplicationDocument,
} from './admissions/applicationDocument.js';
export {
  Referee,
  RefereeUploadToken,
  REFEREE_STATUSES,
} from './admissions/referee.js';
export type {
  RefereeDoc,
  RefereeUploadTokenDoc,
  RefereeStatus,
  HydratedReferee,
} from './admissions/referee.js';
export {
  AdmissionsAuditLog,
  ReviewerNote,
} from './admissions/admissionsAuditLog.js';
export type {
  AdmissionsAuditLogDoc,
  ReviewerNoteDoc,
  HydratedAdmissionsAuditLog,
  HydratedReviewerNote,
} from './admissions/admissionsAuditLog.js';
export {
  ApplicationFee,
  ApplicationPayment,
  APPLICATION_FEE_STATUSES,
} from './admissions/applicationFee.js';
export type {
  ApplicationFeeDoc,
  ApplicationPaymentDoc,
  ApplicationFeeStatus,
  HydratedApplicationFee,
  HydratedApplicationPayment,
} from './admissions/applicationFee.js';

// M10f — Placement / Jobs (LMS_Requirements §3).
export { Company } from './company.js';
export type { CompanyDoc, HydratedCompany } from './company.js';
export { JobPosting } from './jobPosting.js';
export type { JobPostingDoc, HydratedJobPosting } from './jobPosting.js';
export { JobApplication } from './jobApplication.js';
export type { JobApplicationDoc, HydratedJobApplication } from './jobApplication.js';

// M10e — Internal chat (LMS_Requirements §2).
export { Conversation } from './conversation.js';
export type { ConversationDoc, HydratedConversation } from './conversation.js';
export { ConversationMembership } from './conversationMembership.js';
export type {
  ConversationMembershipDoc,
  HydratedConversationMembership,
} from './conversationMembership.js';
export { ChatMessage } from './chatMessage.js';
export type { ChatMessageDoc, ChatAttachmentDoc, HydratedChatMessage } from './chatMessage.js';

// M10k — Post-conversion student documents (LMS_Requirements §1).
export { StudentDocument } from './studentDocument.js';
export type { StudentDocumentDoc, HydratedStudentDocument } from './studentDocument.js';

// M10s — Visitor Leads (Logan 2026-05-20, "LMS Visitor List Template").
export { VisitorLead } from './visitorLead.js';
export type { VisitorLeadDoc, HydratedVisitorLead } from './visitorLead.js';

// M10u — Staff attendance (LMS_Requirements §4 "students and staff").
export { StaffAttendance } from './staffAttendance.js';
export type { StaffAttendanceDoc, HydratedStaffAttendance } from './staffAttendance.js';

// S3 file metadata (bytes live in S3; this is the per-file index that
// powers the /v1/files/:id resolver).
export { FileMeta } from './fileMeta.js';
export type { FileMetaDoc, HydratedFileMeta } from './fileMeta.js';

// Showcase — marketing collateral (company profile + program brochures)
// staff present in-app. Bytes live in GridFS; this is the section index.
export { ShowcaseDocument } from './showcaseDocument.js';
export type { ShowcaseDocumentDoc, HydratedShowcaseDocument } from './showcaseDocument.js';

// Faculty credentials — admin-recoverable faculty passwords, encrypted at
// rest, isolated from the User doc.
export { FacultyCredential } from './facultyCredential.js';
export type { FacultyCredentialDoc, HydratedFacultyCredential } from './facultyCredential.js';

// Entrance Exam — isolated temporary-candidate assessment module. Separate
// collections so entrance candidates never mix with real Users/Enrollments.
export { EntranceExam } from './entrance/entranceExam.js';
export type {
  EntranceExamDoc,
  EntranceQuestionDoc,
  HydratedEntranceExam,
} from './entrance/entranceExam.js';
export { EntranceCandidate } from './entrance/entranceCandidate.js';
export type {
  EntranceCandidateDoc,
  HydratedEntranceCandidate,
} from './entrance/entranceCandidate.js';
export { EntranceAttempt } from './entrance/entranceAttempt.js';
export type {
  EntranceAttemptDoc,
  EntranceAttemptAnswerDoc,
  HydratedEntranceAttempt,
} from './entrance/entranceAttempt.js';
