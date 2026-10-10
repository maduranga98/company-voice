# STEP 1 notes: public report submission (no login)

Branch: `rework/public-report-form` (local), pushed to `claude/kind-hypatia-onwd5o` (the session's designated branch).

## 0. Read this first

1. **The removal phase is not in the repo.** `rework/remove-walls` / PR #190 contain only `REMOVAL_PLAN.md`. `src/` still has the feeds, `Register`, `QRCodeGenerator`, `EmployeeLayout`, `MyPosts`, employee login/QR login and so on. I built Step 1 on top of the current code and did not touch the removal work. Consequences are called out below (posts rules, companies rule).
2. **Critical weakness that predates this work: role checks in `firestore.rules` can be forged.** Every role check reads `authSessions/{uid}`, and `authSessions` allows `create`/`update` by the owner of that uid with arbitrary content. Any anonymous Firebase user can write `{role: "super_admin", companyId: ...}` to their own session and then read and write everything the rules protect (verified in the emulator: after forging, an `involvesHR` post was readable). This means the new `involvesHR` rule and the HR/admin restriction are correct as rules but **are not a real barrier until sessions are written server-side** (for example custom claims minted by `generateAuthToken`, rules reading `request.auth.token.role`). What stays safe regardless: `caseAccess`, `reportSlugs`, `rateLimits` (deny-all), and the case secret keys (only an HMAC is stored). Not redesigned, as instructed. **Addressed by the auth hardening work: see AUTH_AUDIT.md and AUTH_ROLLOUT.md** (rules now read server-minted custom claims and `authSessions` is deny-all).
3. Branch note: the task asked for `rework/public-report-form`; the session is configured to push to `claude/kind-hypatia-onwd5o`, so work lives on the former locally and is pushed to the latter.

## 1. Audit findings

### Post creation (`src/services/postManagementService.js`, `src/components/CreatePost.jsx`)
- Posts are created in `CreatePost.jsx` (`addDoc(collection(db,"posts"), …)`), not in the service. Fields: `title, content, category, tags, isAnonymous, authorId, creatorId, authorName, authorEmail, authorDepartmentId, companyId, type, status, priority, privacyLevel, departmentId, attachments, poll, likes, comments, views, createdAt, updatedAt`.
- Enums (`src/utils/constants.js`): `PostType` = `problem_report | idea_suggestion | creative_content | team_discussion`; `PostStatus` = `open, acknowledged, in_progress, under_review, working_on, resolved, closed, rejected, not_a_problem`; `PostPriority` = `critical|high|medium|low`; visibility field is **`privacyLevel`** = `company_public | department_only | hr_only`.
- Mapping used: concern → `problem_report`, idea → `idea_suggestion`, question → `team_discussion`. Visibility `hr_only`.
- Text field is `content` (HR inbox reads `description || content`; search reads `content`). Public cases write both `description` and `content`.
- Anonymous authorship: `authorId = AES(userId)` with `VITE_ANONYMOUS_SECRET`, **but `creatorId` is the plain user id on the same document** (see weaknesses). Public cases set `authorId: null, creatorId: null`.
- Activity log: `logPostActivity` writes `postActivities {postId, type, companyId, metadata, createdAt}` from the client. `PostActivityType.CREATED = "created"`. Public cases write the same shape plus `actor: "public_reporter"`.
- Notifications: `notifyAuthor` skips anonymous posts. `CreatePost` notifies hr/company_admin for `hr_only` posts with type `hr_post_received`. Public cases use new type `new_case` (added to `NotificationType`; the Notifications page falls back to a generic bell icon).

### Anonymous threads (`src/services/anonymousThreadService.js`)
- `anonymousThreads/{postId}`: `{postId, companyId, reporterId?, messages[], lastReporterActivity, lastInvestigatorActivity, lastReadBy, createdAt}`; message = `{id, sender, encryptedContent, timestamp, read}`; `ThreadSender` = `reporter | investigator`; AES via CryptoJS with `VITE_ANONYMOUS_SECRET` (falls back to a hard-coded default string when unset).
- Not touched. Step 2 (check my case / replies) will need a server-side path: public reporters have no `reporterId`, so threads for public cases must be addressed by `caseAccess`.

### HR inbox and case detail
- There is no separate case detail view for posts. `ReportDetailView.jsx` is the **moderation** report page (`contentReports`), unrelated. The case detail is the right-hand panel in `src/pages/hr/HRInbox.jsx` (desktop only, `hidden lg:flex`) plus `AdminActionPanel` (status, priority, assignment, due date, admin notes, anonymous thread).
- Queries on `posts` and what I did:

| Query | Reachable by hr? | Change |
|---|---|---|
| `HRInbox` (`companyId`, `privacyLevel==hr_only`, orderBy createdAt) | yes | added `involvesHR==false` for hr, dropped `orderBy`, sort client-side |
| `CompanyAdminLayout` unread badge | yes | same |
| `AssignedToMe` | yes | same |
| `CompanyAnalytics` | yes (sidebar) | `involvesHR==false` for hr |
| `LegalRequestsPage` anonymous post search | yes | same, sort + limit client-side |
| `getPostsWithPrivacyFilter` (feeds) | yes | same |
| `advancedSearch` (Cloud Function, Admin SDK) | yes | now drops `involvesHR` posts for hr |
| `CompanyDashboard` | redirected away for hr | none |
| `departmentservice` department stats, `postEnhancedFeaturesService` (pinned/archived/auto-archive), `Profile`, `MyPosts`, `EmployeeMessages`, `EmployeeLayout` | hr can reach department stats only | **not changed**: wrapped in try/catch (return empty on error) or part of code slated for removal |

- Helper: `src/utils/caseVisibility.js` (`hrCaseScope`, `sortByCreatedAtDesc`). No new composite indexes: the added filter is equality-only and the affected queries no longer `orderBy`.
- `CreatePost` now writes `involvesHR: false` so new regular posts stay visible to hr.

### Security rules
- `authSessions/{uid}` maps the Firebase Auth uid to `{userId, companyId, role}`; every role helper reads it (and it is client-writable, see section 0).
- Posts before: any signed-in member of the company could read; updates by authors, hr, company_admin, assignee, and anyone for `reactions`/`comments`/`reportCount`.
- `companies`: `allow read: if true`. **Left open**: `Register.jsx` (public route `/register`) still reads `companies/{id}` unauthenticated, so the spec's condition for restricting it is not met. A `TODO(step-removal)` is in the rules. Side effect: the company doc now contains `reportSlug`, so anyone who knows a companyId (it is in old registration QR links) can read the report link. Restrict the rule once registration is removed.
- Storage: attachments `read: if isAuthenticated()` for everything, no company or role check, and `write` allows any signed-in session up to 50 MB. Existing post attachments are stored as `getDownloadURL` token URLs in Firestore (bearer links). The `companies/{companyId}/cases/**` rule follows the same read pattern; the difference is that public-case attachments are stored by **path** and resolved to a link on click, so no token is persisted.
- Functions: `functions/index.js` mixes v2 (`onCall` in `authApi`, `cors: true`) and v1 (`functions.https.onCall`, `functions.pubsub.schedule`). Region is the default `us-central1` (the client uses `us-central1`). New code is v2 (`onCall`, `onSchedule`, `defineSecret`). Role helpers are in `functions/utils/helpers.js` (`isSuperAdmin(uid)`, `isCompanyAdmin(uid, companyId)`; note `isCompanyAdmin` also returns true for `SUPER_ADMIN` only when their `companyId` matches, so `ensureReportSlug` checks `isSuperAdmin` separately). `helpers.js` logs Firebase uid and user id on every auth lookup (admin users, not reporters).
- `CompanyQRCode.jsx` hard-coded `https://portal.voxwel.com/register?companyId=…`. There was no `TODO(report-link)` marker in the repo.

### Weaknesses found (not fixed unless stated)
1. `authSessions` forgery (section 0). Highest priority.
2. `VITE_ANONYMOUS_SECRET` is bundled into the client. Anyone can decrypt every `authorId`, thread message and `reporterContactEncrypted`. If unset it falls back to the literal `"default-secret-key-change-in-production"`. `functions` uses a separate `ANONYMOUS_SECRET` secret that **must equal** the value baked into the client build or HR will see contact details as garbage.
3. `creatorId` is stored in plain text next to the encrypted `authorId` on anonymous posts, so the encryption adds nothing for anyone who can read the post.
4. `users` rules allow any anonymous-provider session to read all user docs and create users; `generateAuthToken` hashes passwords with unsalted SHA-256, is `cors: true`, has no rate limit or App Check.
5. Billing: `CompanyBilling.jsx` and `billingService.js` imported `@stripe/stripe-js` (non-pure entry), which injects `js.stripe.com` into every page at app start, including the public form. **Fixed**: both now use `@stripe/stripe-js/pure` and load lazily.
6. Sentry (with session replay), Firebase Analytics and Performance initialised for every visitor. **Fixed for `/r/*`** (they are skipped there); still on for the rest of the app.
7. Storage rules for existing attachment paths are not company-scoped.
8. Lint baseline was 273 problems largely because `functions/` was linted as browser ESM. I added Node/CommonJS overrides in `eslint.config.js` (now 140, none in new files). The remaining ones are pre-existing.

## 2. What was built

### Data model
- `companies/{id}`: `reportSlug`, `reportingEnabled` (absent = enabled). Company admins can no longer write these two fields from the client (rule); only functions or super_admin.
- `reportSlugs/{slug}`: `{companyId, active, createdAt, deactivatedAt?}`.
- `posts/{postId}` public case: `companyId, type, source:"public_link", isAnonymous:true, authorId:null, creatorId:null, authorName:"Anonymous", status:"open", priority:"medium", privacyLevel:"hr_only", involvesHR, category, title (first ~80 chars), description, content, attachments[{path,name,type,size}], caseCode, reportLang, reporterContactEncrypted?, createdAt, updatedAt` plus the legacy empty fields the HR UI expects.
- `caseAccess/{caseCode}`: `{postId, companyId, keyHash, failedAttempts:0, lockedUntil:null, createdAt}`. `keyHash = HMAC-SHA256(key = CASE_KEY_PEPPER, message = normalized secret key)`. The spec wrote `HMAC-SHA256(secretKey, CASE_KEY_PEPPER)`; I used the pepper as the HMAC key, which is the standard construction. Step 2 must use `verifySecretKey` (constant time; it normalizes case, separators, O→0, I/L→1).
- `rateLimits/{hmac}`: `{count, windowStart, expiresAt}` for per-IP/hour, per-company/day and idempotency tokens. Keys are HMACs, never raw IP.
- `postActivities`: `{postId, companyId, type:"created", actor:"public_reporter", metadata:{source, actor}, createdAt}`.

### Cloud functions (`functions/api/publicReportApi.js`, all v2 `onCall`, `enforceAppCheck: true`, CORS for the portal domain; any origin only inside the emulator)
- `getPublicReportConfig({slug})`: identical `not-found` for malformed, unknown, inactive slug, disabled company or slug mismatch. Returns `companyName, defaultLanguage, categories, limits`; never `companyId`.
- `submitPublicReport(...)`: also takes `uploadId` and `idempotencyToken` (client generated). Order: validate (including the honeypot and minimum-fill-time checks) → resolve slug → verify pending files (exist, ≤10 MB, MIME allowlist **and magic bytes match**) → claim idempotency token → per-IP (5/h) and per-company (50/day) limits → move files to `companies/{companyId}/cases/{postId}/` with generic names → one transaction creating post + `caseAccess` + activity with case-code collision retry → notifications (company_admin, plus hr unless `involvesHR`). Returns only `{caseCode, secretKey}`. Failures release the idempotency token so the reporter can retry; moved files are deleted if the transaction fails.
- `ensureReportSlug({companyId, rotate?})`, `setReportingEnabled({companyId, enabled})`: company_admin of that company or super_admin.
- `cleanupPublicReports` (`functions/scheduled/publicReportJobs.js`, every 6 h): deletes pending files older than 24 h and expired `rateLimits`.
- Helpers: `utils/caseKeys.js`, `utils/rateLimit.js`, `utils/reportSlugs.js`, `utils/publicReportValidation.js`, `config/publicReports.js`.
- `functions/config/firebase.js`: `serverTimestamp()`/`increment()` now use `FieldValue` from `firebase-admin/firestore` (the `admin.firestore.FieldValue` form was `undefined` in the Functions emulator).

### Scripts (not run)
- `scripts/backfillReportSlugs.js`: slugs for existing companies. Dry run by default, `--apply` to write.
- `scripts/backfillInvolvesHR.js`: sets `involvesHR:false` on existing posts. **Run this before deploying the new `firestore.rules`.** HR queries filter `involvesHR == false`, and an equality filter never matches a missing field, so without the backfill hr users would stop seeing every pre-existing post (and a direct read of such a post by hr is denied too). I used a direct `data.involvesHR == false` comparison in the rule on purpose: the `.get('involvesHR', false)` form let an unfiltered HR query return restricted posts in the emulator.

### Frontend
- Route `/r/:slug` (no `PrivateRoute`). `AuthProvider` no longer blocks rendering on `/r/*`; Sentry, Analytics and Performance are skipped there; page sets `noindex` and `no-referrer`.
- `src/pages/public/ReportPage.jsx`, `src/components/public/*`, `src/hooks/useEvidenceUploads.js`, `src/services/publicReportService.js`. Uploads start on selection to `public-reports/pending/{uploadId}/{random}.{ext}` (original file names never leave the device).
- Success screen: case code and secret key in large mono text, copy, `.txt` download, print (uses `@media print`), warning, "check my case" text with `TODO(step2)` where the link goes, a confirm checkbox gating "Done", `beforeunload` guard until confirmed. Nothing is placed in the URL, localStorage or sessionStorage; state is dropped on Done/unmount.
- App Check: initialised in `src/config/firebase.js` when `VITE_APPCHECK_SITE_KEY` is set (debug token supported in dev). The old commented block and `VITE_FIREBASE_APP_CHECK_KEY` are superseded.
- `CompanyQRCode.jsx`: link is `${VITE_PUBLIC_APP_URL}/r/{reportSlug}` (falls back to the current origin when unset), created via `ensureReportSlug` when missing; "Regenerate link" with confirm dialog; enable/disable switch; poster, print sheet and share text rewritten (no more "register"/"join"), copy via `report.link.*`.
- HR: public cases appear in the existing inbox; attachments are listed in the detail panel (`src/components/CaseAttachments.jsx`).
- i18n: `report.*` (113 keys) in en, es, fr, it, si, same order. English is the source; the other four are my own translations and should get a native review (Sinhala especially).

## 3. Verification done

Run against the Firebase emulators (nothing deployed):
- `functions/test/emulator/e2e.emulator.mjs` (functions + firestore + storage + auth): 33/33 checks pass: end-to-end submit, pending file moved and original deleted, `caseAccess` holds only a hash, case matches the post shape, contact stored encrypted only, activity actor, notifications (admin+hr; admin only for `involvesHR`), duplicate token rejected, **6th submission from the same hashed IP rejected** (`resource-exhausted`), filled honeypot and too-fast submission rejected, file with mismatching bytes rejected, missing pending file rejected, path outside the upload folder rejected, **bad slug / disabled company / inactive slug / malformed slug return identical errors** (also on submit), no raw IP or key in server-only collections, rotate/enable/disable and authorization of the slug callables.
- `functions/test/emulator/rules.emulator.mjs`: hr cannot read or update an `involvesHR` post; company_admin can; hr unfiltered company query is rejected and the `involvesHR==false` query works; employees and other companies cannot read posts; unauthenticated cannot read `caseAccess`, `reportSlugs`, `rateLimits` or `posts`; company_admin cannot write `reportSlug`; storage: pending upload accepts allowed type, rejects bad MIME, oversize and short `uploadId`; no read of pending or case files. One check **fails on the emulator only**: re-uploading to an existing pending path succeeds because the Storage emulator doesn't treat it as an update; verify against the real bucket.
- Browser run (Playwright, mocked callables): neutral inactive page, no redirect to `/login`, validation, client-side file type/size rejection, double click submits once, success screen, copy and download, state cleared after Done, language switching (en/fr/si), no uncaught errors, no third-party requests at all.
- Unit tests: `cd functions && npm test` (20 tests: case keys, rate limit transaction logic, slugs, validation, magic bytes).
- `npm run build` passes; `npm run lint` 140 problems vs 273 baseline, none in new files.

### Not verified
- **`CompanyQRCode.jsx` was not exercised in a browser** (needs an authenticated company_admin session). Build and lint pass; test checklist below.
- Real App Check and reCAPTCHA, real Cloud Storage and a deployed Functions runtime were not available.
- Evidence upload progress against the real Storage backend (the browser run mocked the callables only; files were exercised through the emulator by the e2e script).

### Manual checklist
1. As company_admin open `/company/qr-code`: a link `…/r/<name>-<4 chars>` appears and the QR opens it; Copy Link, Download, Print and Share show the new report copy.
2. Toggle reporting off: `/r/<slug>` shows "This reporting link is not active"; toggle on: form returns.
3. Regenerate: confirm dialog; old link shows the inactive page, new link works.
4. Submit a concern with a photo and a PDF; check the case in `/hr/inbox` as company_admin and as hr; open attachments.
5. Submit with "involves HR or management": visible to company_admin, absent for hr (and after running the backfill, regular posts still appear for hr).
6. Submit 6 times from one connection within an hour: the 6th is refused.

## 4. Deferred / out of scope (data is ready for them)
- Check-my-case page and reply callables (use `caseAccess`, `verifySecretKey`, `failedAttempts`, `lockedUntil`), voice recording UI (`audio/webm`, `audio/mp4` already allowed end to end), policy acknowledgement link, Stripe/signup changes, landing page, email alerts.
- HR gaps: decrypting and showing `reporterContactEncrypted` (decrypt with the same AES helper and secret as `decryptAuthorId`); a visible "involves HR" or "public report" badge and category in the inbox; the inbox detail panel is desktop-only (existing); `AdminActionPanel` can message the "reporter" but public reporters cannot read replies until Step 2; `postActivities` and `anonymousThreads` stay company-readable by hr for `involvesHR` posts (activities hold no content).
- The `Register` flow, `/qr-generator`, employee layouts and the feeds are untouched (removal phase).

## 5. Known limitations of this implementation
- A lost submit response cannot be recovered: a retry with the same idempotency token returns `already-exists` and the key is never shown again (by design; the alternative would mean storing a recoverable key). The UI tells the reporter to submit again.
- IPs are hashed with a static salt; IPv4 is small enough to brute-force if both the salt secret and a `rateLimits` doc leak. Docs live ≤1 day (company counter ≤24 h).
- The per-company 50/day cap can be used to exhaust a company's quota by anyone who gets past App Check; there is no CAPTCHA, so App Check, the per-IP limit and the honeypot are the only barriers.
- EXIF and other file metadata in uploaded photos is not stripped (file names are replaced).
- `x-forwarded-for` is taken from the platform (`rawRequest.ip`); fine behind Google's front end, not behind an arbitrary proxy.
- iPhone HEIC photos aren't accepted (the camera button asks for JPEG/PNG/WebP, which iOS converts).

## 6. Manual console steps and secrets

Secrets (Functions v2 secrets; for the emulator put the same names in `functions/.secret.local`, which is git-ignored):
```
firebase functions:secrets:set ANONYMOUS_SECRET   # must equal the VITE_ANONYMOUS_SECRET baked into the client build
firebase functions:secrets:set CASE_KEY_PEPPER    # e.g. node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
firebase functions:secrets:set IP_HASH_SALT       # same generator; keep it stable or rate-limit history resets
```

Console and deploy order:
1. Run `scripts/backfillInvolvesHR.js` (dry run, then `--apply`) and `scripts/backfillReportSlugs.js`.
2. Deploy functions (`getPublicReportConfig`, `submitPublicReport`, `ensureReportSlug`, `setReportingEnabled`, `cleanupPublicReports`), then `firestore.rules` and `storage.rules`, then hosting.
3. App Check: register the web app with reCAPTCHA v3, set `VITE_APPCHECK_SITE_KEY`, add the debug token for dev. **Enforce App Check for Cloud Functions, Firestore and Cloud Storage in the console.** Storage enforcement matters for the public upload path (the rules allow unauthenticated creates). Enforcing Firestore/Storage affects the rest of the app, so make sure every client has App Check initialised first.
4. Set `VITE_PUBLIC_APP_URL` (production: `https://portal.voxwel.com`).
5. TTL: enable a Firestore TTL policy on `rateLimits.expiresAt`: `gcloud firestore fields ttls update expiresAt --collection-group=rateLimits --enable-ttl`. The scheduled job is the fallback. Optionally add a Cloud Storage lifecycle rule (delete objects older than 1 day with prefix `public-reports/pending/`).
7. Add the new CORS origins if the portal domain differs from `portal.voxwel.com`/`voxwel.com`/`<project>.web.app` (edit `PORTAL_ORIGINS` in `publicReportApi.js`).
8. `firebase.json`: I added the Auth emulator port so the e2e script can sign in; no deploy impact.

## 7. Anti-spam without a CAPTCHA (Turnstile removed)

Cloudflare Turnstile is no longer used: no widget, no `VITE_TURNSTILE_SITE_KEY`, no `TURNSTILE_SECRET`, and the form loads no third-party script. Remaining defences, in order of strength:

1. **App Check (reCAPTCHA v3)** on every public callable. This is the main bot filter.
2. **Rate limits**: 5 submissions per hashed IP per hour, 50 per company per day, single-use idempotency token.
3. **Honeypot field** (`website`) and a **3 second minimum time on the form** (`elapsedMs`), both checked server-side. A script can forge these, so they only stop casual bots.
4. Server-side validation, MIME sniffing and a 10 MB, 5-file limit.

Known gap: a determined attacker with valid App Check tokens can use up a company's 50/day quota and block real reports. If that happens, raise the quota, rotate the report link from the QR page, or add a proof-of-work challenge (self-hosted, no third party).
