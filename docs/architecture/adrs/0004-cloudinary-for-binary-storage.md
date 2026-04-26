# ADR 0004 — Cloudinary for binary storage

**Status:** Accepted
**Date:** 2026-02-15
**Author:** Vidit Bhatnagar

## Context

The platform produces and stores binaries:

- Receipt PDFs.
- Course videos and slide decks.
- Ticket attachments.
- (Future) Certificates if served from our infrastructure.

Render's filesystem is ephemeral — every redeploy throws it away. We need durable storage with signed-URL access to keep binaries out of the application's runtime traffic. Options considered:

1. **Cloudinary** — media-focused SaaS with on-the-fly transformations, auto resource-typing, signed URLs.
2. **AWS S3** — most flexible; requires more wiring (IAM, regions, lifecycle).
3. **Backblaze B2 / Vercel Blob / R2** — cheaper or more developer-friendly storage but smaller ecosystems for media-specific needs.
4. **Self-host on a Render disk** — disqualified by Render's filesystem ephemerality.

## Decision

Use **Cloudinary** with the `CloudinaryStorageAdapter` ([`api/src/integrations/storageAdapter.ts`](../../../api/src/integrations/storageAdapter.ts)). All assets stored as `type: 'authenticated'`. Reads via TTL-bounded `private_download_url`. Direct browser uploads via signed upload tickets.

The adapter pattern means storage can be swapped for S3 or another provider without touching business code — see [integrations.md](../integrations.md).

## Rationale

- **Lower wiring cost.** Cloudinary's Node SDK handles signing, multipart, and authenticated transforms; S3 would require us to assemble those.
- **Media-aware.** PDFs, slides, videos, and images all work out of the box. We can later add resize-on-the-fly for thumbnails without changing storage.
- **Signed URLs are cheap and standard.** TTL-bounded reads protect us from leaked links.
- **Direct upload from the browser.** Files don't transit the API; our Render bandwidth budget stays free.

## Consequences

**Good:**

- One vendor + one adapter.
- Receipts download flow is just sign → return URL; no server-side streaming.
- Free tier supports Phase 1 volume.

**Trade-offs:**

- Asset bucket region defaults to US — flagged for cross-border transfer documentation in [../compliance/dpdp-compliance-report.md](../../compliance/dpdp-compliance-report.md) (§16) and [../compliance/vendor-risk-register.md](../../compliance/vendor-risk-register.md).
- API costs scale with bandwidth + transformations. Tracked in `apiCostLedger` for visibility.
- We don't currently AV-scan uploads. Documented as a known issue ([../security/known-issues.md](../../security/known-issues.md) KI-003).

## Alternatives considered

- **AWS S3 with Mumbai region.** Best for DPDP cross-border posture. Reconsider in Phase 2 when volume justifies.
- **Backblaze B2.** Cheaper but smaller media tooling.
- **Render disks.** Doesn't survive redeploys.

## References

- [`api/src/integrations/storageAdapter.ts`](../../../api/src/integrations/storageAdapter.ts)
- [`api/src/services/receiptService.ts`](../../../api/src/services/receiptService.ts)
- [integrations.md](../integrations.md) §3
- [../compliance/vendor-risk-register.md](../../compliance/vendor-risk-register.md) V3
