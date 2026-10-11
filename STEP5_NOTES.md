# STEP 5 notes: unified case management, phase A (shared case-handling core)

Branch: `rework/case-mgmt-core`. Phases B (case detail route), C (cross-type overview + SLA)
and D (routing rules) follow on their own branches.

## 1. What was built

### Shared core
- `src/utils/caseTypes.js`: one adapter per case source (`post` -> `posts`,
  `vendor` -> `vendorReports`, `moderation` -> `contentReports`) holding the collection,
  that page's own status vocabulary/config, default status, which statuses count as
  closed, title/created-at/priority accessors and whether status is editable. Vendor
  status stays open/investigating/escalated/resolved/closed; moderation keeps
  `ReportStatus`; `PostStatus`/`PostPriority` are untouched.
- `src/services/caseService.js`: `updateCaseStatus`, `updateCasePriority`, `assignCase`,
  `unassignCase`, `setCaseDueDate`, `addCaseNote`, `getCaseNotes`, `getAssignableUsers`.
  For `post` each call delegates to the existing `postManagementService` function
  (permissions, `postActivities` log and author notifications unchanged). Vendor and
  moderation share one generic implementation that logs to a new `caseActivities`
  collection and stores internal notes in a new `caseNotes` collection.
- `src/components/case/CaseHandlingPanel.jsx`: extracted from `AdminActionPanel`
  (same layout: status, priority, expandable assignee / due date / notes). Props:
  `caseType`, `caseData`, `currentUser`, `onUpdate`, optional `children`.
- `AdminActionPanel` is now a ~20-line wrapper: the shared panel plus the post-only
  `AnonymousThread`. HRInbox and AssignedToMe are not touched.

### Adopters
- **Vendor Risk**: the detail overlay's status buttons + single overwritable
  `reviewNotes` textarea are replaced by the shared panel (status, priority,
  assignee, due date, append-only notes). Legacy `reviewNotes` is still shown,
  read-only, as "Earlier Review Notes". List cards show assignee and due date.
- **Moderation**: the shared panel is on `ReportDetailView` (the existing
  `/moderation/report/:id` page); list rows show assignee and due date. Status is
  **read-only** in the panel here (`statusEditable: false`): moderation status only
  moves through `reviewReport()` (dismiss / remove / strike / escalate), which does the
  real work; a free dropdown would let status drift from what was done to the content.
  Say so if you want it editable anyway.
- New vendor reports are written with `priority` (= severity), `assignedTo: null`,
  `dueDate: null`.

### Rules and backfill
- `validCaseFields()` helper in `firestore.rules`: when present, `priority` must be one
  of the four levels, `assignedTo` null or `{type: user|department, id, name}`,
  `dueDate` null or a timestamp. Applied to create/update on `vendorReports` and
  `contentReports`.
- New append-only `caseActivities` and `caseNotes` rules: read by staff of the same
  company, create restricted to the company and to `caseType` vendor/moderation
  (notes also require `authorId == auth.uid`), no update/delete.
- `scripts/backfillCaseFields.js` (dry-run by default, `--apply` to write): sets
  `priority` (vendor: from severity; otherwise "medium"), `assignedTo: null`,
  `dueDate: null` where missing. Never overwrites. The app does not depend on it
  (readers fall back to severity / "medium").

### i18n
`casePanel.*` (17 keys) in all 5 locales, same key order, placed after `adminPanel`
(`si.json` had no `adminPanel`, so `casePanel` is appended at the end).
es/fr/it/si translations are mine; native review recommended, Sinhala especially.

## 2. Things found that differ from the brief
- The "reports" collection is `contentReports`, not `reports`.
- There is no `audit_logs` collection. Post history is `postActivities`, moderation
  history is `moderationActivities`, `systemAuditLogs` is system-level, and vendor
  reports logged nothing. Hence the new `caseActivities`. Phase B's timeline will merge
  `postActivities` / `moderationActivities` / `caseActivities` per case type.
- `isAuthenticated()` in the rules already means staff (super_admin / company_admin /
  hr), so "any authenticated user can update vendorReports" was never broader than
  staff. The rule change here is field validation, not a permission tightening.

## 3. Small behaviour changes vs. the old AdminActionPanel
- The assignee search box now always shows (it was hidden for anonymous posts, which
  looked unintentional).
- Clearing the due date now actually clears it (before it toasted "Due date set" and did nothing).
- Toasts and panel strings are i18n'd (`casePanel.*`); status/priority labels still come
  from the existing English-only configs, unchanged.
- Pre-existing, unchanged: the `userTagId`-only assignable list, `isAdmin` role check.

## 4. Verification done
- `npm run build`: passes.
- `npx eslint` on every new/changed file: clean, except 2 errors + 2 warnings in
  `ReportDetailView.jsx` / `ModerationDashboard.jsx` that exist identically on `main`.
- 5 locale files parse and keep key order.

### Not verified
- No Firebase emulator or browser run: panel behaviour on all three case types, the
  new rules (`validCaseFields`, `caseActivities`, `caseNotes`), and the backfill script
  are untested. Rules in particular should go through the emulator before deploy.
- Deploy order: ship the rules together with (or before) the client; run
  `backfillCaseFields.js` dry-run first.
- Composite indexes: `caseNotes` is queried by `companyId` + `caseId` (equality only,
  no index needed). Activity queries land with Phase B.

## 5. Manual checklist
1. HR Inbox: expand a post, change status / priority / assignee / due date / add a note;
   behaviour as before, plus clearing the due date.
2. Vendor Risk: open a report, set status "investigating", assign someone with a due
   date, add two notes; list card shows assignee and due date; legacy `reviewNotes`
   still visible.
3. Moderation: open a report, set priority and assignee; status shows read-only; run a
   moderation action and confirm the badge updates.
4. Firestore: `caseActivities` has one doc per change; `caseNotes` has the notes.
