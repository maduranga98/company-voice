# STEP 4 notes: policy acknowledgement link (no login)

Branch: `rework/policy-ack` (local), pushed to `claude/epic-ritchie-csgymd` (the session's designated branch).

## 0. Read this first

1. **Billing integrity: the distinct-employee count can be inflated by anyone who has the link.** Employee ID and name are self-declared and nothing authenticates them, so someone with the link (or a leaked QR poster) can submit made-up IDs and each one becomes a "distinct employee". Defences, in order of strength: (a) the optional **roster + "only accept IDs on this roster"** switch on the link page (unknown IDs are refused and never stored), (b) App Check, (c) per-IP 60/hour and per-link 5,000/day caps, (d) the honeypot + 2 s minimum fill time. Without a roster, only (b)-(d) apply. Every `policyEmployees` doc carries `onRoster` (`true` / `false` / `null` = link had no roster) so Step 5 can choose to bill only roster-verified employees. Recommendation: make the roster mandatory (or at least strongly encouraged) before billing is wired to this count.
2. **Existing `policyAcknowledgements` is untouched, and the new data deliberately does NOT live under it.** The brief suggested `policyAcknowledgements/{companyId}/entries`. That name is already a flat collection with two incompatible doc shapes (`{companyId}_{userId}` banner docs and `addDoc` docs keyed by `policyId` + `userId`), its rules and `deletePolicy` cleanup assume that shape, and a subcollection called `policyAcknowledgements` would also be pulled into any collection-group query on that name. The new data uses distinct names (section 1).
3. The old logged-in flow is effectively dead (employee accounts were removed in the removal phase), so `PolicyManagement`'s stats modal still counts `users` acknowledgements and shows "0 of N" style numbers from a population that no longer exists. Left as is, not in scope; the new page replaces it as the useful view.
4. Branch note: the task asked for `rework/policy-ack`; the session is configured to push to `claude/epic-ritchie-csgymd`, so work lives on the former locally and is pushed to the latter.

## 1. What was built

### Policy data model (confirmed before building)
Read `PolicyManagement.jsx` + `policyService.js` first. `policies/{id}` = `{companyId, title, category, version, effectiveDate, requiresAcknowledgement, content, fileUrl, fileName, status: draft|published|archived, createdBy, publishedAt, ...}`. Rules: staff of the company read/write. The public flow reads **this same document live** (only `status == "published"`), so there is one policy store and edits/archives take effect on the link immediately. `version` is the existing free-text field; acknowledgements are per version.

### Firestore
| Path | Purpose | Written by | Read by |
|---|---|---|---|
| `policyLinks/{slug}` | `{companyId, policyId, active, requireRoster, rosterCount, createdBy, createdAt, deactivatedAt?}`. One link per policy. | functions | staff of the company |
| `policyLinkRosters/{slug}` | `{companyId, employees:[{employeeId, employeeKey, name}], updatedAt}` (max 3,000) | functions | staff of the company |
| `companies/{cid}/policyResponses/{id}` | one doc per **acknowledgement** (id = `sha256(policyId, version, employeeKey)`, so it is deduped by construction) or per **concern** (auto id, `postId` points at the HR inbox post) | functions | staff of the company |
| `companies/{cid}/policyEmployees/{employeeKey}` | **one doc per distinct employee who ever acknowledged anything**: `{employeeKey, employeeId, employeeName, onRoster, firstAcknowledgedAt, lastAcknowledgedAt, lastPolicyId, acknowledgementCount}` | functions (inside the ack transaction) | staff of the company |
| `posts/{id}` | a raised concern, see below | functions | existing rules |

`employeeKey` = employee ID with all whitespace removed and lower-cased (NFKC-folded): `"EMP 0042"`, `" emp0042 "` are the same person; `EMP-0042` is **not** (hyphens are significant, since IDs differ by them in the real world). Allowed ID characters: letters, digits, space, `.`, `_`, `-`, first char alphanumeric, 1-40 chars (no `/`, so the key is always a legal doc id).

### Billing hook (Step 5 groundwork, not built)
The billing quantity is **the document count of `companies/{companyId}/policyEmployees`**:
```js
// functions/utils/policyAck.js (already written and unit tested)
await countDistinctAcknowledgedEmployees(db, companyId);                       // ever
await countDistinctAcknowledgedEmployees(db, companyId, { sinceMs });          // active since a date
// = db.collection('companies').doc(id).collection('policyEmployees').count().get()
```
One aggregation query (billed as one read per 1,000 index entries), no scan of `policyResponses`. A concern alone does **not** add an employee: the spec says "who've ever acknowledged". "Distinct *active* employees per month" is `where('lastAcknowledgedAt', '>=', monthStart)` on the same collection.

### Cloud functions (`functions/api/policyAckApi.js`, v2 `onCall`, `BASE_OPTIONS` = App Check enforced + portal CORS)
- `getPolicyForLink({slug})`: identical `not-found` for malformed, unknown, paused link, missing/unpublished policy, or company mismatch. Returns `companyName, defaultLanguage, requireRoster, policy:{title, category, version, effectiveDate, content, fileName, fileUrl}`; never `companyId`/`policyId`. `fileUrl` is only passed through when it is a `https://firebasestorage.googleapis.com/` URL. Per-IP 200/hour.
- `submitPolicyAcknowledgement({slug, employeeId, employeeName, response: "acknowledged"|"concern", concernText?, policyVersion, idempotencyToken, website, elapsedMs, clientLang})`. Order: validate (`sanitizeText` reuse) -> resolve link -> **version must equal the live policy version** (`failed-precondition` with `details.reason = "policy_updated"`, so nobody acknowledges text they did not see) -> per-IP 60/hour, per-link 5,000/day (and for concerns per-employee-per-policy 5/day) -> roster check when `requireRoster` (`details.reason = "not_on_roster"`) -> write.
  - Acknowledgement: one transaction (`recordAcknowledgement`) creating the deterministic response doc and creating/updating the `policyEmployees` doc. A repeat is a **success** (`already_acknowledged`), not an error, and changes nothing.
  - Concern: single-use idempotency token (15 min, released on failure), then one batch: a `posts` doc + a `policyResponses` concern doc + a `postActivities` entry; then notifications. Replays return `already-exists` (the page treats that as received).
- Staff callables (`company_admin`, `hr`, `super_admin`, company enforced from the **policy/link document**, never from the client): `ensurePolicyLink({policyId})` (creates on first use, same link afterwards; only published policies), `setPolicyLinkActive({slug, active})`, `setPolicyLinkRoster({slug, rosterText?, requireRoster?})` (parses `ID, Name` lines; comma/semicolon/tab; header line skipped; duplicates dropped; invalid lines reported back; refuses to require an empty roster, which would lock everyone out).
- Slug: same `buildSlug` as `/r/:slug` (company name + 4 random base32 chars), collision-checked in the transaction, separate collection (`policyLinks`).
- Logs: error codes only, never the IP, names, IDs or concern text. Rate-limit keys are HMACs (`IP_HASH_SALT`); nothing personal in `rateLimits`.
- No new secrets: reuses `IP_HASH_SALT`.

### Concerns -> HR queue
A concern becomes a normal `posts` doc in the same shape as public reports (`type: problem_report`, `privacyLevel: hr_only`, `status: open`, `priority: medium`, `category: "policy_concern"`, `source: "policy_link"`, `title: "Policy concern: <policy>"`, `description` + `content`) but **not anonymous**: `isAnonymous: false`, `authorName` = the typed name, plus `employeeId`, `policyId`, `policyVersion`, `policyTitle`. `authorId`/`creatorId` stay `null` (no account). `involvesHR: false`, so both `company_admin` and `hr` see it in the existing `/hr/inbox` with no query changes. `HRInbox.jsx` gets a small "Policy concern" block in the detail panel (policy, version, name, employee ID). New notification type `policy_concern` (`NotificationType.POLICY_CONCERN`) goes to active `company_admin` + `hr` users with generic text (no employee name in the notification). The concern text is stored in plain text like any non-anonymous post (no encryption: nothing secret, per the brief). There is no `caseAccess`/secret key and therefore no reply path to the employee: HR contacts them out of band using the name/ID.

### Frontend
- Route `/p/:slug` (no `PrivateRoute`). `isPublicReportRoute()` now also matches `/p/*`, so App Check still initialises but session restore, Sentry, Analytics and Performance stay off, same as `/r` and `/c`.
- `src/pages/public/PolicyAckPage.jsx` (+ `components/public/PolicyHeader.jsx`): company name, policy meta (category, version, effective date), read-only content in a scrollable region, PDF link if the policy has one. Form: employee ID + full name, a segmented switch (**Acknowledge** / **Raise a concern**), checkbox "I have read and understood this policy" or a textarea (10-2,000 chars) with a visible "not anonymous" note. Honeypot field, 2 s minimum fill time. Confirmation screen only: no credentials, no download/print, nothing to safeguard. Same palette/layout as `ReportPage`/`CheckCasePage` (`#2D3E50` navy, `#1ABC9C` teal, `#FF6B6B` for errors). `noindex`, `no-referrer`. Nothing is persisted: no localStorage/sessionStorage, nothing in the URL. A "policy updated" error reloads the new version in place and clears the confirmation tick. New shared hook `src/hooks/useNoIndex.js` (the two older pages still carry their own copies; not touched).
- Staff page `src/pages/company/PolicyAckLink.jsx` at `/company/policies/:policyId/link` (inside `CompanyAdminLayout`, `company_admin` + `hr`): creates the link on first visit, shows URL (copy / open), QR code (same `qrcode` options as `CompanyQRCode.jsx`, download PNG), active/paused switch, the optional roster editor with the "only accept IDs on this roster" switch, and the **who has / hasn't acknowledged table** (filters All / Not yet / Acknowledged / Concerns, search by ID or name, version selector, counts, "not on roster" marker, link to the HR inbox when concerns exist). Reached from a new link icon on published policies in `PolicyManagement.jsx`. Table logic is the pure `src/utils/policyAckReport.js`.
- `src/services/policyAckService.js`: callable wrappers + error-to-i18n-key mapping.
- i18n: `report.policy.*` (public page, 42 keys) and `report.policyLink.*` (staff page, 45 keys) added right after `report.checkCase` in en, es, fr, it, si, same key order and same `{{placeholders}}` across all five (checked by script). English is the source; es/fr/it/si are my own translations, same caveat as steps 1-2: native review recommended, Sinhala especially. `InactiveLink` got optional `titleKey`/`bodyKey` props so the policy page doesn't say "reporting link". `HRInbox.jsx`'s new block is English-only like the rest of that file.

### Rules
`firestore.rules`: `policyLinks`, `policyLinkRosters` (top level) and `companies/{id}/policyResponses`, `companies/{id}/policyEmployees` are readable by the company's staff (and super_admin), `write: if false` for everyone (functions use the Admin SDK). No index changes (all client queries are single-field equality).

## 2. Verification done

- `cd functions && npm test`: **55 tests** (38 before + 11 `policyAck` + 6 `policyAckReport`). Covers: employee-ID normalization, deterministic ack id, input validation (ids, names, response, concern length, honeypot, elapsed, HTML stripping, language fallback), roster parsing, **the dedupe-by-employee-and-policy-version transaction** (duplicate is a no-op and does not bump the count; new version or new policy is a fresh ack; one roster doc per distinct employee), the `countDistinctAcknowledgedEmployees` query shape, and the table-merge logic (pending/ack/concern precedence, ordering, off-roster, timestamps, versions).
- **Functions emulator e2e** (`functions/test/emulator/policyAck.emulator.mjs`, functions + firestore + auth emulators): **42/42**. Includes authz (sign-in required, other company refused, draft policy refused), idempotent link creation, identical errors for unknown/malformed/paused links, unpublished policy no longer served, non-storage `fileUrl` never exposed, no ids in responses, ack + dedupe (case/space variants), stale-version refusal, version bump -> fresh ack but still one distinct employee, `count()` = 2 distinct employees, validation and bot traps, HTML stripped, concern -> exactly one HR post with the right shape, token replay refused, concern does not enter the billing roster, notifications only to admin + hr of that company, activity log, per-employee concern limit, roster parse/enforce/`onRoster`, empty-roster guard, no raw IP/name/ID in `rateLimits`, per-IP limit blocks bulk submissions.
- **Rules emulator** (`rules.emulator.mjs`, extended): own-company staff and super_admin read all four collections; another company's HR, a role-less Firebase user and unauthenticated users cannot; nobody can write; own-company list queries work, cross-company ones are denied. All new checks pass. One pre-existing check still fails on the emulator only ("anon cannot overwrite pending", the Storage emulator gap documented in step 1).
- **Browser run** (Playwright + Chromium, mocked callables, 390 px viewport): policy renders, submit gating, double click submits once, payload shape, nothing in localStorage/sessionStorage/URL, reset, concern flow + validation, en/fr/si, inactive link page, errors (`not_on_roster`, rate limit, invalid), policy-updated reload, already-acknowledged screen, no horizontal scroll, no uncaught errors, no third-party requests (apart from the Google Fonts stylesheet that `index.html` loads on every page, see weaknesses).
- `npx eslint` clean on every new/changed file except 3 problems already present in `PolicyManagement.jsx` (`statsAcks`, `asDraft`, a hook-deps warning; same on a clean checkout); repo-wide count unchanged. `npm --prefix functions run lint` (the deploy predeploy hook) passes. `npm run build` passes.
- All 5 locale files re-validated: `report.*` has identical key order and placeholders; every `t()` key used by the new code exists.

### Not verified
- **`PolicyAckLink.jsx` (the staff page) was not exercised in a browser**: it needs an authenticated `company_admin`/`hr` session plus Firestore. Build and lint pass; the callables it uses and the rules it relies on are covered by the emulator runs, and its table logic by unit tests. Run the manual checklist below.
- Real App Check (reCAPTCHA Enterprise) and a deployed Functions runtime; the emulator only checks that an App Check header is present.
- The QR code scanned with a phone, and the link opened on real devices/networks.
- The pre-existing flaky test `test/passwords.test.js` ("password policy and temporary passwords") fails intermittently (2 of 7 runs here): its regex excludes lowercase `i` but the generator can emit it. Unrelated to this step, not touched.

## 3. Manual checklist

1. As `company_admin`, publish a policy in `/company/policies`, click the new link icon: a `…/p/<company>-<4 chars>` link and QR appear. Copy, open, download the QR.
2. Open the link in a private window: company name, policy text, optional PDF link. Acknowledge as "EMP-1 / Test": confirmation screen. Do it again with " emp-1 ": "Already on record".
3. On the staff page the table shows EMP-1 as Acknowledged; counts update after a reload.
4. Paste a roster (`EMP-1, Test` / `EMP-2, Other`), save: EMP-2 is "Not yet". Tick "only accept IDs on this roster": an unknown ID on the public page gets the "not recognised" error.
5. Raise a concern: it shows in `/hr/inbox` (as `company_admin` and as `hr`) with the "Policy concern" block, and both get a notification.
6. Edit the policy, bump `version` to `2.0` (and save): reload the table, select v1.0 / v2.0 in the selector; open the public page in an old tab and submit: "policy updated" message and the new text appears.
7. Pause the link: the public page shows "This policy link is not active"; resume.

## 4. Deploy and console steps

1. Deploy functions (`getPolicyForLink`, `submitPolicyAcknowledgement`, `ensurePolicyLink`, `setPolicyLinkActive`, `setPolicyLinkRoster`), then `firestore.rules`, then hosting. Deploy the functions first: the staff page calls `ensurePolicyLink` on load.
2. No new secrets (uses `IP_HASH_SALT`), no backfill, no new indexes.
3. Optional Firestore TTL is already covered by the `rateLimits.expiresAt` policy from step 1.
4. `VITE_PUBLIC_APP_URL` is used for the link/QR exactly as for the report link.

## 5. Known weaknesses and limitations

- **Billing integrity**: see section 0, item 1.
- **Unauthenticated by design**: anyone with the link can acknowledge on behalf of anyone else (no proof of who is typing). The roster only stops unknown IDs, not impersonation of a known one. The record is "someone claiming to be EMP-42 acknowledged", which is weaker evidence than a logged-in acknowledgement; say so to customers who need it for compliance.
- **Office networks**: per-IP caps are deliberately high (60 submits/hour, 200 views/hour) because a rollout puts a whole site behind one IP; that also makes the per-IP limit a weak brake against a determined attacker. The per-link cap (5,000/day) and App Check are the real ceiling.
- **Roster ID probing**: with "only accept IDs on this roster" on, a wrong ID returns a distinct error, so someone with the link can test which IDs exist (rate-limited, no names are returned).
- **Deleting a policy** (existing `deletePolicy`) removes the policy and the old-style acks but leaves `policyLinks`, `policyLinkRosters` and `policyResponses`. This is intentional for the responses (they are compliance evidence and carry a denormalised `policyTitle`); the link stops resolving because the policy is gone. Cleaning up orphan links/rosters is not done.
- Concern posts use `involvesHR: false`, so a concern *about HR* is visible to HR. The form has no "involves HR" toggle (keeping it minimal); add one if wanted (it maps straight onto the existing field).
- Roster and responses hold names/IDs in plain text (non-secret by the brief) and the roster is a single doc (3,000 employees max, ~300 KB paste limit).
- Acknowledging a policy whose `requiresAcknowledgement` is `false` is still allowed; that flag is not consulted.
- `index.html` loads Google Fonts for every page, including the public ones, which sends the visitor's IP to Google. Pre-existing (from the rebrand), not changed here; self-hosting the font would close it for `/r`, `/c` and `/p`.

## 6. Deferred / out of scope

Step 5 (Stripe, the billing quantity itself), reminders to people who haven't acknowledged (the old "Send Reminder" button is still a placeholder), CSV export of the table, per-employee magic links or any real identity check, email/SMS distribution of the link, a "concerns" tab with threading/replies to the employee, updating the old logged-in stats modal. See `STEP2_NOTES.md` section 4 for the rest (voice recording UI, signup changes, landing page rewrite).
