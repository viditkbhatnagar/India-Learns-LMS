# 03 — Technical Requirements Document (TRD)

**Product:** India Learns LMS
**Version:** 1.0
**Date:** 21 April 2026

This is the authoritative technical spec. Where the PRD says "the system allows X", this document specifies **how**: architecture, schema, endpoints, libraries, env vars.

---

## 1. Architecture overview

```
                             ┌────────────────────────────┐
                             │   Render Cron (hourly)     │
                             │  POST /jobs/fee-reminders  │
                             │  POST /jobs/sla-timers     │
                             │  POST /jobs/autosuspend    │
                             └─────────────┬──────────────┘
                                           │ signed JWT
                                           ▼
 ┌─────────────┐   HTTPS   ┌─────────────────────────────┐   TLS   ┌──────────────────┐
 │  Web (PWA)  │ ◀────────▶│ API (Express) — Render Web  │◀───────▶│ MongoDB Atlas     │
 │  Render     │   JWT     │  Node 20, Mongoose 8        │          │  AWS ap-south-1   │
 │  static     │           │                             │          │  (Mumbai)         │
 └─────────────┘           └───┬─────────┬─────────┬─────┘          └──────────────────┘
                               │         │         │
                        Cloudinary   Resend/SG  Meta WABA   Certifier.io
                         (files)     (email)    (WhatsApp)  (certs)
```

**Two Render services + one Render cron job:**
- `il-api` — Node web service (Express), auto-deploy from `main`.
- `il-web` — Static site (Vite build), auto-deploy from `main`.
- `il-cron` — Render cron job hitting `https://api.indialearns.com/jobs/*` with a signed JWT header.

**No separate queue service** for Phase 1. Reminders and SLA work are scheduled by the cron calling idempotent endpoints.

---

## 2. Repository layout

Monorepo with npm workspaces.

```
india-learns/
├─ .github/workflows/ci.yml
├─ api/
│  ├─ src/
│  │  ├─ index.ts                    # boot
│  │  ├─ app.ts                       # express app assembly
│  │  ├─ config/
│  │  │  ├─ env.ts                    # zod-validated env
│  │  │  ├─ db.ts                     # mongoose connect
│  │  │  └─ logger.ts                 # pino
│  │  ├─ middleware/
│  │  │  ├─ auth.ts                   # JWT + role gate
│  │  │  ├─ error.ts                  # error envelope
│  │  │  ├─ rateLimit.ts              # express-rate-limit
│  │  │  ├─ suspend.ts                # blocks suspended students
│  │  │  └─ requestId.ts
│  │  ├─ models/
│  │  │  ├─ user.ts
│  │  │  ├─ program.ts
│  │  │  ├─ course.ts
│  │  │  ├─ module.ts
│  │  │  ├─ batch.ts
│  │  │  ├─ enrollment.ts
│  │  │  ├─ timetableEntry.ts
│  │  │  ├─ timetableOverride.ts
│  │  │  ├─ feeStructure.ts
│  │  │  ├─ invoice.ts
│  │  │  ├─ installment.ts
│  │  │  ├─ payment.ts
│  │  │  ├─ receipt.ts
│  │  │  ├─ creditNote.ts
│  │  │  ├─ ticket.ts
│  │  │  ├─ ticketComment.ts
│  │  │  ├─ rubric.ts
│  │  │  ├─ feedbackEntry.ts
│  │  │  ├─ quiz.ts
│  │  │  ├─ quizAttempt.ts
│  │  │  ├─ exam.ts
│  │  │  ├─ examAttempt.ts
│  │  │  ├─ notification.ts
│  │  │  ├─ notificationPrefs.ts
│  │  │  ├─ auditLog.ts
│  │  │  ├─ inviteToken.ts
│  │  │  ├─ refreshToken.ts
│  │  │  ├─ holiday.ts
│  │  │  └─ index.ts
│  │  ├─ routes/
│  │  │  ├─ auth.ts
│  │  │  ├─ users.ts
│  │  │  ├─ programs.ts
│  │  │  ├─ courses.ts
│  │  │  ├─ modules.ts
│  │  │  ├─ batches.ts
│  │  │  ├─ enrollments.ts
│  │  │  ├─ timetable.ts
│  │  │  ├─ fees.ts
│  │  │  ├─ payments.ts
│  │  │  ├─ tickets.ts
│  │  │  ├─ feedback.ts
│  │  │  ├─ quizzes.ts
│  │  │  ├─ exams.ts
│  │  │  ├─ certificates.ts
│  │  │  ├─ notifications.ts
│  │  │  ├─ analytics.ts
│  │  │  ├─ audit.ts
│  │  │  ├─ holidays.ts
│  │  │  └─ jobs.ts                   # cron endpoints
│  │  ├─ controllers/                 # thin; one file per route
│  │  ├─ services/                    # business logic
│  │  │  ├─ authService.ts
│  │  │  ├─ userService.ts
│  │  │  ├─ courseService.ts
│  │  │  ├─ enrollmentService.ts
│  │  │  ├─ timetableService.ts
│  │  │  ├─ feeService.ts
│  │  │  ├─ paymentService.ts
│  │  │  ├─ receiptService.ts         # PDF generation
│  │  │  ├─ ticketService.ts
│  │  │  ├─ slaService.ts
│  │  │  ├─ feedbackService.ts
│  │  │  ├─ assessmentService.ts
│  │  │  ├─ certificateService.ts
│  │  │  ├─ notificationService.ts
│  │  │  ├─ analyticsService.ts
│  │  │  ├─ suspensionService.ts
│  │  │  └─ auditService.ts
│  │  ├─ integrations/                # swappable adapters
│  │  │  ├─ storage/
│  │  │  │  ├─ index.ts               # StorageService interface
│  │  │  │  ├─ cloudinary.ts
│  │  │  │  └─ stub.ts
│  │  │  ├─ email/
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ resend.ts
│  │  │  │  ├─ sendgrid.ts
│  │  │  │  └─ stub.ts
│  │  │  ├─ whatsapp/
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ meta.ts
│  │  │  │  └─ stub.ts
│  │  │  └─ certifier/
│  │  │     ├─ index.ts
│  │  │     ├─ certifier.ts
│  │  │     └─ stub.ts
│  │  ├─ jobs/
│  │  │  ├─ feeReminders.ts
│  │  │  ├─ slaTimers.ts
│  │  │  ├─ autosuspend.ts
│  │  │  └─ digest.ts
│  │  ├─ utils/
│  │  └─ seed/
│  │     └─ seedAdmin.ts
│  ├─ tests/
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ .env.example
├─ web/
│  ├─ src/
│  │  ├─ main.tsx
│  │  ├─ App.tsx
│  │  ├─ routes.tsx
│  │  ├─ lib/api.ts                   # axios wrapper
│  │  ├─ lib/auth.ts                  # JWT storage + refresh
│  │  ├─ lib/format.ts                # ₹, dates
│  │  ├─ pages/
│  │  │  ├─ auth/Login.tsx
│  │  │  ├─ onboarding/SetPassword.tsx
│  │  │  ├─ student/Dashboard.tsx
│  │  │  ├─ student/Course.tsx
│  │  │  ├─ student/Fees.tsx
│  │  │  ├─ student/Tickets.tsx
│  │  │  ├─ student/Feedback.tsx
│  │  │  ├─ student/Timetable.tsx
│  │  │  ├─ student/Certificates.tsx
│  │  │  ├─ faculty/...
│  │  │  ├─ finance/...
│  │  │  ├─ admin/...
│  │  │  └─ superadmin/...
│  │  ├─ components/                  # ported from /webapp and /mobile JSX
│  │  ├─ hooks/
│  │  ├─ store/                       # zustand for session + notifications
│  │  └─ styles/
│  ├─ public/
│  ├─ vite.config.ts                  # incl. vite-plugin-pwa
│  ├─ tailwind.config.ts
│  ├─ tsconfig.json
│  ├─ package.json
│  └─ .env.example
├─ packages/
│  └─ shared-types/
│     ├─ src/
│     │  ├─ dto/
│     │  ├─ enums.ts
│     │  └─ index.ts
│     └─ package.json
├─ docs/                              # copy of this doc pack
├─ render.yaml                        # Render blueprint
├─ package.json                       # workspaces root
└─ README.md
```

---

## 3. Stack, versions, and allowed dependencies

### 3.1 Runtime

- Node.js **20.12 LTS**
- MongoDB **7.0** on Atlas (AWS ap-south-1 / Mumbai), M10 cluster at launch
- npm 10 (workspaces)
- TypeScript 5.4 throughout

### 3.2 Backend (`api/`)

| Library | Version | Purpose |
|---|---|---|
| express | ^4.19 | HTTP server |
| mongoose | ^8.4 | ODM |
| zod | ^3.23 | env + payload validation |
| argon2 | ^0.40 | password hashing |
| jose | ^5.4 | JWT sign/verify |
| pino + pino-http | ^9.x | structured logs |
| helmet | ^7.x | security headers |
| cors | ^2.x | CORS |
| express-rate-limit | ^7.x | brute-force protection |
| nanoid | ^5.x | short IDs (for code fields) |
| date-fns + date-fns-tz | ^3.x | dates |
| pdfkit | ^0.15 | PDF (receipts, credit notes) |
| axios | ^1.7 | outbound HTTP (integrations) |
| multer | ^1.4 | uploads (to Cloudinary) |
| cloudinary | ^2.x | file SDK |
| vitest + supertest | ^1.x / ^6.x | tests |

### 3.3 Frontend (`web/`)

| Library | Version | Purpose |
|---|---|---|
| react + react-dom | ^18.3 | UI |
| react-router-dom | ^6.25 | routing |
| vite | ^5.3 | build |
| vite-plugin-pwa | ^0.20 | PWA |
| tailwindcss | ^3.4 | styling |
| @tanstack/react-query | ^5.x | server state |
| zustand | ^4.x | client state (session, notification bell) |
| axios | ^1.7 | HTTP |
| zod | ^3.23 | form + response validation |
| react-hook-form | ^7.x | forms |
| date-fns + date-fns-tz | ^3.x | dates |
| recharts | ^2.12 | dashboard charts |
| lucide-react | ^0.3 | icons |

### 3.4 Not allowed (without a `DEPENDENCY_REQUEST.md`)

No: `bcrypt`, `jsonwebtoken` (replaced by `jose`), `moment`, `redux`, `mongoose-paginate` (use cursor pagination), `lodash` (use native / tiny utilities).

---

## 4. Data model — Mongoose schemas

All schemas include:
- `_id: ObjectId`
- `createdAt` / `updatedAt` (Mongoose `timestamps: true`)
- soft-delete fields where indicated: `deletedAt: Date | null`

Money is always stored as **integer paise** in a field ending in `Paise`. Currency is INR only.

Enums are defined in `packages/shared-types/src/enums.ts` and imported everywhere.

### 4.1 User

```ts
// models/user.ts
const UserSchema = new Schema({
  role: { type: String, enum: ['admin','superadmin','finance','faculty','student'], required: true, index: true },
  code: { type: String, unique: true, sparse: true },       // IL-2026-0001 for students, faculty etc
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  phoneE164: { type: String, required: true },              // +91...
  passwordHash: { type: String },                            // argon2id, null until set-password
  passwordUpdatedAt: Date,
  passwordHistoryHashes: [{ type: String }],                 // last 3
  status: { type: String, enum: ['pending','active','suspended','revoked'], default: 'pending', index: true },
  suspensionKind: { type: String, enum: [null,'manual','fees'], default: null },
  suspensionReason: String,
  suspensionOverrideUntil: Date,
  suspensionOverrideBy: { type: ObjectId, ref: 'User' },
  lastLoginAt: Date,
  loginFailCount: { type: Number, default: 0 },
  lockedUntil: Date,
  // Student-only:
  programId: { type: ObjectId, ref: 'Program' },
  batchId: { type: ObjectId, ref: 'Batch', index: true },
  enrolmentValidFrom: Date,
  enrolmentValidTo: Date,
  // Staff flags:
  deptTag: { type: String, enum: [null,'operations','it','academics','finance','senior_mgmt'], default: null },
  isCourseCoordinator: { type: Boolean, default: false },
  // Device/session:
  sessionCap: { type: Number, default: 5 },
  deletedAt: Date,
}, { timestamps: true });

UserSchema.index({ role: 1, batchId: 1, status: 1 });
```

### 4.2 Program, Course, Module

```ts
// models/program.ts
{ name, slug, description, isActive }

// models/course.ts
{
  programId, name, slug, summary,
  state: 'sandbox' | 'published',
  publishedAt: Date,
  publishedVersion: Number,            // increments each publish
  sequential: Boolean,                 // if true, modules unlock in order
  certificateTemplateId: String,       // Certifier.io template id
  deletedAt: Date,
}

// models/module.ts
{
  courseId, title, order: Number,
  content: [
    {
      kind: 'video' | 'pdf' | 'text' | 'quizRef',
      title: String,
      // if video:
      videoUrl: String,                  // Cloudinary/YouTube/Vimeo
      // if pdf:
      pdfUrl: String,
      allowDownload: { type: Boolean, default: false },
      // if text:
      textMarkdown: String,
      // if quizRef:
      quizId: { type: ObjectId, ref: 'Quiz' },
    }
  ],
}
```

### 4.3 Batch

```ts
// models/batch.ts
{
  programId, name,
  startDate: Date, endDate: Date,
  capacity: { type: Number, default: 30 },
  status: 'planned' | 'active' | 'completed' | 'archived',
  coordinators: [{ type: ObjectId, ref: 'User' }],    // faculty coordinators
}
```

### 4.4 Enrollment

```ts
// models/enrollment.ts
{
  studentId, batchId, courseId,
  validFrom: Date, validTo: Date,
  status: 'active' | 'expired' | 'revoked',
  completed: Boolean,
  completedAt: Date,
  certificateUrl: String,              // set after Certifier issue
  certificateIssuedAt: Date,
}

// Unique index: { studentId, courseId, status='active' } to prevent duplicate active enrolment
EnrollmentSchema.index(
  { studentId: 1, courseId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
```

### 4.5 Timetable

```ts
// models/timetableEntry.ts
{
  batchId, courseId, facultyId,
  dayOfWeek: Number,                    // 0=Sun..6=Sat
  startTimeMinutes: Number,             // minutes from 00:00 IST
  endTimeMinutes: Number,
  room: String, notes: String,
}

// models/timetableOverride.ts
{
  batchId, date: Date,                  // YYYY-MM-DD in IST
  entryId: ObjectId,                    // the recurring entry being overridden
  action: 'cancel' | 'reschedule',
  newStartMinutes: Number, newEndMinutes: Number, newFacultyId: ObjectId, newRoom: String,
  reason: String,
}
```

### 4.6 Fees — structure, invoices, installments, payments, receipts

```ts
// models/feeStructure.ts
{
  programId,
  name: String,                                     // "Aviation 300h — 2026 Batch 1"
  components: [
    {
      kind: 'registration' | 'tuition' | 'exam' | 'certification' | 'misc',
      label: String,
      amountPaise: Number,
      cadence: 'one_time' | 'monthly_x',
      monthlyCount: Number,                         // if monthly_x
      dueRule: 'on_enrolment' | 'first_of_month' | 'exam_scheduled' | 'month_before_end' | 'manual',
    }
  ],
  paymentTerms: String,                             // free-text shown to student
}

// models/invoice.ts  (one per enrolment per component)
{
  enrollmentId, studentId, feeStructureId,
  componentKind, componentLabel,
  totalPaise: Number, paidPaise: Number, balancePaise: Number,
  status: 'open' | 'settled' | 'waived' | 'cancelled',
}

// models/installment.ts
{
  invoiceId, studentId,
  label: String,                                    // "September 2026"
  amountPaise: Number,
  dueDate: Date,
  paidPaise: Number,
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived',
  remindersSent: [{ template: String, at: Date }],
}

// models/payment.ts
{
  studentId, receivedAt: Date,
  amountPaise: Number,
  method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other',
  reference: String,
  allocations: [ { installmentId, amountPaise } ],
  receivedByUserId: ObjectId,                        // finance staff
  notes: String,
  reversed: Boolean,
  reversedAt: Date,
  creditNoteId: ObjectId,
}

// models/receipt.ts
{
  code: String,                                      // RCP-2026-000001
  paymentId, studentId,
  pdfUrl: String, pdfKey: String,                    // Cloudinary
  issuedAt: Date, issuedByUserId,
}

// models/creditNote.ts
{
  code: String, paymentId, studentId,
  reason: String, pdfUrl: String, issuedAt: Date,
}
```

### 4.7 Tickets

```ts
// models/ticket.ts
{
  code: String,                                      // TKT-ACAD-000045
  category: 'academic' | 'administration' | 'finance' | 'technical' | 'complaints',
  priority: 'low' | 'medium' | 'high' | 'urgent',    // complaints default urgent
  studentId,
  linkedCourseId: ObjectId,
  linkedInvoiceId: ObjectId,
  subject: String, description: String,
  state: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed',
  assigneeUserId: ObjectId,
  assignedAt: Date,
  firstAckAt: Date,
  resolvedAt: Date, resolutionNote: String, resolvedByUserId,
  closedAt: Date,
  slaAckDeadline: Date,                              // createdAt + 24h
  slaResolveDeadline: Date,                          // createdAt + 5d (or 15 business days for complaints)
  slaAckBreached: Boolean, slaResolveBreached: Boolean,
  parentTicketId: ObjectId,                          // for reopen-requests and complaint precondition link
  reopenedFromId: ObjectId,
  attachments: [{ url, name, size }],
}

// models/ticketComment.ts
{ ticketId, authorUserId, body, visibility: 'public' | 'internal', attachments, at: Date }
```

### 4.8 Feedback

```ts
// models/rubric.ts
{
  courseId,
  name: String,
  criteria: [
    { label: String, kind: 'numeric' | 'scale', scale: [String] /* if scale */, maxScore: Number /* if numeric */ }
  ],
  isTemplate: Boolean,
}

// models/feedbackEntry.ts
{
  studentId, courseId, moduleId: ObjectId, facultyId,
  level: 'assignment' | 'module' | 'assessment',
  rubricId: ObjectId,
  scores: [ { criterionIndex: Number, score: Number | null, label: String | null } ],
  comments: String, summary: String,
  status: 'draft' | 'published',
  publishedAt: Date,
}
```

### 4.9 Assessments

```ts
// models/quiz.ts
{
  moduleId, title, durationMinutes: Number | null,
  maxAttempts: Number, passingPercent: Number,
  questions: [
    { text: String, kind: 'mcq_single' | 'mcq_multi',
      options: [String], correctIndices: [Number], points: Number }
  ],
  state: 'draft' | 'scheduled' | 'live' | 'closed',
  openAt: Date, closeAt: Date,
}

// models/quizAttempt.ts
{
  quizId, studentId, startedAt, submittedAt,
  answers: [ { questionIndex, chosenIndices: [Number] } ],
  scorePercent: Number, passed: Boolean,
}

// models/exam.ts
{
  courseId, title, durationMinutes, maxAttempts, passingPercent,
  questions: [
    { text, kind: 'mcq_single' | 'mcq_multi' | 'essay',
      options, correctIndices, points,
      rubricId: ObjectId, wordLimit: Number }
  ],
  state, openAt, closeAt,
}

// models/examAttempt.ts
{
  examId, studentId, startedAt, submittedAt,
  answers: [ { questionIndex, chosenIndices, essayText } ],
  mcqScore, essayScore,
  totalScorePercent, passed,
  grades: [ { questionIndex, score, comment, rubricScores } ],
  graderUserId, gradedAt,
}
```

### 4.10 Notifications & preferences

```ts
// models/notification.ts
{ userId, type: String, title, body, actionUrl, meta: Mixed, readAt: Date }

// models/notificationPrefs.ts
{ userId, emailByType: { [type]: boolean }, whatsappByType: { [type]: boolean } }
```

### 4.11 Auth tokens

```ts
// models/inviteToken.ts
{ userId, token: String /* hashed */, expiresAt: Date, usedAt: Date, kind: 'invite'|'reset' }

// models/refreshToken.ts
{ userId, tokenHash: String, deviceId, ua, ip, createdAt, revokedAt, rotatedFromId }
```

### 4.12 Audit log, holidays

```ts
// models/auditLog.ts
{ actorUserId, action: String, targetType: String, targetId: ObjectId, before: Mixed, after: Mixed, ip: String, ua: String, at: Date }

// models/holiday.ts
{ date: Date, name: String, kind: 'public' | 'institutional' }
```

### 4.13 Indexes (summary)

- `users { email: 1 }` unique, `{ role: 1, batchId: 1, status: 1 }`
- `enrollments { studentId: 1, courseId: 1 }` partial-unique on `status:'active'`
- `installments { dueDate: 1, status: 1 }` — drives the reminder cron
- `tickets { state: 1, slaResolveDeadline: 1 }`
- `auditLogs { at: -1 }`
- TTL on `inviteToken.expiresAt` (auto-expire)

---

## 5. REST API surface

**Base URL:** `https://api.indialearns.com`
**Versioning:** path-prefix `/v1` on every route.
**Content-Type:** `application/json; charset=utf-8`.
**Authorization:** `Authorization: Bearer <accessJWT>` (except `/auth/*` public routes).
**Pagination:** cursor-based: `?cursor=<id>&limit=20`. Response `{ items, nextCursor }`.
**Filtering:** simple query-params per route, documented inline.
**Sorting:** `?sort=field` or `?sort=-field`.
**Response envelope:** `{ data }` on success, `{ error: { code, message, details? } }` on failure.

### 5.1 Auth

| Method | Path | Body / query | Auth | Role |
|---|---|---|---|---|
| POST | `/v1/auth/login` | `{ email, password }` | public | any |
| POST | `/v1/auth/refresh` | (cookie) | public | any |
| POST | `/v1/auth/logout` | — | Bearer | any |
| POST | `/v1/auth/invite/accept` | `{ token, password }` | public | any |
| POST | `/v1/auth/password/reset/request` | `{ email }` | public | any |
| POST | `/v1/auth/password/reset/confirm` | `{ token, password }` | public | any |
| POST | `/v1/auth/password/change` | `{ current, next }` | Bearer | any |

### 5.2 Users

| Method | Path | Role |
|---|---|---|
| GET | `/v1/users` — `?role=&status=&q=` | admin, superadmin |
| POST | `/v1/users` — create student/faculty/finance/admin | admin |
| GET | `/v1/users/:id` | admin/superadmin; self |
| PATCH | `/v1/users/:id` | admin; self (subset) |
| POST | `/v1/users/:id/suspend` — `{ reason }` | admin |
| POST | `/v1/users/:id/unsuspend` | admin |
| POST | `/v1/users/:id/resend-invite` | admin |
| GET | `/v1/users/me` | any |

### 5.3 Programs / Courses / Modules

- `GET/POST /v1/programs`, `GET/PATCH /v1/programs/:id`
- `GET/POST /v1/courses`, `GET/PATCH /v1/courses/:id`
- `POST /v1/courses/:id/publish`, `POST /v1/courses/:id/unpublish`
- `GET/POST /v1/courses/:id/modules`, `PATCH/DELETE /v1/modules/:id`
- Students read their courses via `GET /v1/me/courses` and `GET /v1/me/courses/:id`.

### 5.4 Batches / Enrolments

- `GET/POST /v1/batches`, `PATCH /v1/batches/:id`
- `POST /v1/batches/:id/enrol` — `{ studentIds: [] }` (mass enrol into all program courses)
- `GET /v1/enrollments?studentId=&batchId=&courseId=`
- `POST /v1/enrollments` — single enrolment
- `POST /v1/enrollments/:id/revoke`

### 5.5 Timetable

- `GET /v1/batches/:id/timetable` — recurring + upcoming overrides
- `POST /v1/batches/:id/timetable` — add entry
- `PATCH/DELETE /v1/timetable/:entryId`
- `POST /v1/timetable/overrides` — add date override
- `GET /v1/me/timetable?week=2026-W30`

### 5.6 Fees

- `GET/POST /v1/fee-structures`, `PATCH /v1/fee-structures/:id`
- `POST /v1/enrollments/:id/generate-fees` — creates invoices + installments for an enrolment
- `GET /v1/students/:id/fees` — full fees view (balances, installments, payments)
- `POST /v1/payments` — record a payment (finance)
- `POST /v1/payments/:id/reverse` — finance within 24 h
- `GET /v1/receipts/:id/download` — returns PDF
- `POST /v1/fees/reminders/send/:installmentId` — admin manual send (idempotent)

### 5.7 Tickets

- `GET /v1/tickets` (admin/superadmin); `GET /v1/me/tickets` (student); `GET /v1/staff/tickets` (faculty/finance)
- `POST /v1/tickets` — student creates (server rejects complaint if precondition not met)
- `GET /v1/tickets/:id` — ACL applied
- `POST /v1/tickets/:id/comments`
- `POST /v1/tickets/:id/state` — `{ to: 'assigned'|'in_progress'|'resolved'|'closed', note? }` (staff)
- `POST /v1/tickets/:id/reopen-request` (student, within 7 days of close)
- `POST /v1/tickets/:id/reopen` (staff, within 7 days of close)

### 5.8 Feedback

- `GET/POST /v1/rubrics`
- `GET/POST /v1/feedback` — `?studentId=&courseId=&moduleId=`
- `PATCH /v1/feedback/:id` (draft → published, or edit draft)
- `GET /v1/me/feedback`

### 5.9 Assessments

- `GET/POST /v1/quizzes`, `PATCH /v1/quizzes/:id`
- `POST /v1/quizzes/:id/attempt` (start), `POST /v1/quiz-attempts/:id/submit`
- `GET /v1/exams`, `POST /v1/exams`, `PATCH /v1/exams/:id`
- `POST /v1/exams/:id/attempt`, `POST /v1/exam-attempts/:id/submit`
- `POST /v1/exam-attempts/:id/grade` (faculty) — `{ grades: [...] }`

### 5.10 Certificates

- `POST /v1/enrollments/:id/issue-certificate` — admin trigger; idempotent
- `GET /v1/me/certificates`

### 5.11 Notifications

- `GET /v1/me/notifications?unreadOnly=true`
- `POST /v1/me/notifications/:id/read`
- `GET/PATCH /v1/me/notification-prefs`

### 5.12 Analytics, Audit, Holidays

- `GET /v1/analytics/summary` (admin/superadmin) — dashboard tiles
- `GET /v1/analytics/collections?from=&to=`
- `GET /v1/analytics/sla-breaches?week=`
- `GET /v1/audit-logs?from=&to=&actor=&action=` (admin)
- `GET/POST /v1/holidays`

### 5.13 Jobs (internal)

Requires `X-Job-Signature: Bearer <jobJWT>` (HS256 signed by `JOB_SECRET`). Called only by Render cron.

- `POST /v1/jobs/fee-reminders` — scans installments, sends due reminders.
- `POST /v1/jobs/sla-timers` — computes breaches, emits alerts.
- `POST /v1/jobs/autosuspend` — evaluates student fee-status state machine.
- `POST /v1/jobs/digest-faculty-weekly` — faculty weekly feedback-coverage email.

---

## 6. Services (business logic)

Thin controller → service → model. Key services:

- **authService** — `invite(user)`, `acceptInvite(token, password)`, `login(email, password, ctx)`, `refresh(rtId)`, `logout(rtId)`, `requestReset(email)`, `resetPassword(token, password)`, `changePassword(userId, cur, next)`.
- **suspensionService** — single source of truth for evaluating a student's access gate. Called by `suspend` middleware and `autosuspend` job. Pure function: `(student, now) -> { accessible: boolean, reason?: string, stage?: 'warn1'|'warn2'|'suspended'|'override'|'manual' }`.
- **feeService** — `generateInstallments(enrollment)`, `getStudentFees(studentId)`, `evaluateReminderWindow(installment, now)`.
- **paymentService** — `recordPayment(dto)`, `reversePayment(id)`. Handles atomic allocations in a Mongo transaction; calls `receiptService.generate()` on success.
- **receiptService** — `generate(payment)` writes PDF via pdfkit → uploads to Cloudinary → stores `Receipt { pdfUrl, pdfKey }`. `creditNote()` similarly.
- **ticketService** — `create(dto)`, `assign(ticket)`, `addComment(...)`, `transition(ticket, to)`, `reopen(...)`. Precondition check for Complaints lives here.
- **slaService** — `computeBreaches()` for the cron; `isBusinessDaysOverdue(from, to, holidays)` helper.
- **feedbackService** — `upsertDraft()`, `publish(id)` (fires notification on publish).
- **assessmentService** — `startAttempt()`, `submitAttempt()`, `grade(attemptId, grades)` with total recompute.
- **certificateService** — `issue(enrollmentId)` idempotent; calls Certifier adapter.
- **notificationService** — single fan-out entry point: `notify({ userId, type, vars, channels? })`. Resolves prefs, dispatches to email + whatsapp adapters + creates in-app row.
- **analyticsService** — pre-aggregated counts; cache 5 min.
- **auditService** — `log({ actor, action, target, before, after, ctx })`.

---

## 7. Auth implementation details

- **Passwords:** Argon2id with `timeCost=3, memoryCost=65536, parallelism=1`.
- **Access token:** HS256, 15 min. Claims: `{ sub, role, status, batchId, iss:'il', aud:'web', jti }`.
- **Refresh token:** opaque 256-bit random → store `sha256` of it in `refreshTokens`. TTL 14 days, rotated on every use. Cookie: `__Host-il_rt`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/v1/auth/refresh`.
- **CSRF:** not applicable to the access token (Bearer), and refresh route accepts only POST with SameSite=Strict cookie (no CSRF vector).
- **Magic link token:** 32-byte random, stored hashed, 7-day TTL, single-use.
- **Password reset token:** 32-byte random, stored hashed, 30-min TTL.
- **Login rate limit:** 5 attempts / 15 min / IP, plus `loginFailCount` locks account 30 min after 10 failures in a rolling hour.
- **Session cap:** upon a 6th refresh-token issuance, revoke the oldest one.
- **Permission middleware:** `requireRole('admin','finance')` using decoded JWT. For resource-scoped checks (faculty owning a course), a secondary check hits the model.

---

## 8. Error envelope and error codes

Error envelope: `{ error: { code, message, details? } }` with appropriate HTTP status (400/401/403/404/409/422/429/500).

Canonical codes:

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No/invalid token |
| `FORBIDDEN` | 403 | Role doesn't allow this |
| `SUSPENDED_ACCESS` | 403 | Student suspended — blocked page |
| `TOKEN_USED` | 410 | Magic link already consumed |
| `TOKEN_EXPIRED` | 410 | Magic/reset link expired |
| `USER_EXISTS` | 409 | Duplicate email |
| `BATCH_FULL` | 409 | Capacity reached |
| `DUPLICATE_ACTIVE_ENROLMENT` | 409 | Already enrolled |
| `COMPLAINT_PRECONDITION_UNMET` | 409 | No prior resolved/closed ticket |
| `TICKET_STATE_INVALID` | 409 | Bad transition (e.g., reopen after 7 days) |
| `INSTALLMENT_NOT_PENDING` | 409 | Allocating to non-pending installment |
| `PAYMENT_REVERSE_WINDOW` | 409 | Past the 24-h window |
| `VALIDATION_FAILED` | 422 | Zod errors |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTEGRATION_FAILED` | 502 | Upstream provider error (retryable) |
| `INTERNAL` | 500 | Unexpected |

---

## 9. Integrations (adapter interfaces)

All integrations live behind a TypeScript interface with a stub implementation for dev.

### 9.1 StorageService (Cloudinary)

```ts
interface StorageService {
  upload(input: { buffer: Buffer; filename: string; folder: string; contentType: string; }): Promise<{ url: string; key: string; }>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, ttlSec?: number): Promise<string>;  // for PDFs
}
```

Cloudinary folders: `il/receipts/`, `il/course-pdfs/`, `il/course-videos/`, `il/avatars/`, `il/ticket-attachments/`. Max size: 500 MB videos, 25 MB PDFs.

### 9.2 EmailService

```ts
interface EmailService {
  send(input: { to: string; subject: string; html: string; text: string; templateId?: string; vars?: Record<string, unknown>; tag?: string; }): Promise<{ providerId: string }>;
}
```

Primary: Resend. Fallback wrapper retries once on Resend failure via SendGrid. Sender: `notifications@app.indialearns.com`. All emails sent through `notificationService.notify` — do not send email directly.

### 9.3 WhatsAppService (Meta WABA)

```ts
interface WhatsAppService {
  sendTemplate(input: { toE164: string; templateName: string; languageCode: string; vars: string[]; mediaUrl?: string; }): Promise<{ providerId: string }>;
}
```

Templates required at launch (pre-approve with Meta):

| templateName | languageCode | body (placeholder-safe) | Variables |
|---|---|---|---|
| `il_fee_due` | `en` | "Hi {{1}}, your {{2}} fee of ₹{{3}} is due on {{4}}. Log in: {{5}}" | name, component, amount, date, url |
| `il_payment_received` | `en` | "Hi {{1}}, we've received ₹{{2}} towards {{3}}. Receipt: {{4}}" | name, amount, component, receiptUrl |
| `il_ticket_update` | `en` | "Hi {{1}}, your ticket {{2}} has a new update. Status: {{3}}. View: {{4}}" | name, ticketCode, status, url |

Gate behind `WHATSAPP_ENABLED=true`. Dev stub logs the payload.

### 9.4 CertificateService (Certifier.io)

```ts
interface CertificateService {
  issue(input: { studentName: string; email: string; courseName: string; completionDate: Date; templateId: string; }): Promise<{ certificateUrl: string; providerId: string; }>;
}
```

Idempotency key: `enrollment._id`. If Certifier returns a duplicate, capture the existing URL.

---

## 10. Jobs (cron)

All cron endpoints:
- Are POST-only.
- Require `Authorization: Bearer <JOB_JWT>` signed by `JOB_SECRET` with claim `{ iss:'render-cron', aud:'il-api' }`, 5-min TTL.
- Are idempotent. Re-running the same job for the same minute must not duplicate side effects.
- Return `{ processed: number, skipped: number, errors: [] }`.

### 10.1 Schedule (Render cron)

| Cron | Endpoint | Purpose |
|---|---|---|
| `0 * * * *` (hourly) | `/v1/jobs/fee-reminders` | Scan installments, send due reminders (idempotency `installmentId:templateId`). |
| `5,35 * * * *` (every 30 min) | `/v1/jobs/sla-timers` | Check open tickets for breaches, emit alerts once per breach threshold. |
| `30 3 * * *` (03:30 IST daily) | `/v1/jobs/autosuspend` | Evaluate student fee-status state machine. |
| `0 9 * * 1` (Mon 09:00 IST) | `/v1/jobs/digest-faculty-weekly` | Faculty digest. |

---

## 11. Security

- Helmet defaults + `contentSecurityPolicy` configured for the web origin and Cloudinary.
- HTTPS everywhere. HSTS 1 year.
- Cookies: `__Host-` prefix, `HttpOnly`, `Secure`, `SameSite=Strict` for refresh.
- Rate-limit `/auth/*` routes (tighter) and a global 600 req / IP / min default.
- Input validation with zod on every route; reject unknown fields.
- Output encoding — never interpolate user text into HTML without escaping (emails especially).
- MongoDB: dedicated DB user with read/write only on its DB; no admin privileges in app string.
- Secrets only in Render env; never committed. `.env.example` is the only committed env file.
- Audit log — read-only from the UI; writes only via `auditService`.
- PII minimisation — no DOB, no national ID in schema unless added later with explicit approval.
- DPDP Act readiness:
  - User can request data export (`POST /v1/me/export-data` returns a signed URL; cron assembles a JSON zip).
  - User can request deletion (`POST /v1/me/delete`) — soft-deletes and PII-scrubs the User, Enrollments, Tickets (author replaced with "Deleted User"). Hard deletion after 90 days.

---

## 12. Environment variables

Validate on boot with `zod`. Missing or malformed values must fail fast.

**API (`api/.env.example`):**

```
NODE_ENV=production
PORT=10000

# Mongo
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/il_prod?retryWrites=true

# JWT
JWT_SECRET=change-me                       # 64 random bytes base64
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=14d
JOB_SECRET=change-me                       # used only to sign cron JWTs

# Web origin
WEB_ORIGIN=https://app.indialearns.com
API_ORIGIN=https://api.indialearns.com
COOKIE_DOMAIN=.indialearns.com

# Email (Resend primary, SendGrid fallback)
EMAIL_PROVIDER=resend                       # resend | sendgrid | stub
RESEND_API_KEY=
SENDGRID_API_KEY=
EMAIL_FROM="India Learns <notifications@app.indialearns.com>"

# WhatsApp
WHATSAPP_ENABLED=false
META_WABA_PHONE_ID=
META_WABA_ACCESS_TOKEN=

# Storage
STORAGE_PROVIDER=cloudinary                 # cloudinary | stub
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Certifier
CERTIFIER_ENABLED=false
CERTIFIER_API_KEY=
CERTIFIER_DEFAULT_TEMPLATE_ID=

# Receipts / org
RECEIPT_ORG_NAME="India Learns (LUC)"
RECEIPT_ORG_ADDRESS="PENDING"
RECEIPT_ORG_GSTIN=""
RECEIPT_LOGO_URL=                            # Cloudinary URL of logo

# Security
LOGIN_RATE_MAX=5
LOGIN_RATE_WINDOW_MIN=15
LOGIN_LOCK_AFTER=10
LOGIN_LOCK_DURATION_MIN=30

# Logging
LOG_LEVEL=info
```

**Web (`web/.env.example`):**

```
VITE_API_BASE=https://api.indialearns.com/v1
VITE_APP_ORIGIN=https://app.indialearns.com
VITE_SENTRY_DSN=
VITE_ENABLE_PWA=true
```

---

## 13. Testing strategy

- Unit tests (Vitest) on every service function.
- Integration tests (supertest) per route group. Mongo backed by `mongodb-memory-server` in CI.
- End-to-end smoke via Playwright (optional but recommended for login → dashboard → view course).
- Fixtures: a `fixtures/` builder module that creates users, programs, courses, batches, fees.
- Coverage gate: 70 % line coverage on `api/src/services`. Fail CI below.

---

## 14. Observability

- `pino` JSON logs with `requestId`.
- `/healthz` returns `{ ok: true, db: 'up', uptimeSec, version }`.
- `/readyz` returns 503 until Mongo connected.
- Error tracking: Sentry (backend + web), DSN via env.
- Metrics: simple counters emitted via logs for `payment.recorded`, `ticket.breach`, `autosuspend.fired`, `certificate.issued`.

---

## 15. Performance targets (Phase 1)

- API P50 < 150 ms, P95 < 500 ms (simple GETs).
- PDF receipt generation < 1.5 s on the median.
- Fee-reminder cron processes 5,000 pending installments in < 30 s.
- Frontend first meaningful paint on 4G < 3 s.

Design for 1,000 concurrent users. Single M10 Mongo + single Render Standard service with autoscale off is adequate for Phase 1.

---

## 16. Migration / evolution

- Every Mongoose model change ships with a migration script under `api/src/migrations/<timestamp>_<name>.ts`, executed via `npm run migrate` on deploy (idempotent).
- Schema versioning: add a `_sv` field to records that ever change shape. Read-path adapters tolerate older shapes for one major version.

---

_Next: see `04_UI_UX_Spec.md` for brand system and screen-by-screen inventory._
