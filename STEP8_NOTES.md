# STEP 8 notes: unified case management, phase C (cross-type overview + SLA)

Branch: `rework/case-mgmt-overview`, stacked on `rework/case-mgmt-detail-route` (phase B, PR #211), which is on `main`
after phase A (PR #200). Its PR targets the phase B branch; retarget to `main` once B merges.
This re-applies the earlier stranded `rework/case-overview` (PR #202) on current `main`.

## 1. What was built

- **`/hr/case-overview`** (`src/pages/hr/CaseOverview.jsx`, sidebar "Case Overview" for HR
  and company_admin): every open case across `posts`, `vendorReports` and `contentReports`
  for the user's company, in one list.
  - Tiles: open / overdue / at risk / unassigned (the middle three are click-to-filter).
  - Filters: case type (with counts), "assigned to me".
  - Sort: soonest "needs attention by" date first (cases without one last), then priority,
    then oldest.
  - **List is the default; board is a toggle** on the same page (remembered in
    localStorage). Board columns are the case type's own open statuses. With "All"
    selected, one board per type is stacked, because the three types do not share a
    status vocabulary (deliberately, per phase A).
  - Rows/cards link to `/cases/:caseType/:id` (phase B).
- **What counts as "overdue / at risk"**: each case has one date, the sooner of its assigned
  `dueDate` and, for public-report posts, the earliest unmet EU deadline. Overdue = past it;
  at risk = within 2 days (`AT_RISK_WINDOW_MS`). Closed statuses (`closedStatuses` in the
  adapters) are excluded entirely.
- **EU Directive timers** on posts, in the overview and on the case detail page:
  "Acknowledge due in 2 days" / "Feedback overdue by 5 days" (`CaseSlaBadge`).
  - Same computation as `/c`: `src/utils/caseTimers.js` is an ES-module copy of
    `functions/utils/caseTimers.js` (the functions code is CommonJS under a separate
    package, so it can't be imported by Vite). `functions/test/caseTimersParity.test.js`
    imports both and fails if they ever disagree.
  - Only posts with `source === "public_link"` get timers: those are the only cases the
    reporter can look up on `/c`. Policy-link concerns and internal posts do not.
  - "Feedback given" needs the thread's `lastInvestigatorActivity`, so the page reads
    `anonymousThreads` for the company (one query; the detail page reads one doc). If that
    read fails, feedback falls back to the terminal-status rule only.
- Data loading (`caseOverviewService.js`): posts = `privacyLevel == hr_only` (the HR Inbox
  set) plus anything with an `assignedTo`, both through `hrCaseScope` so HR never queries
  `involvesHR` cases; plus all vendor and moderation docs for the company. A source that
  fails shows a warning banner instead of blanking the page. 500 docs per source cap, with a
  notice when hit.
- i18n: `caseOverview.*` and `navigation.caseOverview`, 5 locales. Day counts use
  i18next `_one`/`_other` plurals. es/fr/it/si translations are mine; native review
  recommended, Sinhala especially.

## 2. Verification done
- `npm run build` passes; `npx eslint` clean on every new/changed file.
- `cd functions && npm test`: the new parity test passes. **`passwords.test.js` is flaky
  independent of this change** (fails roughly 1 run in 3 on its own; untouched here).
- Sort/SLA logic exercised in a one-off script (overdue acknowledge, feedback due in 2 days,
  assigned-due-tomorrow, internal post, vendor report); results matched expectations. No
  frontend test runner exists in the repo, so that script is not committed.

### Not verified
- No emulator or browser run. Untested against real data: the `assignedTo.type in [...]`
  query (equality-style filters, no composite index expected, unconfirmed), the
  `anonymousThreads` company query under HR rules, the board layout on narrow screens.
- Board is read-only: no drag-and-drop status change (status is changed on the case page).
  Moderation cards are in the board but their status only moves via moderation actions.
- Overdue/at-risk is computed in the browser at load time and does not tick live; use Refresh.
- Posts shown to HR are limited to the HR inbox set plus assigned ones; regular company-public
  posts that nobody assigned are not "cases" here, same as the HR Inbox.
- The "at risk" window (2 days) is a guess; one constant to change.

## 3. Manual checklist
1. As HR, open Case Overview: counts match HR Inbox open + vendor + moderation open.
2. Submit a public report; it appears with "Acknowledge due in 6 days"; change its status off
   `open`, refresh: the badge becomes "Feedback due in ~90 days"; reply as investigator or
   resolve it: it leaves the timers.
3. Assign a vendor report a due date of yesterday: it shows overdue and sorts first.
4. Toggle board: columns per type; toggle back; reload keeps the choice.
5. As HR, confirm no `involvesHR` case appears; as company_admin, it does.
