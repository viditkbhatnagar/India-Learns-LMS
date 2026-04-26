# ADR 0002 — JWT access tokens with httpOnly refresh cookie

**Status:** Accepted
**Date:** 2026-02-15 (M2 auth foundations)
**Author:** Vidit Bhatnagar

## Context

We needed an authentication model that:

- Worked for a single-page React app talking to an Express API.
- Resisted XSS-driven token theft.
- Resisted CSRF.
- Allowed forced sign-out (e.g., on suspicious activity).
- Was simple — small team, no external auth provider in Phase 1.

## Decision

Two-token model:

- **Access token:** signed JWT (HS256), 15-minute TTL, sent as `Authorization: Bearer …` from the SPA, **held in JS memory**, never persisted.
- **Refresh token:** opaque random 32-byte value, **SHA-256 hashed in DB**, stored client-side in a cookie named `__Host-il_rt` with attributes `httpOnly; Secure; SameSite=strict; Path=/`.

The SPA sends the access token on every API call. When the access token expires, the SPA POSTs `/v1/auth/refresh`; the cookie is sent automatically; the API rotates the refresh token, returns a fresh access token, and updates the cookie.

A presented refresh token that has already been revoked triggers **family-level revocation** — all sibling refresh tokens are invalidated, killing the session.

## Rationale

- **XSS resistance.** The refresh token is the long-lived secret; making it `httpOnly` means JavaScript cannot read it, so a stored XSS that reads `document.cookie` gets nothing. The access token is in memory, so a stored XSS can exfiltrate at most 15 minutes of access.
- **CSRF resistance.** Mutating endpoints require a `Bearer` header, set by JS — a cross-site form submit cannot include it. The only cookie-bearing endpoints are `/auth/refresh` and `/auth/logout`, both `SameSite=strict`.
- **Forced sign-out.** `revokeAllForUser` invalidates every refresh token for a user. Triggered automatically on password change/reset. Used during incident response.
- **Standard tooling.** `jose` for JWT, native `crypto` for SHA-256 — minimal dependencies.
- **`__Host-` prefix.** Forces `Secure`, `Path=/`, no `Domain` — RFC 6265bis hardening that the browser enforces for us.

The TRD originally specified `Path=/v1/auth/refresh`, but the `__Host-` prefix mandates `Path=/`. We chose the stronger guarantee and gate where the cookie is *read* server-side instead.

## Consequences

**Good:**

- 15-minute blast radius for stolen access token.
- Family revocation gives immediate response to refresh-token theft.
- Single-origin deploy means cookies and JS share `il-app.onrender.com` — no CORS or cross-site cookie complications.

**Trade-offs:**

- HS256 means the same secret signs and verifies. If we ever need a relying party other than this SPA, we'll migrate to RS256.
- Phase 1 has no MFA. Single-factor by design — Phase 2 candidate.
- Cookie's `Path=/` means it's sent on every request to the origin. We rely on server-side route gating to limit where it's read.

## Alternatives considered

- **localStorage for both tokens.** Rejected — XSS-vulnerable.
- **Sessions (cookie + server-side store).** Viable but heavier; requires server-side session storage and adds a CSRF surface for every endpoint.
- **OAuth/OIDC via Auth0 etc.** Overkill for Phase 1 and pulls in a new vendor.
- **RS256 from day one.** Future-proof but adds key management we don't yet need.

## References

- [`api/src/services/tokenService.ts`](../../../api/src/services/tokenService.ts)
- [`api/src/services/refreshTokenService.ts`](../../../api/src/services/refreshTokenService.ts)
- [`api/src/utils/cookies.ts`](../../../api/src/utils/cookies.ts)
- [`../../../api/src/services/authService.ts`](../../../api/src/services/authService.ts)
- [../security/cryptography.md](../../security/cryptography.md) §3–4
- [../security/access-control.md](../../security/access-control.md) §1
