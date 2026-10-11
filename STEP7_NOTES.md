# STEP 7 notes: unified case management, phase B (case detail route)

Branch: `rework/case-mgmt-detail-route`, on top of phase A (PR #200, already on `main`).
The earlier stranded version of this work (`rework/case-detail-route`, PR #201) was merged into
the phase A branch after #200 had merged, so it never reached `main`; this branch re-applies it
on current `main` (after the HR Inbox redesign, #205/#206).

## 1. What was built

- **One URL shape: `/cases/:caseType/:caseId`**, `caseType` in `post | vendor | moderation`
  (`caseHref()` in `utils/caseTypes.js` is the only place that builds it). Wrapped in
  `PrivateRoute` + `RoleBasedLayout`, same as the other shared staff pages.
- `src/pages/CaseDetail.jsx`: header (type, reference code, anonymity, status/priority
  badges, due date, copy-link), the submission content for each type, attachments
  (`CaseAttachments`, vendor `attachmentUrls` mapped into it), vendor corroborations,
  the anonymous reporter conversation (`AnonymousThread`, open by default, posts only),
  the shared `CaseHandlingPanel` from phase A, and the timeline.
- **Timeline** (`caseTimelineService.js` + `CaseTimeline.jsx`): no new logging. It
  merges what already exists per type: `postActivities` (posts), `caseActivities`
  (vendor, moderation, from phase A) and `moderationActivities` (moderation). Internal
  notes appear because every note already writes an `admin_comment` activity. A
  synthetic "Case created" row is added when the log has no creation entry.
- **Entry points** (`OpenCaseLink`, "Open full case"): HR Inbox (desktop panel header and
  mobile inline section), AssignedToMe (expanded header), Vendor Risk overlay header,
  Moderation list rows. Inline quick-expand is unchanged everywhere.
- Moderation: the case page shows summary + panel + timeline and links to the existing
  `/moderation/report/:id` for the actual moderation actions (remove / warn / suspend
  / escalate), which stay on that page. Row click still goes to that page.
- **Deep links survive sign-in**: `PrivateRoute` now passes `state.from`, and `Login`
  navigates back to it (same-app paths only) instead of always `/dashboard`. Before this,
  a shared case link would land on the dashboard after login.
- Access: staff roles only; non-super-admins are checked against `companyId`; a
  Firestore `permission-denied` (e.g. HR opening an `involvesHR` post) renders the
  "No access" state rather than leaking existence; unknown type or missing doc renders "not found".
- i18n: `caseDetail.*` (about 50 keys) in all 5 locales, same order, placed after
  `casePanel`. Translations are mine; native review recommended, Sinhala especially.

## 2. Verification done
- `npm run build` passes; `npx eslint` clean on every new/changed file.
- Locale files parse and keep key order.

- **Phase A foundation verified in the Firestore emulator** (this branch, 33 checks,
  `scripts/emulator/caseRules.test.mjs`): `validCaseFields` accepts the exact payloads
  `caseService` writes (priority / assign user + department / unassign / due date) on both
  `vendorReports` and `contentReports`, and rejects bad priority, bad assignee type or
  shape, non-timestamp due date, other-company and signed-out writes; legacy docs without
  the case fields still update; `caseActivities`/`caseNotes` create correctly, reject
  `caseType: post`, cross-company writes and spoofed `authorId`, and are append-only; the
  timeline/notes queries (`companyId`+`caseId`, `moderationActivities` by `reportId`) pass
  as HR and are denied cross-company.
- **`scripts/backfillCaseFields.js` verified against the emulator** with real-shaped legacy
  docs: dry run reports counts without writing; `--apply` sets `priority` (vendor from
  `severity`, else `medium`), `assignedTo: null`, `dueDate: null`; docs already carrying the
  fields are untouched; re-run is a no-op. Note it also replaces an *invalid* stored
  priority (e.g. `"weird"`) with `medium`, by design.

### Not verified
- No browser run, and no run against a live project. Untested: the three load paths in the
  UI, the permission-denied state for HR on `involvesHR` posts, deep link through login,
  copy-link in an insecure context. The post timeline query is not exercised by the
  emulator script (only rules-level queries are).
- Timeline queries are equality-only and sorted client-side (the existing ordered `getPostActivityTimeline` needs a `postActivities (companyId, postId, createdAt)` composite index that is not in `firestore.indexes.json`, and swallows the error into an empty list), so they need no index and are uncapped.
- The activity text for status/priority uses the stored value for priority (not translated)
  and the English-only status labels already in `constants.js`.
- Pre-existing and unchanged: `moderationActivities` entries carry `userId` but no name,
  so moderation actions show "Someone reviewed: ..." until a name is logged.

## 3. Manual checklist
1. HR Inbox -> select a case -> "Open full case"; reload the page and confirm the same case.
2. Paste the URL in a fresh signed-out tab; sign in; you land on the case.
3. Change status, priority, assignee, add a note; the timeline updates after each.
4. As an HR user, open `/cases/post/<id of an involvesHR case>`: "No access".
5. Vendor and Moderation cases from their lists; the moderation "Open moderation actions" link.
