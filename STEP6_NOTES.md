# Per-company "check my case" toggle

Companies can now turn off the public `/c` progress-checking page. It is **opt-out**:
every existing company keeps the feature on until its admin switches it off.

## 1. What changed

- **Data model**: `companies/{id}.settings.allowCaseProgressCheck` (boolean). A missing value
  means `true`, so no migration is needed. `functions/utils/companySettings.js` holds the
  default, the `isCaseProgressCheckAllowed(company)` check and the payload validator.
- **Backend**
  - `updateCompanySettings({ companyId, settings })` in `functions/api/publicReportApi.js`, next to
    `setReportingEnabled` (same `requireCompanyAdmin` + `BASE_OPTIONS` pattern; `companyApi`
    in `companyAdminApi.js` is billing-only and has no `BASE_OPTIONS`). Unknown keys and
    non-boolean values are rejected. Exported in `functions/index.js`.
  - `getPublicReportConfig` now returns `allowCaseProgressCheck`, so `/r/:slug` needs no new lookup.
  - **Server-side enforcement**: `verifyCaseCredentials` in `caseAccessApi.js` (used by both
    `getCaseStatus` and `submitCaseReply`) throws `failed-precondition`
    ("Case status checking is turned off for this company.") when the setting is false.
  - **Cost**: `caseAccess` docs already store `companyId`, so the company doc is read in
    parallel with the post (field-masked to `settings`). No extra sequential round trip.
    Older `caseAccess` docs without `companyId` fall back to the post's `companyId`.
  - `firestore.rules`: `settings` joins `isActive`/`reportSlug`/`reportingEnabled` as fields a
    company admin cannot write from the client; the callable is the only write path.
- **Admin UI**: a real switch (`role="switch"`) on `CompanyQRCode.jsx`, under the report-link
  controls. Copy explains that turning it off removes status and private replies for reporters;
  only HR can still act internally.
- **Reporter UI**: `SuccessScreen` hides the "check my case" block when the flag is false (threaded
  from `ReportPage` config). `CheckCasePage` shows a neutral info notice (not the red error style).
- **i18n**: `report.link.caseCheckLabel`, `report.link.caseCheckHelp`,
  `report.checkCase.errors.disabled` in all 5 locales (the non-English strings are my translations;
  worth a native-speaker pass, especially `si`).

## 2. Decisions to review

- **Self-service by company_admin** (matches `setReportingEnabled`); super_admin can also call it.
  If this should be super_admin-only, change `requireCompanyAdmin` in `updateCompanySettings`
  and hide the switch.
- **No code-validity leak**: the toggle is checked *after* the case code and key both verify. An
  unknown code or wrong key still gets the generic "invalid" error and still counts toward the
  lockout. Only someone holding a valid pair sees "not available", which tells them nothing new.
  Consequence: while off, a valid pair still passes through the rate limiter and lockout counters.
- The success screen's warning ("You will need both to check your case") and the downloaded
  `.txt` still mention checking the case when the feature is off. Left unchanged to keep this
  focused; easy follow-up.

## 3. Verified / not verified

- `npx vite build`: passes.
- `eslint` on touched frontend files: 0 errors (1 pre-existing `exhaustive-deps` warning in `CompanyQRCode.jsx`).
- `node --test functions/test/*.test.js`: new `companySettings.test.js` passes. One existing test
  (`passwords.test.js` "password policy and temporary passwords") is flaky: the generator's output
  can contain letters the test's regex excludes (seen: `i`). It also exists on the base branch
  and is unrelated.
- `node --check` on changed functions files.
- **Not run**: Firebase emulator, browser/e2e, deployed callables, Firestore rules tests.
  The enforcement path in `verifyCaseCredentials` and the rules change have no automated coverage.

## 4. Manual checklist

1. Fresh/existing company: `/r/<slug>` success screen shows "Check my case"; `/c` works.
2. Admin: `/company/qr-code` -> switch off. Reload: stays off.
3. Submit a report: success screen has no "Check my case" block.
4. `/c` with a valid code + key: info notice, no case data. Wrong key: still "not correct".
5. Switch on again: `/c` works for old cases.
6. As a non-admin, call `updateCompanySettings`: `permission-denied`. Direct client write of
   `settings` on the company doc: denied by rules.
