# Cookie Policy

> **PRE-PUBLISH NOTICE.** Placeholders MUST be resolved and the document reviewed by qualified legal counsel before publishing. See [PLACEHOLDERS.md](PLACEHOLDERS.md).

**Effective date:** {{EFFECTIVE_DATE}}

This Cookie Policy explains how the India Learns platform operated by **{{ORG_NAME}}** uses cookies and similar technologies. It complements our [Privacy Policy](privacy-policy.md).

## 1. What is a cookie?

A cookie is a small file stored by your browser when you visit a website. It can hold a value the website sets (such as a session identifier) and is sent back to the website on subsequent visits. Cookies can be **first-party** (set by the website you are visiting) or **third-party** (set by another website).

## 2. Cookies we use

We use **only essential cookies**. We do not use analytics, advertising, behavioural-tracking, or third-party cookies on the Platform.

| Cookie | Purpose | Type | Lifetime | Set by |
|---|---|---|---|---|
| `__Host-il_rt` | Holds the refresh-token used to keep you signed in. The cookie value is cryptographically random and the corresponding token is stored as a SHA-256 hash on our server. The cookie carries the `__Host-` prefix, is `httpOnly`, `Secure`, and `SameSite=strict`, meaning it is sent only to {{WEBSITE_URL}} over HTTPS and cannot be read by any script. | Essential / Authentication | Up to 14 days, refreshed on each rotation | First-party — India Learns |

That is the entire list. There are no advertising cookies, no analytics cookies, no social-media tracking cookies.

## 3. Why this is the only cookie

We have intentionally avoided cookies for analytics, marketing, and behavioural profiling because:

- Our primary user base is enrolled students; consent dynamics differ from a public website.
- Section 9 of the DPDP Act 2023 disallows behavioural tracking of children, and our user base may include some users under 18.
- We do not need them — operational telemetry is collected server-side via structured logs and Sentry (which does **not** rely on cookies in our configuration).

## 4. Local storage and similar technologies

Our web application does NOT store the access token or any personal data in `localStorage` or `sessionStorage`. The access token is held in JavaScript memory only and is short-lived (15 minutes).

The Progressive Web App (PWA) uses the browser's **service-worker cache** to store static assets (HTML, CSS, JavaScript, images) for offline use. This cache contains no personal data and is bounded by the browser's storage quota.

## 5. Third-party cookies

There are no third-party cookies set on India Learns pages. When you click an outbound link to a third party (for example, a Cloudinary signed URL to download a receipt), that third party's cookie policy applies.

Note that our error-monitoring vendor (Sentry) is loaded as part of our application bundle and operates **without setting cookies** in our configured mode.

## 6. Managing cookies

You can clear or block cookies in your browser at any time. Because the only cookie we use is essential to keeping you signed in, blocking it will sign you out. You can still use the Platform but will need to log in again on each session.

To clear or block cookies, see your browser's documentation:

- Chrome — Settings → Privacy and security → Cookies.
- Safari — Preferences → Privacy.
- Firefox — Settings → Privacy & Security.
- Edge — Settings → Cookies and site permissions.

## 7. Updates to this policy

If we add new cookies (for example, a future analytics tool that we deem necessary), we will update this policy and add a banner so you can review and consent before any non-essential cookie is set. Material updates are communicated at least **15 days** before they take effect.

## 8. Contact

Questions? Contact **{{DPO_EMAIL}}**.

---

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per release if cookies change, otherwise annually._
