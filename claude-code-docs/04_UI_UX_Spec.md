# 04 — UI/UX Specification

**Product:** India Learns LMS
**Version:** 1.0
**Date:** 21 April 2026

Design is already done. Source of truth for components, layouts, and visual language:

- `../webapp/screens-staff.jsx`, `screens-student.jsx`, `screens-student2.jsx`, `screens-extras.jsx`
- `../webapp/components.jsx`, `styles.css`, `responsive.css`
- `../mobile/screens-mobile.jsx`, `ios-frame.jsx`, `components.jsx`, `styles.css`
- Standalone previews: `../webapp/India Learns - Webapp - Standalone.html`, `../mobile/India Learns - Mobile - Standalone.html`

Claude Code **ports** these JSX files into the `web/` workspace (see TRD §2). Do not redesign.

---

## 1. Brand system

### 1.1 Colours

| Role | Hex | Tailwind name (add to config) | Usage |
|---|---|---|---|
| Primary Orange | `#F58220` | `brand-orange` | Headline accents, numeric highlights, bar-chart primary, CTAs on light backgrounds |
| Primary Navy | `#1A3A8F` | `brand-navy` | Speech-bubble / quote blocks, supporting headline, CTA blocks on cream |
| Accent Light Blue | `#6E9BCC` | `brand-sky` | Secondary emphasis in body copy, inactive tabs, meta info |
| Cream Background | `#FBF5E8` | `brand-cream` | Base page background on web |
| White | `#FFFFFF` | `white` | Cards on cream background, reverse text on navy blocks |
| Ink | `#0F1A2E` | `ink` | Body text |
| Muted | `#6B7280` | `muted` | Secondary text, timestamps |
| Success | `#15803D` | `success` | Paid status, confirmations |
| Warning | `#B45309` | `warning` | Warn 1 / Warn 2 banners |
| Danger | `#B91C1C` | `danger` | Suspension, destructive actions |

### 1.2 Typography

Single geometric sans-serif family — **Poppins** (self-hosted via `@fontsource/poppins`). Weights used:

| Tier | Weight | Size (desktop / mobile) | Line height | Tracking |
|---|---|---|---|---|
| Display / Hero | 800 | 48 / 32 | 1.1 | -0.01em |
| H1 | 700 | 32 / 24 | 1.2 | -0.005em |
| H2 | 700 | 24 / 20 | 1.3 | 0 |
| H3 | 600 | 20 / 18 | 1.35 | 0 |
| Body | 400 | 16 / 15 | 1.55 | 0 |
| Small | 500 | 13 / 13 | 1.45 | 0 |
| Micro / caption | 500 | 11 / 11 | 1.4 | 0.02em |

No secondary typeface.

### 1.3 Spacing, radius, shadow

- Spacing scale: Tailwind defaults (`4px` base). Page gutter: `24px` (mobile), `32px` (desktop).
- Cards: `rounded-xl` (`12px`), `shadow-sm` ambient with a 1px `border border-black/5`.
- CTAs: `rounded-full` for primary pills, `rounded-lg` for square buttons.
- Focus ring: 3px `#1A3A8F` at 40% alpha, `outline-offset: 2px`.

### 1.4 Iconography

Lucide React throughout. Strictly 1.5 px stroke, no fills. Sizes: 16, 20, 24.

### 1.5 Imagery

Photography style: bright, classroom-positive, India context. No stock-photo business clichés. Illustrations, if any, reuse the orange/navy palette in flat style.

---

## 2. Layout framework

### 2.1 Breakpoints

| Token | Min-width | Purpose |
|---|---|---|
| `sm` | 640 px | Small phone landscape / very small tablets |
| `md` | 768 px | Tablet portrait |
| `lg` | 1024 px | Desktop |
| `xl` | 1280 px | Wide desktop |

Design targets **375 × 812** (iPhone) and **1440 × 900** (desktop). QA both on every screen.

### 2.2 Shell

- **Desktop shell:** left sidebar (240 px, collapsible to 72 px), top bar (64 px) with logo + search + notification bell + profile, content area on cream background.
- **Mobile shell:** top app bar (56 px) + content + bottom tab bar (5 tabs, from `MTabBar` in `screens-mobile.jsx`). Use same tab layout per role.

### 2.3 Role-specific nav

| Role | Primary nav items |
|---|---|
| Student | Home · Courses · Timetable · Fees · Tickets · Feedback (+ bell) |
| Faculty | Home · My Courses · Grading · Feedback · Timetable · Tickets |
| Finance | Home · Students · Payments · Reports · Tickets |
| Admin | Home · Users · Programs · Courses · Batches · Timetable · Tickets · Fees · Analytics |
| Superadmin | Home · Users · Tickets · Analytics · Audit |

Exact icon choices match existing JSX — do not change.

---

## 3. Screen inventory

Below: every screen to implement, the existing mockup component it maps to, and the API it binds to. If a JSX component is not listed below, treat it as a helper and port it as-is.

### 3.1 Auth & onboarding

| Route | Mockup | API calls |
|---|---|---|
| `/login` | `LoginScreen` in `screens-student.jsx` | POST /auth/login |
| `/onboarding/landing` | `OnbLanding` in `screens-extras.jsx` | — |
| `/onboarding/arrival` | `OnbArrival` | GET /users/me |
| `/onboarding/email-invite` | `OnbEmailInvite` (reference mail preview) | — |
| `/onboarding/set-password` | `OnbSetPassword` | POST /auth/invite/accept |
| `/onboarding/tour` | `OnbTour` | — |

Onboarding tour is a 3-step overlay (dashboard → timetable → support) that appears once on first login.

### 3.2 Student

| Route | Mockup | API |
|---|---|---|
| `/` (dashboard) | `StudentDashboard` in `screens-student.jsx` | GET /me, /me/courses, /me/timetable?week=this, /me/fees/next, /me/feedback?latest=3, /me/tickets?status=open, /me/notifications |
| `/courses` | (list inside dashboard) or `CourseScreen` tab view | GET /me/courses |
| `/courses/:id` | `CourseScreen` | GET /me/courses/:id |
| `/courses/:id/module/:moduleId` | module detail within `CourseScreen` | GET /me/courses/:id/modules/:moduleId |
| `/timetable` | `TimetableScreen` in `screens-student2.jsx` | GET /me/timetable?week= |
| `/fees` | `FeesScreen` | GET /students/:id/fees |
| `/tickets` | `TicketsScreen` | GET /me/tickets |
| `/tickets/new` | `TicketsScreen` → New overlay | POST /tickets |
| `/tickets/:id` | `TicketsScreen` → detail | GET /tickets/:id, POST /tickets/:id/comments |
| `/feedback` | `FeedbackScreen` | GET /me/feedback |
| `/certificates` | `CertificateScreen` in `screens-extras.jsx` | GET /me/certificates |

### 3.3 Faculty

| Route | Mockup | API |
|---|---|---|
| `/` (Faculty dashboard) | `FacultyDashboard` in `screens-staff.jsx` | GET /staff/summary (faculty) |
| `/courses` | (list) | GET /courses?mine=true |
| `/courses/:id/edit` | content editor (within `FacultyDashboard`) | GET /courses/:id, PATCH ... |
| `/grading` | grading queue widget | GET /staff/grading-queue |
| `/grading/:attemptId` | essay grading | POST /exam-attempts/:id/grade |
| `/feedback` | Faculty feedback list | GET /feedback?mine=true |
| `/feedback/new` | rubric + writer | POST /feedback |
| `/rubrics` | templates library | GET/POST /rubrics |
| `/timetable` | `TimetableScreen` read-only | GET /me/timetable |
| `/tickets` | staff ticket view | GET /staff/tickets?category=academic |

### 3.4 Finance

| Route | Mockup | API |
|---|---|---|
| `/` | `FinanceDashboard` in `screens-staff.jsx` | GET /analytics/summary?scope=finance |
| `/students` | search list | GET /users?role=student&q= |
| `/students/:id` | student fees view | GET /students/:id/fees |
| `/students/:id/record-payment` | payment recorder drawer | POST /payments |
| `/payments` | list + filters | GET /payments |
| `/payments/:id` | detail; reverse within 24 h | POST /payments/:id/reverse |
| `/reports` | CSV exports | GET /analytics/collections |
| `/tickets` | finance ticket queue | GET /staff/tickets?category=finance |

### 3.5 Admin

| Route | Mockup | API |
|---|---|---|
| `/` | `AdminDashboard` in `screens-staff.jsx` | GET /analytics/summary |
| `/users` | `AdminStudents`, `AdminFaculty`, `AdminStaff` list (reuse one component with role filter) | GET /users |
| `/users/new` | creation wizard | POST /users |
| `/users/:id` | detail + actions | PATCH /users/:id, POST /users/:id/suspend, /unsuspend, /resend-invite |
| `/programs` · `/programs/:id` | `AdminPrograms` | CRUD /programs |
| `/courses` · `/courses/:id/edit` | `AdminCourses` | CRUD /courses, /modules |
| `/batches` · `/batches/:id` | `AdminBatches` | CRUD /batches, POST /batches/:id/enrol |
| `/timetable` | `AdminTimetable` | timetable CRUD |
| `/fee-structures` | `AdminFeeStructures` | CRUD /fee-structures |
| `/tickets` | `AdminTickets` | GET /tickets |
| `/tickets/sla-breaches` | breach dashboard | GET /analytics/sla-breaches |
| `/analytics` | `AdminDashboard` expanded | various /analytics/* |
| `/audit-logs` | audit list | GET /audit-logs |
| `/holidays` | editable list | GET/POST /holidays |

### 3.6 Superadmin

Subset of Admin with all write buttons hidden. Route map matches `/admin/*` but under `/super/*` with a read-only sidebar label; alternatively gate the admin pages by role and hide writes at render time. **Preferred:** one codebase, permission-aware widgets.

### 3.7 Mobile PWA

Every route above has a mobile layout. Reuse the components in `mobile/screens-mobile.jsx`:

| Mobile component | Reuses |
|---|---|
| `MobileLogin` → `/login` | |
| `MobileOnboarding` → `/onboarding/*` | |
| `MobileDashboard` → `/` (student) | |
| `MobileCourse` → `/courses/:id` | |
| `MobileFees` → `/fees` | |
| `MobileTickets` → `/tickets`, `/tickets/:id` | |
| `MobileFeedback` → `/feedback` | |
| `MobileTimetable` → `/timetable` | |
| `MobileCertificate` → `/certificates` | |
| `MobileFaculty`, `MobileAdmin`, `MobileAdminStudents`, `MobileAdminTickets`, `MobileFinance` → staff roles | |
| `MobileCanvas` | host frame |
| `MTabBar`, `Mhdr`, `Mtab` | bottom nav + top bar |

PWA detail:
- `manifest.webmanifest` with name "India Learns", short name "Learns", 192 + 512 icons, `display: standalone`, theme color `#1A3A8F`, background `#FBF5E8`.
- Service worker (Workbox via `vite-plugin-pwa`) precaches the app shell; runtime caches JSON GET responses (NetworkFirst, 24 h), caches Cloudinary images (CacheFirst, 30 days).
- Offline fallback page: `/offline` with a helpful message and a Retry.
- Push notifications deferred to Phase 2 — do not implement for launch.

---

## 4. Core components (from `components.jsx`)

Port the following (same names) into `web/src/components/`:

- `Layout` (shell) — responsive, per-role.
- `Sidebar`, `TopBar`, `BottomTabs` (mobile).
- `Card`, `StatTile`, `SectionHeader`.
- `Button` (variants: `primary-orange`, `primary-navy`, `ghost`, `danger`).
- `Input`, `Textarea`, `Select`, `DatePicker`, `MoneyInput` (Indian formatting), `PhoneInput` (`+91` default).
- `Table` with sticky header, empty state, and pagination.
- `Badge` (status pills with semantic colours).
- `Modal`, `Drawer`, `Toast` (via `react-hot-toast`).
- `Banner` (for Warn 1 / Warn 2 / Suspended — variants: info / warning / danger / success).
- `NotificationBell` + dropdown.
- `Avatar` with initials fallback.
- `RubricEditor`, `RubricPreview`.
- `CalendarGrid` (week view) + `DayList` (mobile).
- `MarkdownRenderer` (subset: bold, italic, lists, links) — used for free-text comments and notes.
- `PDFInlineViewer` (iframe fallback) — for course PDFs and receipts.

Every component has a Storybook or Vitest render test.

---

## 5. State patterns

- **Loading** — skeletons (grey rounded blocks, not spinners) for list and card content. Full-page spinner only for route transitions.
- **Empty** — two-line helpful prose + CTA. Example: "No tickets yet — something on your mind? → New ticket."
- **Error** — red banner at top of the page with a Retry button. Preserve any unsaved form state.
- **Read-only** for Superadmin — inputs visually disabled but legible; buttons hidden.
- **Saving indicator** — inline near the field being saved (autosave) and a toast on successful save for form submits.

---

## 6. Key flows (annotated)

### 6.1 Student first login

1. Email with magic link → `/onboarding/landing` (3-line welcome + brand illustration).
2. "Continue" → `/onboarding/set-password` (password, confirm, show meter).
3. Submit → `/onboarding/tour` (3 cards over dashboard highlighting Home, Timetable, Support).
4. Finish → `/` dashboard.

### 6.2 Finance records a payment

1. `/finance/students` → search by name/code.
2. Click student → `/finance/students/:id` (fees view with balances).
3. "Record payment" drawer slides in.
4. Enter amount, method, reference; preview auto-allocation (editable).
5. Confirm → success toast, PDF receipt generated, student notified.
6. Row in "Recent payments" updates live (via react-query invalidation).

### 6.3 Suspension banner

- On every route for Students, the shell inspects `user.status`. If `warn1` / `warn2`, show a warning banner with "Amount due" and a CTA to Fees. If `suspended` and route is blocked, render `SuspendedPage` with Fees and Contact Finance CTAs only.

### 6.4 Ticket — student to Academic

1. `/tickets/new` with category select (Complaint disabled + tooltip unless precondition met).
2. Submit → server creates + auto-routes → `/tickets/:id` thread view.
3. Email + in-app to assignee. Student sees SLA countdown.
4. Staff replies → student gets email + in-app + optional WhatsApp.
5. Staff resolves → 7-day auto-close timer starts; student can "Confirm closed" or "Request reopen".

---

## 7. Accessibility (WCAG 2.1 AA)

- Minimum 4.5:1 contrast on text. Brand orange on cream achieves ~3.2:1 at 16 px — so orange is **never** used on cream for body text; use ink on cream. Orange is fine for 24 px+ headings and on white cards.
- All interactive elements focusable; visible focus ring (§1.3).
- Labels associated with inputs via `htmlFor`; errors via `aria-describedby`.
- Skip-to-content link at top of page.
- Screen-reader friendly: landmarks (`<main>`, `<nav>`), ARIA live region for toast and error banners.
- Modals trap focus, close on `Esc`, return focus to trigger on close.
- No information conveyed by colour alone — status pills include icon + label.

---

## 8. Copy guidelines

- First-person for student CTAs ("My courses", "My fees").
- Don't scold — warning banners are firm, not shaming.
- Use "fee installment" not "instalment amount" (consistent).
- Write numbers in Indian formatting (12,34,500).
- Dates: "21 Apr 2026, Mon" (short). Times: "9:45 am IST".
- Titles: sentence case. Only proper nouns capitalised.

---

## 9. Illustration / empty-state art

If the existing mockups don't include an empty state for a screen, generate a simple SVG illustration in brand orange + navy at `web/public/illus/`. Do not pull third-party art under licenses that require attribution unless Logan approves.

---

## 10. QA checklist (per screen)

- [ ] Renders at 375 × 812 and 1440 × 900.
- [ ] Loading state present.
- [ ] Empty state present with CTA.
- [ ] Error state with Retry present.
- [ ] Matches role permissions (writes hidden for Superadmin, etc.).
- [ ] Keyboard navigable, focus visible.
- [ ] Text contrast ≥ 4.5:1 (or 3:1 for ≥ 24 px bold).
- [ ] Screen reader reads labels + state (tested with VoiceOver on macOS).
- [ ] No horizontal scroll on mobile.
- [ ] Works offline after first load (cached app shell).

---

_Next: see `05_Deployment_Runbook.md` for Render + Atlas setup, DNS, cron wiring, and go-live checklist._
