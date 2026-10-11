# STEP 9 notes: unified case management, phase D (rule-based routing)

Branch: `rework/case-mgmt-routing`, stacked on `rework/case-mgmt-overview` (phase C, PR #212) which is
stacked on `rework/case-mgmt-detail-route` (phase B, PR #211). Its PR targets the phase C branch;
retarget as the lower PRs merge.

The rule shape was confirmed with Madu before the UI was built (see 1.1).

## 1. What was built

### 1.1 Rule model (confirmed)
`companies/{companyId}/routingRules/{ruleId}`:

| field | meaning |
|---|---|
| `name` | up to 80 chars |
| `enabled` | disabled rules are skipped |
| `order` | lower runs first; **first rule that matches and resolves wins** |
| `conditions` | `caseTypes`, `priorities`, `categories`, `sources`, `departmentIds`: string lists; missing/empty = any; groups ANDed, values within a group ORed |
| `action` | `{type: user \| department \| userTag, id, name}` |

Differences from the proposal: **no `status` condition**. A new case always has its initial status,
so it can never discriminate. Source values are `public_link`, `policy_link`, `internal`.
What each case type exposes to conditions (`functions/utils/routingRules.js caseFacts`):
posts: priority, category, source, departmentId; vendor: priority (falls back to severity),
`riskCategory`; moderation: priority, `reason`. A rule constraining a field the case does not have
never matches that case.

### 1.2 Where evaluation hooks in
Creation paths found: posts are written by the client **and** by Cloud Functions
(`submitPublicReport`, policy-link concerns), vendor reports and moderation reports by the client. So
the hook is three Firestore `onDocumentCreated` triggers (`posts`, `vendorReports`, `contentReports`;
`functions/triggers/caseRoutingTriggers.js`) rather than code in each writer; it covers every path,
present and future, and keeps the logic out of the browser. The logic is
`functions/services/caseRouting.js` (`routeCase(db, caseType, caseId, data)`).

### 1.3 Behaviour
- Acts only on a case with no assignee; re-checks inside a transaction, so a person who assigns
  first always wins and a redelivered trigger is a no-op. Never sets a due date, status or priority.
  **Manual reassignment in `CaseHandlingPanel` always overrides afterwards**: rules run once, at creation.
- `userTag` rotates round-robin over active HR/company_admin members holding the tag (stable name
  order; cursor in server-only `companies/{id}/routingState/{ruleId}`).
- An unresolvable target (inactive user, other company, empty tag, deleted department) is skipped
  and the next matching rule is tried.
- **Privacy: `involvesHR` cases are only ever auto-assigned to `company_admin` users**, never
  to `hr`-role users (HR may not see those cases). Not in the original brief; I added it because a
  careless "assign to tag" rule would otherwise leak exactly the cases the Directive flow hides from HR.
- History + notification use the shapes the client writes: `postActivities` (posts) /
  `caseActivities` (vendor, moderation) entry of type `assigned` with `metadata.adminName = "Routing rule: <name>"`
  (so the Phase B timeline shows it as-is) and an `assigned` notification for user targets. The assignment
  carries `routedByRule` and `assignedBy: "Routing rule: <name>"`.
- Failures never throw out of the trigger (the case simply stays unassigned).

### 1.4 UI
`/company/routing-rules` (Settings group in the sidebar, **company_admin only**): ordered rule list
with enable toggle, up/down reorder, edit, delete, and an inline editor (chip groups for conditions, target picker).
Same visual language as the case pages (card tokens, chips, `#1ABC9C` / `#2D3E50`). Strings in a new
`routingRules.*` namespace (5 locales) because none of it fits `casePanel`; `navigation.routingRules` added.
es/fr/it/si translations are mine; native review recommended, Sinhala especially.

### 1.5 Rules
`validRoutingRule()` + `companies/{id}/routingRules` (read: company staff; write: company_admin of that
company or super_admin; shape-validated, unknown fields rejected) and `routingState` (no client access).

## 2. Verification done
- Firestore emulator, rules (`scripts/emulator/caseRules.test.mjs`, 56 checks total, 14 new): admin can create/update/delete
  valid rules; HR can read but not write; cross-company denied; bad action type, unknown fields/condition keys,
  non-list conditions, empty name rejected; `routingState` not client-writable.
- Firestore emulator, routing logic with the real service code (`functions/test/emulator/caseRouting.emulator.mjs`, 16 checks): first
  match wins, disabled ignored, user/department/tag targets, history + notification written, vendor path,
  no-match leaves unassigned, tag rotation, `involvesHR` handling (hr excluded, admin chosen), fall-through past
  cross-company/inactive targets, stale-snapshot and re-delivery no-ops.
- `functions` unit tests (`routingRules.test.js` + existing): 65 pass. `npm run build` passes; eslint clean on new files.

### Not verified
- **The triggers themselves have not run** (no Functions emulator): the wiring in `caseRoutingTriggers.js` and
  `index.js` is only load-checked. Trigger region must match the Firestore database location (default
  `us-central1`); set `region` in `onDocumentCreated` options if the project's database is elsewhere.
- No browser run of the rules page.
- Tag rotation has no concurrency guarantee beyond a transaction on the cursor: two simultaneous cases
  get different members, but a cursor transaction retry may skip one position. Fairness, not correctness.
- Rules only affect cases created after deploy; existing unassigned cases are not back-filled.
- A new trigger doubles as a write: each routed case costs one extra update, which does not re-fire creation triggers.

## 3. Deploy order
1. `firebase deploy --only firestore:rules` (rules + `validRoutingRule`).
2. `firebase deploy --only functions:routeNewPost,functions:routeNewVendorReport,functions:routeNewContentReport`.
3. Client. No index is needed (all queries are equality-only).

## 4. Manual checklist
1. As company_admin open Settings > Routing rules; add "Safety -> Legal dept" (category safety, assign department); add a tag rule.
2. Submit a public report in category `safety`: it arrives in HR Inbox already assigned to the department, timeline shows "Routing rule: ...".
3. Submit a report flagged "involves HR" matching a tag rule that holds HR + admin members: only an admin is assigned.
4. Reassign the case in the panel: it stays reassigned. Reorder rules and disable one; submit another case.
5. As HR: Routing rules is absent from the sidebar and `/company/routing-rules` redirects.
