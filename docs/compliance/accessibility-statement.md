# Accessibility Statement

India Learns is committed to providing a learning platform that is usable by everyone, including people with disabilities. This statement describes the standards we target, the steps we have taken, what we know does not yet meet those standards, and how to report issues.

## 1. Standards

We target **Web Content Accessibility Guidelines 2.1, Level AA** ("WCAG 2.1 AA"). For India-specific compliance, this aligns with the **Rights of Persons with Disabilities Act, 2016**, the **Standards for Web Content Accessibility for Indian Government Websites (GIGW)**, and the **Bureau of Indian Standards IS 17802 / ISO 30071-1**.

## 2. Conformance status

**Partially conformant** as of 26 April 2026. The platform substantially meets WCAG 2.1 AA but some content does not fully conform.

The current Lighthouse accessibility audit is captured in the repository (`lighthouse-student.json`). The score is reviewed at the end of every milestone; M9 polish includes accessibility fixes.

## 3. What we have done

### 3.1 Design system

- Brand colours have been validated for contrast ratios. Body text and primary buttons meet 4.5:1 (AA) on the default light theme.
- All interactive elements have visible focus states.
- Spacing and tap-target sizes meet 44 × 44 px minimums on mobile.
- Typography uses `@fontsource/poppins` with system-font fallback for fast load and graceful degradation.

### 3.2 Semantics and structure

- Forms use real `<label>` elements bound to inputs.
- Navigation uses `<nav>` and `<main>` landmarks.
- Headings are hierarchical (single `<h1>` per page).
- Interactive icons have `aria-label`.

### 3.3 Keyboard

- Every page is fully keyboard-navigable. `focus-trap-react` is used for modal flows.
- Tab order matches reading order.
- Skip-to-content link is present on all pages with a top navigation bar.

### 3.4 Screen reader

- Page transitions announce via `aria-live` regions where helpful.
- Status changes (e.g., "Payment recorded") are announced.
- Form errors are associated with inputs via `aria-describedby`.

### 3.5 Mobile and PWA

- Layout responsive from 375 × 812 (iPhone SE class) up to 1440 × 900 desktop.
- `prefers-reduced-motion` honoured throughout — animations are minimal and skipped when the user opts out.
- The PWA manifest is served from the root with a maskable icon.

### 3.6 Continuous checks

- `@axe-core/playwright` is installed in `web/` and used in our Playwright e2e tests for spot-check accessibility assertions.
- A Lighthouse run is part of `npm run lighthouse` from the `web/` workspace.

## 4. Known limitations

The following items do not yet fully conform and are tracked toward remediation:

| # | Issue | WCAG ref | Plan |
|---|---|---|---|
| A11Y-1 | Date and time pickers in some forms rely on the native browser control, which has inconsistent screen-reader support across browsers | 1.3.1, 4.1.2 | Replace with a custom accessible picker in M9 |
| A11Y-2 | Long uploaded course PDFs may not be tagged for accessibility | 1.1.1, 1.3.1 | LUC content-creation guidance documents are pending |
| A11Y-3 | Live Class videos (when added in Phase 2) will need captions | 1.2.2, 1.2.4 | Out of Phase 1 scope; captioning policy to be added with the feature |
| A11Y-4 | Some form-error messages rely on visual colour only | 1.4.1 | Add icon + text on all error states (M9) |
| A11Y-5 | Hindi / regional language translation not available | 3.1.1 | Phase 2 candidate; English-only at launch |
| A11Y-6 | Receipt PDF generation (`pdfkit`) does not currently produce tagged PDFs | 1.1.1 | Investigate `pdfkit-table` or move to a tagged-PDF generator |

## 5. Languages

Phase 1 ships in English only. Hindi, Marathi, and other regional languages are on the Phase 2 roadmap, prioritised based on actual student demographics from the first cohorts.

## 6. Testing methods

- **Automated:** `axe-core` via Playwright; Lighthouse.
- **Manual keyboard-only navigation:** every page tested before a release.
- **Screen reader:** spot-checks with VoiceOver (macOS / iOS) and NVDA (Windows). Full screen-reader audit scheduled before public launch.
- **Reduced motion:** verified via the `prefers-reduced-motion: reduce` setting on each major release.

## 7. Compatibility

Tested in:

- Chrome 120+ on macOS, Windows, Android.
- Safari 17+ on macOS and iOS.
- Firefox 120+ on macOS and Windows.
- Edge 120+ on Windows.

Older browsers (IE 11, Safari < 14) are not supported. The single-page React app uses ES2020 features without transpiling to legacy targets.

## 8. Reporting issues

We welcome feedback. If you encounter an accessibility barrier:

- **Authenticated users:** raise a support ticket with category `Technical` and prefix the subject with `[A11Y]`.
- **Public:** email `{{SUPPORT_EMAIL}}` (placeholder) with subject `[A11Y]`.

We aim to acknowledge accessibility reports within **2 business days** and to remediate critical issues within **30 days**.

## 9. Approval and review

This statement was prepared on 26 April 2026, based on a self-evaluation. It is reviewed at the end of each milestone and on every major UI change. The next formal review is before public launch.

## 10. Related documents

- [../security/SECURITY.md](../security/SECURITY.md) — for security issues (including those that intersect accessibility, e.g., CAPTCHA).
- [../user-guides/support-channels.md](../user-guides/support-channels.md) — how to reach support.
- [../legal/privacy-policy.md](../legal/privacy-policy.md) — for data handling questions.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per milestone._
