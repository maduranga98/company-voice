# VoxWel rework: removal plan (walls and employee layer)

Branch `rework/remove-walls`, from `main` at `c043268`. No Firestore data, collection names, schema or `PostType` change. No scripts run.

This plan replaces an earlier draft that predates the auth hardening on main. The audit below is against current main.

## 0. Baseline and what main already has

| Check | Baseline on main |
|---|---|
| `npm run build` | passes |
| `npm run lint` | fails with pre-existing problems (133 problems: 99 errors, 34 warnings). The gate is: no more problems than baseline, zero in files I touch. |
| `functions` tests | `cd functions && npm test` |

Already done on main, so there is less to do than the task text assumes:
- No `Register` page or `/register` route exists. `Login.jsx` still has the QR scanner, the QR login button and the register link.
- `firestore.rules` and `storage.rules` are already staff-only. `isAuthenticated()` requires `role in [super_admin, company_admin, hr]`, and no helper or rule grants `employee` anything. Only a comment in `canReadPost` mentions employees.
- The `companies` read rule is already `isSuperAdmin() || belongsToCompany(companyId)`. There is no unauthenticated read to tighten.
- The `login` callable already rejects non-staff roles, but only after the password verifies (`accountStateError`), with a "deactivated" message. I reword it to "This account is no longer active."
- `AuthContext.loadStaffProfile` already signs out any non-staff role, but silently. There is no screen. I add the plain "This account is no longer active" screen.
- `Dashboard.jsx` (`/dashboard`) already routes by role, with a dead `employee` branch.
- There is no `BulkActionsPanel` and no Cloud Function trigger for likes or comments.

## 1. Files to delete (`git rm`)

Evidence comes from an import-graph scan of `src/` (script kept outside the repo). "Only X" means X is the only importer, and X is also deleted.

### Phase 1: walls and social
| File | Evidence |
|---|---|
| `src/pages/feed/{CreativeFeed,ProblemsFeed,DiscussionsFeed,UnifiedFeed}.jsx` | Imported only by `App.jsx`. |
| `src/pages/MyPosts.jsx`, `DraftsPage.jsx`, `ScheduledPostsPage.jsx`, `ArchivedPosts.jsx` | `App.jsx` only. |
| `src/components/CreatePost.jsx` (the "enhanced variant" is `PostEnhanced`) | `UnifiedFeed` only. |
| `src/components/Post.jsx` | Only `AssignedToMe`, which I edit to render an inline read-only block. |
| `src/components/PostEnhanced.jsx`, `EditPost.jsx` | `MyPosts`, `UnifiedFeed`, `DraftsPage`. |
| `src/components/CommentsEnhanced.jsx`, `CommentsThreaded.jsx` | `Post` and `PostEnhanced` only. `CommentsThreaded` is already unreferenced. |
| `src/components/ReactionButton.jsx`, `VotingButton.jsx` | `Post` and `PostEnhanced` only. |
| `src/components/PollCreator.jsx`, `PollDisplay.jsx` | `CreatePost` and `PostEnhanced` only. |
| `src/components/ReportContentModal.jsx` | `Post`, `PostEnhanced`, `CommentsEnhanced` only. These are the "report post/comment" buttons. |
| `src/components/SkeletonLoader.jsx` | `UnifiedFeed` only. |
| `src/components/PullToRefresh.jsx`, `src/hooks/usePullToRefresh.js` | Already unreferenced (feed leftovers). |
| `src/services/{votingService,pollService,bookmarkService,commentThreadingService,mentionsService}.js` | Importers are all deleted components. Verified again after the deletions. |
| `src/services/postEnhancementsService.js` | Importers are `EditPost`, `CreatePost`, `DraftsPage`, `ScheduledPostsPage`, `MyPosts`. All deleted, so the whole file goes. |
| `src/services/postEnhancedFeaturesService.js` | Importers are `AdminActionPanel` (pin/archive removed), `PostEnhanced`, `UnifiedFeed`, `ArchivedPosts`. All gone, so the whole file goes. |
| `src/components/PolicyAcknowledgementBanner.jsx`, `AnonymityGuaranteeScreen.jsx` | Orphaned by `ProblemsFeed` and `CreatePost`. They belong to the policy and anonymity area, so I leave them in place and flag them (section 9). |

Pruning `postManagementService.js`: its only post-wall exports are `getPostsWithPrivacyFilter`, `getUserPosts`, `markPostAsViewed`, `hasUnreadUpdates`, `checkRateLimit` and `deletePost`. I grep each for callers after Phase 1 and remove those with zero callers. `deletePost` has a caller only in `PostEnhanced`, so it goes too. `DeletedPosts` (super admin) reads the `deletedPosts` collection and is separate.

### Phase 2: employee layer
| File | Evidence |
|---|---|
| `src/pages/QRCodeGenerator.jsx` (`/qr-generator`) | `App.jsx` only. It makes the credential QR images for QR login. |
| `src/components/EmployeeLayout.jsx` | `App.jsx`, `RoleBasedLayout`. |
| `src/pages/EmployeeMessages.jsx`, `EmployeeMessageThread.jsx` | `App.jsx` only. |
| `src/components/RoleBasedLayout.jsx` | **Kept and simplified.** It also wraps shared routes (`/help`, `/policies`, `/vendor-risk`, `/templates`, `/notifications`). See the super_admin note below. |

`Profile.jsx` and `Notifications.jsx` are shared with `/company/*` routes. They are not deleted. Only the `/employee/*` routes go.

### Dependencies
`html5-qrcode` is imported only by `Login.jsx`. It is removed with npm. `qrcode` stays (`CompanyQRCode`). Other packages are checked with a grep after the deletions.

## 2. Files to edit

| File | Change |
|---|---|
| `src/App.jsx` | Remove the routes and imports for the feeds, `/my-posts`, `/drafts`, `/archived`, `/scheduled`, `/qr-generator`, `/messages*`, `/employee/*`. `/` becomes `PrivateRoute` + `Dashboard` (role router, `/login` when signed out). `/moderation*` routes stay. |
| `src/pages/Dashboard.jsx` | Drop the `employee` branch. Roles map to `/admin/companies`, `/company/dashboard`, `/hr/inbox`. |
| `src/pages/Login.jsx` | Remove the QR scanner, "Sign In with QR Code", the register link and the "contact your HR" text. Keep the staff `login` flow. |
| `src/contexts/AuthContext.jsx`, `src/components/PrivateRoute.jsx` | A signed-in user whose role is not staff (or whose profile is invalid) sets an `accountInactive` flag, then the user is signed out. `PrivateRoute` shows a plain "This account is no longer active" screen. It has one button that clears the flag and goes to `/login`. There is no redirect loop. |
| `src/components/RoleBasedLayout.jsx` | Drop the `EmployeeLayout` fallback. `company_admin` and `hr` get `CompanyAdminLayout`. `super_admin` gets the page with no shell, like `/admin/*`. Shared routes `/policies`, `/help`, `/vendor-risk`, `/templates` and `/notifications` then render for a super admin without a sidebar. The previous behaviour was the employee bottom-nav layout, which is being deleted anyway. |
| `src/components/CompanyAdminLayout.jsx` | Remove nav items, breadcrumbs and bottom-nav tabs for the walls, My Posts and Moderation. Add no new destinations. |
| `src/components/AdminActionPanel.jsx` | Remove Pin and Archive (nothing can show or un-archive after this). Keep status, priority, assignment, due date, notes and `AnonymousThread`. Add a read-only list of internal notes (section 4). |
| `src/pages/AssignedToMe.jsx` | Replace `<Post/>` with an inline read-only title and description block. |
| `src/pages/hr/HRInbox.jsx`, `hr/VendorRiskDashboard.jsx`, `VendorRiskReport.jsx` | Change redirects and labels that point at `/feed/*` to `/`. |
| `src/pages/Profile.jsx`, `Notifications.jsx` | Remove links to My Posts and Messages, the `employee` badge case, and the comment/like icon cases. |
| `src/pages/company/CompanyDashboard.jsx` | Remove the per-wall cards and stats, the `/feed/*` navigation, the "pending employees" alert and the Moderation and Archived quick actions. |
| `src/pages/company/CompanyAnalytics.jsx` | Remove only the posts-by-type (per-wall) widget and wall filters. Keep counts by status, category and department. |
| `src/pages/company/MemberManagement*.jsx` | Remove the Approve/Reject (pending) UI and the Employee role option from role dialogs and filters. Legacy `employee` rows still render with a neutral label. |
| `src/pages/company/DepartmentDetails.jsx`, `admin/SuperAdminLegalRequests.jsx` | The `Employee` label and the `'employee'` default come out when they mention the role. |
| `src/pages/ModerationDashboard.jsx`, `ReportDetailView.jsx` | Add `// TODO(next-review)` at the top. Routes stay. |
| `src/pages/HelpCenter.jsx`, `RoleDefinitions.jsx`, `src/utils/guidanceContent.js`, `src/hooks/useGuidanceContent.js` | See Phase 4. |
| `src/utils/constants.js` | Remove `UserRole.EMPLOYEE`, `ReactionType`, and the like/comment/reaction/mention/follow `NotificationType` entries. `PostType` stays. |
| `src/services/postManagementService.js` | Prune the dead exports (above). In `addAdminComment` drop the author notification so a private note can never notify anyone. |
| `functions/api/authApi.js` | Non-staff role → "This account is no longer active." after password verification. |
| `functions/api/userManagementApi.js`, `functions/config/firebase.js` | Remove the legacy-employee allowances in `changeUserRole` and the HR-moderation comment, and `ROLES.EMPLOYEE`. |
| `functions/api/notificationApi.js`, `functions/scheduled/notificationJobs.js`, `functions/api/searchApi.js` | Phase 3. |
| `firestore.rules` | Fix the employee comment only (section 5). |
| `firestore.indexes.json` | Remove indexes that served only removed queries, after checking each against kept queries. |
| `package.json`, lockfile | `html5-qrcode`. |
| i18n (5 files), docs | Phase 4. |

## 3. Shared components with evidence they are still used (KEPT)
| Component | Used by |
|---|---|
| `AnonymousThread` | `HRConversations`, `AdminActionPanel` |
| `AdminActionPanel` | `HRInbox`, `AssignedToMe` |
| `CaseAttachments` | `HRInbox` |
| `LegalRequestModal` | `ReportDetailView` |
| `LanguageSwitcher`, `BackButton`, `HelpPanel`, `SuperAdminNav`, `DisclosureModal`, `Department*` | kept pages |
| `TemplatesPage`, `postTemplatesService` | kept (protected) |

## 4. Admin/HR comments: how they work now and after the removal
Today `addAdminComment` writes a document to the top-level `comments` collection (`isAdminComment: true`, `companyId`, `postId`), increments `posts.comments`, logs a `postActivities` row, and sends a "commented on your post" notification to the author. Nothing outside `CommentsEnhanced` (deleted) ever read those notes, so without a reader they would be write-only.

Plan, with no schema change:
- Keep the write path. Same collection and fields.
- Add a read-only list of the case's notes inside `AdminActionPanel`, labelled as internal (staff only). Query: `comments` with `companyId == user.companyId` and `postId == post.id`. The `isAdminComment` filter and the date sort happen client-side. That needs no new index and keeps the `companyId` filter.
- Drop the author notification (public reporters have no account).

Behaviour flags:
1. **HR and involvesHR cases.** The `comments` rule lets any staff member of the company read a comment. An HR user cannot read an involvesHR post, but could read its notes, because notes carry no `involvesHR` flag. The notes list is only shown inside the panel, which HR only opens for cases it can read, so the UI does not expose this. The rule does. I leave the rule as is (the task forbids changing the involvesHR restriction) and list it as a follow-up.
2. Historical public comments in the same collection are not shown. The reader filters to `isAdminComment == true`.

## 5. Rules, indexes, functions

Firestore rules (staff-only already; no behaviour change intended)
- Remove "(no employee access)" wording in `canReadPost`.
- `posts` update clauses for `reactions`, `comments` and `reportCount` only: these allow other staff to bump counters. `comments` is still bumped by `addAdminComment` by staff who pass the role check anyway. I leave the clauses and the `likes`/`comments`/`reactions` subcollection rules in place, since `deletePost` cascade data and historical docs exist. I list them as an optional later cleanup.
- Final `companies` rule (unchanged, already tight): `allow read: if isSuperAdmin() || (isAuthenticated() && belongsToCompany(companyId));`. A grep shows no unauthenticated reader in `src/`. The public report flow reads companies through Cloud Functions only.
- Storage rules have no employee references.

Indexes: list at the Phase 4 step with evidence.

Functions
- No Firestore-triggered functions exist, so there is nothing to delete for likes or comments.
- `notificationApi.js`: remove the `comments`, `reactions` and `mentions` default preferences, including the `immediate.mentions` toggle. Keep status, priority, assignment and system toggles.
- `notificationJobs.js`: the digests carry staff-relevant content (status changes, assignments), so both jobs and their exports in `functions/index.js` stay. I remove the "Comments" stat and the comment/reaction/mention labels and the `comments` query.
- `searchApi.js`: `searchInComments` still works for staff and causes no error. It stays, because the task says to keep it unless it errors. Flagged below.
- `authApi.js` and `userManagementApi.js`: as in section 2.

## 6. Risks
- `super_admin` on shared pages loses the employee shell (section 2). They get content without a sidebar, matching other `/admin/*` pages.
- Anonymous submitters never had accounts. HR-to-submitter replies (`AnonymousThread`) are write-only until the report-link reply flow is built. That is expected.
- Legacy `employee` user docs stay in Firestore and cannot sign in.
- Removing pin/archive hides their data. `isPinned` and `isArchived` fields stay on documents.

## 7. i18n
For every key in `en.json`, delete it from all five files only if a whole-key grep of `src/**/*.{js,jsx}` has zero references and no dynamic prefix such as `` t(`prefix.${x}`) `` covers it. Keys unreferenced before this change and unrelated to it stay. JSON validity and key parity are checked after each run. `si.json` is partial, which the script tolerates.

## 8. Order and gates
1. Phase 1 (walls and social), commit.
2. Phase 2 (employee layer), commit.
3. Phase 3 (notifications, moderation, functions), commit.
4. Phase 4 (content, config), commit.

After each phase run `npm run lint`, `npm run build`, and `cd functions && npm test` when functions change.

## 9. Deferred, or needs the owner
- `PolicyAcknowledgementBanner` and `AnonymityGuaranteeScreen` become orphans. Left in place.
- The `comments` rule readability for HR on involvesHR cases (section 4).
- `searchInComments` in `searchApi.js`.
- Leftover rules for `likes`/`comments`/`reactions` subcollections, `discussions`, `bookmarks`.
- Manual cleanup: legacy `employee` user docs, old anonymous Auth users (`scripts/deleteAuthSessions.js` exists), stale `authSessions` documents.

## 10. Outcome and deviations from this plan

Done as planned unless listed here.
- Phase order followed. Where one file needed several phases (`App.jsx`, `CompanyAdminLayout`), the edit landed in the first phase that touched it. The moderation nav links went in Phase 1.
- `Profile.jsx`: the "My Activity" card (counts of the user's own wall posts) went with My Posts.
- `CompanyDashboard`: a recent-case row now opens `/hr/inbox` (it used to open the matching wall). The pending-approval alert, member-count badge, Moderation and Archived quick actions are gone.
- Mobile bottom nav: "Walls" is replaced by "Inbox" (an existing page). The HR "Moderation" tab is gone.
- `CompanyAnalytics`: the posts-by-type widget and the "Pending Users" card (the approval step) are removed. The comment-based widgets (Total Comments, engagement, top contributors) remain, per the "per-wall widgets only" scope. See section 11.
- `login` callable: non-staff roles now return `This account is no longer active.` after the password verifies, checked before status so a legacy employee always gets it. A wrong password still gets the generic error.
- `changeUserRole` no longer accepts a legacy employee as a target. Create a new `hr` or `company_admin` account instead.
- Client: `AuthContext` raises an `inactiveAccount` flag when a signed-in user's role claim is not a staff role, signs them out, and `PrivateRoute` shows the plain screen. Role-less leftover anonymous sessions keep the old behaviour (silent sign-out, then `/login`).
- Indexes removed: `posts(companyId,type,createdAt)`, `posts(companyId,authorId,createdAt)`, `comments(postId,companyId,createdAt)`. Their only queries were in deleted files. The remaining `type`, `authorId` and `postId` queries (searchApi, MemberManagement, the internal notes list) are equality-only and need no composite index.
- Docs deleted as obsolete: `IMPLEMENTATION_SUMMARY.md`, `POST_MANAGEMENT_ENHANCEMENTS_README.md`, `POST_MANAGEMENT_ENHANCEMENT_GUIDE.md` (index pages updated). `AUTH_AUDIT.md` and `STEP1_NOTES.md`: false statements corrected.
- Dependencies: `html5-qrcode` and `dompurify` removed (the latter was only used by the deleted `Post.jsx`; it stays in the lockfile as a transitive dependency of `jspdf`).
- i18n: 374 leaf keys removed per locale where present, listed by a script that checks zero references. Key parity with the pre-change state is unchanged. New keys: `auth.accountInactive.*`. Copy changed: `company.qrCodeTitle/qrCodeDesc`, `auth.login.mainDescription`.
- The `firestore.rules` change is one comment. The rules were already staff-only, so there was nothing to tighten (section 0).

## 11. Not done, or needs the owner
- `comments` rule lets HR read internal notes on involvesHR cases (section 4). Fix with a rule that checks the parent post, in the moderation/rules follow-up.
- `likes`, `comments`, `reactions` subcollection rules, the `discussions` and `bookmarks` rules, and the `posts` update clauses for `reactions`, `comments` and `reportCount` are left in place. They are unused by the app now.
- `CompanyAnalytics` comment and engagement widgets, and `searchApi` `searchInComments`, still work but describe a feature that no longer exists.
- Unmatched URLs (old `/feed/*`, `/register`, `/messages` bookmarks) render a blank page; there is no catch-all route. Adding one is a one-line follow-up.
- `ModerationDashboard` and `ReportDetailView` still carry their old lint problems (2 each); only a `TODO(next-review)` comment was added.
- Manual cleanup: legacy `employee` user documents (and their `userCredentials`), old anonymous Auth users, stale `authSessions` documents (`scripts/deleteAuthSessions.js`), and stored `isPinned`/`isArchived`/`reactions` fields on posts.
