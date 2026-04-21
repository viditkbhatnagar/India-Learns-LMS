# Memory index — India Learns LMS

Quick map of cross-session memory. Load these at every session start per [`/CLAUDE.md` §10](../CLAUDE.md).

| File | Purpose |
|---|---|
| [decisions.md](decisions.md) | Append-only log of architecture / spec decisions + the *why* and source citation |
| [people.md](people.md) | Stakeholders (Rejin, Logan, Vidit) + PENDING role owners |
| [glossary.md](glossary.md) | Acronyms & shorthand pulled from the doc pack |
| [open-questions.md](open-questions.md) | Anything blocked on Logan / Vidit / external input |
| [milestones/](milestones/) | One file per milestone, written at session end |
| [milestones/M1-foundations.md](milestones/M1-foundations.md) | M1 — bare scaffold (API skeleton, web skeleton, CI) |
| [milestones/M2-auth.md](milestones/M2-auth.md) | M2 — auth + user management (server-only) |

## Conventions

- Spec wins over memory. If memory and `claude-code-docs/` disagree, fix the memory and flag the drift in the session report.
- `decisions.md` is **append-only** — never rewrite history; add a new dated entry that supersedes.
- Every entry cites the spec section it came from (`BRD §4`, `TRD §12`, etc.) so future sessions can re-verify.
