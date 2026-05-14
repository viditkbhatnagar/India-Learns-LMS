# Applicant signup — field-level error rendering smoke

Walk this after any change to the public `/apply/signup` page's error handling, and before merging the fix that converts the "Request failed validation." banner into inline field errors.

**Reported by:** Logan (LUC) on 2026-05-14 — saw a generic "Request failed validation." banner with no indication of which field was wrong, and read it as the page kicking him off.

## Setup

```bash
npm install
npm run dev -w api      # terminal 1 — needs MONGODB_URI in api/.env
npm run dev -w web      # terminal 2
```

Open `http://localhost:5173/apply/signup` in an **incognito window** so no stale auth cookies interfere.

## 1. Bad phone (Logan's original case)

- [ ] Fill in: name=`test`, email=`smoke-<ts>@example.com`, phone=`123456789` (no `+`), password=`Welcome#12345`, confirm=`Welcome#12345`.
- [ ] Click **Create account**.
- [ ] **Mobile phone** input has a red border (`aria-invalid="true"`).
- [ ] Inline message under the phone field reads: `Include the + and country code, e.g. +919876543210.`
- [ ] The "Include the + and country code." hint is replaced by the red error message (not stacked underneath).
- [ ] Top banner reads: `Please fix the highlighted fields below.` — **NOT** `Request failed validation.`
- [ ] Network tab: response is `422` with body `{ error: { code: 'VALIDATION_FAILED', message: 'Request failed validation.', details: { fieldErrors: { phoneE164: [...] } } } }`.

## 2. Weak password (after phone is fixed)

- [ ] Change phone to `+919876543210`, set password=`test`, confirm=`test`. Submit.
- [ ] No inline errors on phone/name/email.
- [ ] Top banner reads: `Password must be at least 10 characters long.` (or `Password must include at least one letter and one digit.` depending on input).
- [ ] No red borders on inputs (HttpError path — backend's specific message goes to the banner, not field-mapped).

## 3. Password mismatch (client-side, no API call)

- [ ] phone=`+919876543210`, password=`Welcome#12345`, confirm=`Welcome#99999`. Submit.
- [ ] Network tab: **no request fires**.
- [ ] **Confirm password** input has red border + inline `Passwords do not match.`
- [ ] Top banner reads: `Please fix the highlighted field below.`
- [ ] Password field is **not** flagged (error is shown on the second/confirm field, where the user typed something inconsistent).

## 4. Duplicate email

- [ ] Use an email already registered (e.g. a known applicant from the dev DB). Valid phone + valid password.
- [ ] Submit. Top banner reads: `An account with this email already exists. Use Resume Application to sign in.`
- [ ] No inline field errors (HttpError path).

## 5. All valid → success

- [ ] Fresh email, phone=`+919876543210`, password=`Welcome#12345`, matching confirm.
- [ ] Submit. Navigates to `/apply/portal`. Session set. Application code `APP-YYYY-NNNNN` visible.

## 6. Network failure

- [ ] DevTools → Network → **Offline**. Submit a valid form.
- [ ] Top banner reads: `Unable to create your account. Please try again.`
- [ ] No inline field errors.
- [ ] Loading state ends; form is interactive again.

## 7. Re-submit clears prior errors

- [ ] After hitting any error in cases 1–4, fix the offending field and submit again.
- [ ] On re-submit, all stale `fieldErrors` and `formError` clear immediately (verify via DevTools that the red borders disappear before the loading spinner appears).

## 8. Mobile viewport (375 × 812)

- [ ] DevTools → device emulation → iPhone X (or any 375-wide preset). Run case 1 again.
- [ ] Inline error wraps cleanly under the phone field without horizontal overflow.
- [ ] Top banner remains readable above the **Create account** button.

## Pass criteria

All checkboxes ticked. If any case shows the literal string `Request failed validation.` in the UI, the fix has regressed — that string should now only appear in the network response payload's `error.message`, never on screen.
