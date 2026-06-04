# Smoke: Slide deck "Replace deck (JSON)" — corruption + crash fix (D-107)

**Bug.** A wrong-shaped JSON deck (e.g. a PowerPoint converted to JSON) uploaded via
"Replace deck (JSON)" was persisted verbatim (slide count jumped 3 → 13) and the viewer
then crashed with `Cannot read properties of undefined (reading 'title')`, so the deck
could no longer be opened at all.

## Preconditions
- Logged in as faculty assigned to the course (or admin/superadmin **added to the course
  faculty roster** — off-roster staff are read-only, `OVERSIGHT_READONLY`).
- A `type=slides` material exists on a session (e.g. "Who Works at the Airport?").

## Steps

1. Open the course → session → the slides material. The deck renders and "Slide 1 of N"
   shows. (Recovery: a previously-corrupted deck now opens with a per-slide JSON dump
   instead of a blank "Something went wrong" screen.)

2. **Corruption guard — reject a non-slides JSON.**
   - Click **Replace deck (JSON)** and drop a JSON file that is *not* a slides export, e.g.
     `[{"id":1,"type":"pptx-shape","data":{}}]`.
   - EXPECT a red error: *"Slide 1 has no valid \"content\" object (expected a plain
     object). This file does not look like a slides export — use \"Download deck\" … To
     share a PowerPoint or PDF … use \"Upload PowerPoint / PDF\" instead."*
   - EXPECT the on-screen deck is **unchanged** (nothing corrupt was persisted).

3. **Reject a non-JSON file.** Drop a `.pptx` on **Replace deck (JSON)** → blocked
   client-side with *"Replace deck expects a JSON export …"* (and oversized JSON > 1 MB is
   rejected before upload).

4. **Happy path.** Click **Download deck** (downloads the current slides JSON), then
   re-upload that file via **Replace deck (JSON)**.
   - EXPECT *"Replaced."* and the viewer shows **slide 1** of the deck (index resets).

5. **Correct path for a PowerPoint/PDF.** Click **Upload PowerPoint / PDF**, drop a
   `.pptx`/`.pdf` → *"Added — students can download it."* A downloadable material is
   attached to the session (separate from the rendered deck).

## Import a PowerPoint as rendered slides (D-108)

6. Click **Replace deck** (renamed from "Replace deck (JSON)"). The drop zone now
   accepts a PowerPoint *or* a JSON export.
7. Drop a **.pptx** file. EXPECT "Replaced." and the deck re-renders with the
   PowerPoint's slides (title slide + bulleted content slides), in order.
   - This is parsed server-side — no hand-conversion to JSON needed.
8. Drop an old **.ppt** (legacy binary) → blocked client-side with a "save as
   .pptx" message.
9. A non-PowerPoint file renamed to `.pptx`, or a corrupt deck → **422** with a
   clear message; the existing deck is left intact.

> "Upload PowerPoint / PDF" still exists and is unchanged — it attaches the file
> as a **download** for students. "Replace deck" renders the slides inline.

## Automated cover
- `api/tests/integration/materials.slides.test.ts` — 8 cases incl. the corruption
  regression (a rejected payload leaves the stored deck intact).
- `web/e2e/slideviewer-fixtures.spec.ts` — `normalizeSlides` / `slideContent` resilience
  (reading `.title` off a corrupt deck never throws).
