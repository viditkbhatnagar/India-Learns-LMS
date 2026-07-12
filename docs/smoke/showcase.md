# Smoke — Showcase (staff marketing collateral)

**Feature:** Admin / Superadmin / Faculty can browse the India Learns company
profile + program brochures and present each one full-screen, in-app.
Students never see it.

## What was built

- **Model** `ShowcaseDocument` (`api/src/models/showcaseDocument.ts`) — a small
  index over the PDFs (slug, title, description, category, `fileId`, size,
  order, active). The bytes live in the shared `il_files` GridFS bucket.
- **Route** `GET /v1/showcase`, `GET /v1/showcase/:id`, and
  `GET /v1/showcase/:id/file` (`api/src/routes/showcase.ts`) — all
  `requireAuth` + `requireRole('admin','superadmin','faculty')`. The bytes are
  served by the **staff-gated** `/:id/file` route (which resolves the GridFS id
  server-side), NOT the shared auth-only `/v1/files/:id` — so the raw `fileId`
  is never exposed and students can't reach the bytes even with an id.
- **CSP** (`api/src/app.ts`) — in single-service prod the API serves the SPA,
  so helmet's CSP governs the page. `frame-src 'self' blob:` is set explicitly
  so the viewer's `<iframe src="blob:…">` isn't blocked (the default
  `default-src 'self'` does not cover the `blob:` scheme).
- **Seed** `npm run seed:showcase -w api` (`api/scripts/seed-showcase.ts`) —
  streams the 3 PDFs straight into GridFS via `MongoStorageAdapter` (bypasses
  the 5 MB HTTP upload cap; provider-independent so it serves in dev + prod).
- **Web** `/showcase` (`web/src/pages/staff/Showcase.tsx`) — card list +
  in-app viewer that fetches the PDF as an authed blob and renders it in an
  `<iframe>` with a fullscreen "present" mode. Nav item added for
  admin/superadmin/faculty.

## One-time ingestion

The 3 PDFs are gitignored (≈120 MB). Run the seed against each environment
with the files present locally:

```bash
# Local dev DB (the PDFs sit at the repo root by default):
MONGODB_URI="<dev-uri>" npm run seed:showcase -w api

# Prod Atlas (run from a machine that has the PDFs):
MONGODB_URI="<prod-atlas-uri>" SHOWCASE_DIR="/path/to/pdfs" npm run seed:showcase -w api

# Re-upload everything (e.g. brochures updated):
SHOWCASE_RESET=1 npm run seed:showcase -w api
```

Idempotent: skips docs already ingested; re-run with `SHOWCASE_RESET=1` to
replace bytes (old GridFS object is deleted first, no orphans).

## Manual walkthrough

1. Seed (above). Expect console summary `{ created: [...3...], ... }`.
2. Log in as **faculty** → sidebar shows **Showcase** → open `/showcase`.
   - Three cards render (Company profile + 2 program brochures) with category
     badges and PDF sizes.
3. Click **Present ↗** on any card.
   - Loading bar shows download %, then the PDF renders in the in-app viewer.
   - **Fullscreen** enters presentation mode; **Esc** / **Close ✕** returns.
   - **Open in new tab** opens the same blob as a fallback.
4. Log in as **admin** and **superadmin** → same section is present and works.
5. Log in as a **student** → **no** Showcase nav item; `GET /v1/showcase`
   returns **403**; direct navigation to `/showcase` redirects (role guard).

## Automated coverage

- `api/tests/unit/showcaseService.test.ts` — list ordering/active filter, DTO
  mapping (no `fileId` leak), upsert-by-slug create→update, re-activate, 404 for
  invalid/inactive.
- `api/tests/integration/showcase.test.ts` — list admin/faculty 200 + student
  403 + 401; `GET /:id` 200 + 404-for-inactive; **`GET /:id/file`**: real GridFS
  byte round-trip 200 (content-type + length), student 403, 401, 404-missing-bytes.

## Pre-existing fix bundled here

`api/src/integrations/mongoStorageAdapter.ts` (and `migrateGridfsToS3.ts`) now
use **mongoose's bundled driver (`mongoose.mongo`)** for `ObjectId`/`GridFSBucket`
instead of the top-level `mongodb` package. The test-only `mongodb-memory-server`
hoists `mongodb@5` (bson 5.x) to `node_modules/mongodb`, which mismatched
mongoose 8's bundled `mongodb@6` (bson 6.x) and threw `BSONVersionError` on every
GridFS op — so GridFS storage was broken anywhere that skew is present. This was
pre-existing (all file storage), surfaced by the Showcase byte round-trip, and is
now version-matched to the live connection.

## Notes / follow-ups

- **Byte-level gating is enforced** — showcase PDFs stream through the
  staff-gated `/v1/showcase/:id/file` (not the shared `/v1/files/:id`), and the
  DTO no longer exposes `fileId`, so students have no path to the bytes. (The
  broader `/v1/files/:id` IDOR — any authed user can fetch any file id for
  receipts/admission docs — is a pre-existing, app-wide concern tracked
  separately; the Showcase feature no longer depends on it.)
- Admin self-serve upload of new brochures is **not** built (55 MB files
  exceed the 5 MB HTTP cap). Adding more collateral = edit `DOCS` in the seed
  and re-run. A streaming direct-to-GridFS upload UI is the future upgrade.
- iOS Safari won't render a PDF inside an `<iframe>`; the viewer's **Open in
  new tab** button (top-level navigation, which iOS renders) is the fallback
  there. A pdf.js canvas renderer would be the cross-platform upgrade.
