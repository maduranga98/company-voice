# STEP 2 notes: check my case (no-login status and private replies)

Branch: `rework/check-my-case`.

## 1. What was built

### Backend
- `functions/api/caseAccessApi.js`: `getCaseStatus({caseCode, secretKey})` and
  `submitCaseReply({caseCode, secretKey, message})`. Both authenticate with the
  existing `caseAccess` doc and `verifySecretKey` (constant-time), never Firebase
  Auth. One generic `invalid-argument` error for an unknown case code, a wrong key,
  and (deliberately) *not* for a locked-out case — case codes aren't treated as
  secret (see step 1 notes), so distinguishing "locked" from "wrong credentials"
  doesn't leak anything new.
- Lockout: reuses the `failedAttempts`/`lockedUntil` fields step 1 already put on
  `caseAccess` — 5 wrong keys locks the case for 30 minutes, reset on a correct
  attempt.
- Rate limits (via the existing `rateLimits` helpers): 20 verify attempts/hour per
  hashed IP, 20 replies/day per case.
- `getCaseStatus` returns status, priority, category, type, `involvesHR`, the
  reporter's own `description` (their own text, shown back to them), `createdAt`,
  the computed EU Directive timers, and the thread's messages (still
  AES-encrypted — the client decrypts with the same bundled `VITE_ANONYMOUS_SECRET`
  the HR side already uses; see step 1's weakness #2, unchanged here).
- `submitCaseReply` appends an encrypted `{sender: "reporter", ...}` message to
  `anonymousThreads/{postId}` (creating the thread if it doesn't exist yet) and
  notifies `company_admin` (+ `hr` unless `involvesHR`) with a new `case_reply`
  notification type, following the same `notifyStaff` pattern as step 1's
  `new_case`.
- `functions/utils/caseTimers.js`: pure `computeCaseTimers(post, thread)`,
  unit-tested (7 tests, `npm test` in `functions/` is 38/38). Acknowledge window
  7 days, feedback window ~90 days (3 months); `isAcknowledged` = status left
  `open`; `isFeedbackGiven` = a terminal status (`resolved`, `closed`, `rejected`,
  `not_a_problem`) or at least one investigator reply exists.
- No `firestore.rules`/`storage.rules` changes: these callables run on the Admin
  SDK, which already bypasses client rules, and `caseAccess`/`anonymousThreads`
  stay deny-all to clients exactly as step 1 left them.

### Frontend
- Route `/c` (no `PrivateRoute`, same treatment as `/r/:slug`): `src/utils/publicRoute.js`'s
  `isPublicReportRoute()` now also matches `/c` and `/c/*`, so App Check still
  initializes there but session restore, Sentry, Analytics and Performance stay
  off, same as the report form.
- `src/pages/public/CheckCasePage.jsx`: a lookup form (case code + secret key),
  then a case view (status badge, submitted date, the reporter's own description,
  `CaseTimers`, and `CaseReplyThread`). "Check another case" clears all state back
  to the lookup form.
- `src/components/public/CaseTimers.jsx`, `CaseReplyThread.jsx`:
  reporter-facing (not the HR `PostStatusConfig`, which is English-only and
  carries different, internal wording) — separately i18n'd under
  `report.checkCase.*`.
- `src/services/publicCaseService.js`: callable wrappers + the same
  AES-decrypt-with-bundled-secret pattern `anonymousThreadService.js` already
  uses for HR.
- Same no-persistence discipline as the step 1 success screen: the secret key
  lives only in `CheckCasePage`'s component state, dropped on unmount; nothing
  goes into the URL, localStorage or sessionStorage. This means a page refresh
  logs the reporter out of the case view and they re-enter their code and key —
  deliberate, not an oversight; flagging it in case product wants a different
  tradeoff later (e.g. sessionStorage with a short TTL).
- `SuccessScreen.jsx`'s `TODO(step2)` is resolved: it now links to `/c`
  (`report.success.checkCaseIntro` / `checkCaseLink`, replacing the old
  `comingSoon` key).
- i18n: `report.checkCase.*` (43 keys: heading/intro/labels, errors, the 9
  `PostStatus` values, 6 timer strings, 7 thread strings) added to all 5 locales
  in the same key order; `report.success.comingSoon` replaced with
  `checkCaseIntro`/`checkCaseLink` in the same slot, all 5 locales. Translations
  are mine (es/fr/it/si), same caveat as step 1: native review recommended,
  Sinhala especially.

## 2. Verification done

- `cd functions && npm test`: 38/38 (31 pre-existing + 7 new `caseTimers` tests).
- `npx eslint` on every new/changed file (frontend + functions): clean.
- `npm run build`: passes.
- All 5 locale JSON files validated and confirmed to have identical key order
  after the edit.
- `grep` confirms no remaining `TODO(step2)` or `comingSoon` references.

### Not verified (no emulator run this pass)
- End-to-end against the Functions/Firestore emulators (lockout after 5 wrong
  keys, the 30-minute unlock, the per-IP and per-case rate limits, a real
  `submitCaseReply` round-trip visible in the HR inbox thread). Step 1's
  `functions/test/emulator/e2e.emulator.mjs` would be the natural place to add
  `getCaseStatus`/`submitCaseReply` coverage; not done here.
- Browser run of `CheckCasePage.jsx` (lookup, reply send, language switching).
- `case_reply` notification type has no custom icon in the Notifications page
  yet (falls back to the generic bell icon, same as step 1's `new_case`).

## 3. Manual checklist

1. Submit a report via `/r/<slug>`, note the case code and secret key, click
   "Check my case" on the success screen (or go to `/c` directly).
2. Enter the code and key: case view loads with status "Open", both timers
   pending, "What you reported" matching the submitted description.
3. Send a reply from `/c`: it appears instantly (optimistic) and, once
   deployed, as an `involvesHR`-respecting `reporter` message in the HR case's
   thread (`AdminActionPanel`'s anonymous thread view).
4. Reply from HR as `investigator`: refresh `/c` and confirm the message shows
   on the left with "The company" and the feedback timer flips to "received".
5. Type the wrong secret key 5 times on one case: the first 5 each return the
   generic "invalid case code or secret key" error; from the 6th attempt
   onward (even with the *correct* key) it returns a distinct "too many
   attempts" error until the 30-minute lock clears. The two messages are
   deliberately different here, unlike the unknown-case/wrong-key case: the
   case code itself isn't treated as secret, so confirming "this case got
   locked" doesn't leak anything a legitimate reporter didn't already know.
6. HR sees a new "New reply on a case" notification on step 3, scoped to
   `company_admin` only when `involvesHR` was set at submission.

## 4. Deferred / out of scope (unchanged from step 1's list, minus this step)

Voice recording UI, policy acknowledgement link, Stripe/signup changes, landing
page rewrite. See `STEP1_NOTES.md` section 4.
