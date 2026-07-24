# Dependency requests

Libraries not in TRD §3.4 that we'd like to add. Until approved, each has a
built-in alternative in use.

## mammoth (docx → text/html) — OPTIONAL upgrade
- **Wanted for:** parsing uploaded lesson-plan `.docx` files (Curriculum
  import → "Upload a finalized lesson plan").
- **Built-in alternative in use:** `api/src/services/curriculumImport/docxExtract.ts`
  reads the `.docx` zip + `word/document.xml` with `node:zlib` only (no
  dependency). Validated against the real Fashion / Digital Fashion decks
  (8 modules / 214 lessons each). Swap to `mammoth` only if a future document
  uses shapes the built-in text extractor can't handle.
