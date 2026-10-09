# VoxWel rework: removal plan (audit only, no code changed yet)

Branch: `rework/remove-walls`. No Firestore data, collection names, schema or `PostType` are touched.

## 0. Baseline and headline findings

| Check | Baseline today |
|---|---|
| `npm run build` | passes |
| `npm run lint` | **fails: 273 problems (237 errors, 36 warnings)**. About 170 are in `functions/` (CommonJS `require`/`module` flagged `no-undef`, because ESLint is run on the whole repo). The rest are scattered in `src/`. See Decision 1. |
| `functions/` | exists. It has **no Firestore triggers**. Only callables and 2 scheduled digests are exported. So there are no like/comment trigger functions to remove (details in section 6). |

Findings that change the plan:

1. **Admin/HR notes are write-only once the walls go.** `AdminActionPanel` → `addAdminComment()` writes to the shared `comments` collection (`isAdminComment: true`), bumps `posts.comments`, logs a `postActivities` row and calls `notifyAuthor()`. **Nothing outside the public comment components ever reads them.** `HRInbox` reads `adminCommentCount`, which is never written (dead check). Deleting `Post`/`CommentsEnhanced` would leave notes that can be saved but never seen. See section 5 and Decision 2.
2. **The `comments` collection is shared** by public comments and private notes, and Firestore rules let *any member of the company* read it. The existing help text says notes are "visible to admins only"; that is only a UI convention today. Not fixed here (rules are a manual item), but flagged.
3. **Phase boundaries need adjusting.** `MyPosts` imports `PostEnhanced`, and `AssignedToMe` renders `<Post>` (which includes public comments and reactions). So `MyPosts` must go in Phase 1, not 2, or the build breaks. `AssignedToMe` stays and needs a small edit (section 3).
4. **Anonymous HR conversations become one-way.** `AnonymousThread` (kept, used by `HRConversations` and `AdminActionPanel`) is how HR messages an anonymous submitter. The submitter read replies in `EmployeeMessages`/`EmployeeMessageThread`, which are being deleted. Until the public report link exists, HR can write but nobody can read. Expected by your plan; just be aware.
5. `/` currently redirects to `/feed/creative`. `Dashboard.jsx` (`/dashboard`) already routes by role. I will reuse it for `/` after dropping its employee branch.
6. `RoleBasedLayout` falls back to `EmployeeLayout` for anything non-admin, **including `super_admin`** (on `/help`, `/policies`, `/notifications`, `/vendor-risk`). Removing `EmployeeLayout` forces a decision for super_admin (Decision 5).

## 1. Files to delete (`git rm`)

Dependents are listed with evidence (importers from a full import-graph scan of `src/`).

### Phase 1: walls and social
| File | Evidence it is removable |
|---|---|
| `src/pages/feed/{CreativeFeed,ProblemsFeed,DiscussionsFeed,UnifiedFeed}.jsx` | Imported only by `App.jsx` (the 3 thin wrappers) and each other. |
| `src/pages/MyPosts.jsx` | Only `App.jsx`. Imports `PostEnhanced`, `EditPost`, `AnonymousThread`. Moved from Phase 2 (finding 3). |
| `src/components/CreatePost.jsx` | Only `UnifiedFeed`. |
| `src/components/PollCreator.jsx`, `PollDisplay.jsx` | `CreatePost` / `PostEnhanced` only. |
| `src/components/Post.jsx`, `PostEnhanced.jsx` | `Post`: only `AssignedToMe` (edited, section 3). `PostEnhanced`: `MyPosts`, `UnifiedFeed`. |
| `src/components/CommentsEnhanced.jsx` | `Post`, `PostEnhanced` only. |
| `src/components/CommentsThreaded.jsx` | **Already imported by nothing.** |
| `src/components/ReactionButton.jsx`, `VotingButton.jsx` | `Post`/`PostEnhanced` only. |
| `src/components/ReportContentModal.jsx` | `Post`, `PostEnhanced`, `CommentsEnhanced` only (the "report post/comment" buttons). |
| `src/components/SkeletonLoader.jsx` | `UnifiedFeed` only. |
| `src/components/PullToRefresh.jsx`, `src/hooks/usePullToRefresh.js` | **Imported by nothing** (leftover from the feeds). |
| `src/services/{votingService,pollService,bookmarkService,commentThreadingService,mentionsService}.js` | Importers are all deleted files (`VotingButton`, `PollDisplay`/`PollCreator`, `PostEnhanced`/`MyPosts`, `CommentsThreaded`, `CommentsEnhanced`/`CommentsThreaded`). |

### Phase 2: employee layer
| File | Evidence |
|---|---|
| `src/pages/Register.jsx` | `App.jsx` only. |
| `src/pages/QRCodeGenerator.jsx` (public `/qr-generator`) | `App.jsx` only. It generates the credential-QR images for the QR login being removed. **Please confirm (Decision 6).** |
| `src/components/EmployeeLayout.jsx` | `App.jsx`, `RoleBasedLayout`. |
| `src/pages/EmployeeMessages.jsx`, `EmployeeMessageThread.jsx` | `App.jsx` only. |

Kept and edited instead of deleted: `Profile.jsx` and `Notifications.jsx` are shared. `/company/profile` and `/company/notifications` are admin routes that use them. Only the `/employee/*` routes and employee-only content go.

### Phase 3: authoring extras
| File | Evidence |
|---|---|
| `src/pages/DraftsPage.jsx`, `ScheduledPostsPage.jsx`, `ArchivedPosts.jsx` | `App.jsx` only. |
| `src/components/EditPost.jsx` | `PostEnhanced`, `DraftsPage`, `MyPosts`: all deleted by then. |
| `src/services/postEnhancementsService.js` | Importers: `EditPost`, `CreatePost`, `DraftsPage`, `ScheduledPostsPage`, `MyPosts`. |
| `src/services/postEnhancedFeaturesService.js` | Importers: `AdminActionPanel` (pin/archive removed), `PostEnhanced`, `UnifiedFeed`, `ArchivedPosts`. |

### Phase 4: content cleanup
No deletions, apart from the dependency below.

### Dependency
- Remove `html5-qrcode` from `package.json` (only `Login.jsx` imports it). **Keep `qrcode`**: `CompanyQRCode` uses it.

### Needs your call (not deleted until you answer)
- `src/components/PolicyAcknowledgementBanner.jsx` and `AnonymityGuaranteeScreen.jsx`. The banner is imported only by `ProblemsFeed`; the anonymity screen only by the banner and `CreatePost`. Both would become orphans. The banner is part of policy acknowledgement (a protected area), so I won't delete it unasked (Decision 7).

## 2. Files kept but unlinked (as instructed)
`ModerationDashboard.jsx`, `ReportDetailView.jsx`, `moderationService.js` stay. I will remove them from the sidebar, bottom nav, breadcrumbs and the CompanyDashboard quick action. Whether the `/moderation*` routes stay registered is Decision 4.

## 3. Files to edit

| File | Change |
|---|---|
| `src/App.jsx` | Remove imports and routes for: 3 feeds, `/my-posts`, `/drafts`, `/archived`, `/scheduled`, `/register`, `/qr-generator`, `/messages`, `/messages/:postId`, `/employee/profile`, `/employee/notifications`. `/` becomes `<PrivateRoute><Dashboard/></PrivateRoute>` (role-based). |
| `src/pages/Dashboard.jsx` | Drop the `employee` → `/feed/creative` branch. Roles map to `/admin/companies`, `/company/dashboard`, `/hr/inbox`. |
| `src/pages/Login.jsx` | Remove the `html5-qrcode` import, scanner state and handlers, the "Sign In with QR Code" button, the scanner view, the register link, the "contact your HR" text, and the `/register` navigations. Catch the inactive-employee case → `/account-inactive`. |
| `src/contexts/AuthContext.jsx` | Reject non-admin roles at `login()` and at session restore. Clear the session and set an `inactiveAccount` flag. Role whitelist `[super_admin, company_admin, hr]`, so the literal `"employee"` never appears. No redirect loop (details below). |
| `src/components/PrivateRoute.jsx` | Redirect users whose role is not in the whitelist to `/account-inactive`. Unauthenticated users go to `/login`, as today. |
| `src/components/RoleBasedLayout.jsx` | Remove the `EmployeeLayout` branch. See Decision 5 for super_admin. |
| **New** `src/pages/AccountInactive.jsx` + public route `/account-inactive` | The one new file in this task. It shows "This account is no longer active" with a Back-to-sign-in button. It does not read auth state, so no redirect loop. |
| `src/components/CompanyAdminLayout.jsx` | Remove nav items and breadcrumbs for Creative, Problems, Discussions, My Posts and Moderation. Remove the mobile bottom-nav "Walls" and "Moderation" tabs. Check the bottom-nav items that remain (Dashboard/Chats/Help/More) for a sensible replacement. I will not add new destinations. |
| `src/components/AdminActionPanel.jsx` | Remove Pin/Unpin (Phase 1). Remove the Archive toggle (Phase 3, Decision 3). Keep status, priority, assignment, due date, notes and `AnonymousThread`. Add the notes list (section 5). |
| `src/pages/AssignedToMe.jsx` | Replace `<Post post={post}/>` with an inline read-only title/description block, same pattern as the `HRInbox` detail panel. |
| `src/pages/hr/HRInbox.jsx` | Access-denied redirect goes to `/` (was `/feed/problems`). Fix the dead `adminCommentCount` check (section 5). |
| `src/pages/hr/VendorRiskDashboard.jsx` | Access-denied redirect `/feed/creative` → `/`. Nothing else touched. |
| `src/pages/VendorRiskReport.jsx` | Two `navigate("/feed/problems")` → `/`. The "Go to Problems Wall" button label becomes a neutral label. Nothing else touched. |
| `src/pages/Profile.jsx` | Remove the "Private Messages" and "My Posts" quick links and the `employee` badge case. |
| `src/pages/Notifications.jsx` | Remove the `comment`/`like` icon entries. |
| `src/pages/company/CompanyDashboard.jsx` | Remove the 3 per-wall cards (`feedCards`), the `problemReports`/`creativeIdeas`/`discussions` stats, the `/feed/*` post-click navigation, and the Moderation and Archived quick actions. Remove the "pending employees" alert (approval step). `CompanyQRCode` quick action stays. |
| `src/pages/company/CompanyAnalytics.jsx` | Remove the posts-by-type (per-wall) widget, `postsByType` and its label helper. Everything else stays (Decision 8). |
| `src/pages/company/MemberManagement.jsx`, `MemberManagementWithDepartments.jsx` | Remove the Approve/Reject (pending) UI and handlers, and the "Employee" role in the role filter and role-change dialogs. See Decision 9. |
| `src/pages/company/CompanyQRCode.jsx` | Add `// TODO(report-link)` at the two `…/register?companyId=…` URL sites (lines ~48 and ~738). Logic unchanged. |
| `src/pages/HelpCenter.jsx` | Remove the `walls` section (creative/problems/discussions), employee-only guides, and the `employee` role-hierarchy entries. Also drop the `|| "employee"` default role. |
| `src/pages/RoleDefinitions.jsx` | Remove the employee column and rows: Create/Comment/Edit/Delete Own Posts, Pin/Unpin Posts, Use Templates (employee-only value) and employee actions. Drop the `employee` hierarchy entries. |
| `src/utils/guidanceContent.js`, `src/hooks/useGuidanceContent.js` | Remove the `employee` role block and wall-specific entries (`pinPost` tooltip, post-comments/reactions features). |
| `src/utils/constants.js` | Remove `UserRole.EMPLOYEE`, `ReactionType`, and `NotificationType.COMMENT/REACTION/LIKE/MENTION`. Keep `PostType`, `ADMIN_COMMENT`, and all moderation enums (files stay). |
| `src/services/postManagementService.js` | Only if needed after the notes decision: nothing removed otherwise. Dead exports (`getPostsWithPrivacyFilter`, `getUserPosts`, `markPostAsViewed`, `hasUnreadUpdates`, `checkRateLimit`) are left for the report-link task rather than pruned. |
| `src/services/authService.js` | Keep `checkUsernameExists`/`hashPassword` (used by `CompanyManagement`). No change. |
| `package.json`, `package-lock.json` | Drop `html5-qrcode`. |
| `src/i18n/locales/{en,es,fr,it,si}.json` | Phase 4, script-driven (section 7). |

### Employee sign-in handling (design)
1. `login()` succeeds in `authService`. If `user.role` is not in the whitelist, `AuthContext` clears `currentUser`, `userData` and `localStorage`, resets the authSession to `pending` (same as `logout`), then throws a typed `ACCOUNT_INACTIVE` error. `Login` catches it and navigates to `/account-inactive`.
2. Session restore (`onAuthStateChanged`) does the same for a stored employee session: it clears the session, then lands on `/account-inactive`.
3. `/account-inactive` is public and reads no auth state, so there is no `PrivateRoute` → `/login` → `PrivateRoute` loop. Its only action is "Back to sign in".

## 4. Shared components that look removable, with evidence
| Component | Verdict |
|---|---|
| `AnonymousThread` | **Keep.** Used by `HRConversations` and `AdminActionPanel` (kept). Only `MyPosts`/`EmployeeMessageThread` importers go. |
| `AdminActionPanel` | **Keep, edit.** Used by `HRInbox`, `AssignedToMe`. |
| `LegalRequestModal` | Keep. Used by `ReportDetailView`. |
| `TemplatesPage`, `postTemplatesService` | Keep (protected). Note it is only useful for authoring public posts; Templates stays untouched per your scope. |
| `PolicyAcknowledgementBanner`, `AnonymityGuaranteeScreen` | Orphaned after Phase 1; awaiting Decision 7. |
| `LanguageSwitcher`, `BackButton`, `HelpPanel`, `SuperAdminNav`, `KeyVaultSetup`, `DisclosureModal`, `Department*` | Used by kept pages. Untouched. (`HelpTooltip` and `KeyVaultSetup` are already unused today; out of scope, left alone.) |

## 5. Admin/HR notes: current behaviour and the path I propose to keep
Today: `addAdminComment` → `comments` doc (`isAdminComment: true`, `companyId`, `postId`) + `posts.comments` increment + `postActivities` row + `notifyAuthor` (skipped for anonymous posts, otherwise creates a notification for the author, who can no longer log in). Reading happened only via `CommentsEnhanced` inside `Post`, so after the removal notes could be saved but not seen.

Proposal (minimal, no schema change):
- Keep the write path unchanged (same collection, same fields, so data stays compatible).
- In `AdminActionPanel`'s existing "Admin Note" block, add a read-only list of notes for the open case: `comments` where `companyId == user.companyId` and `postId == post.id` and `isAdminComment == true`. The existing index (`postId`, `companyId`, `createdAt`) already covers this; I will check whether the extra equality filter needs a new index or can be filtered client-side.
- Remove the `notifyAuthor` call from `addAdminComment`, since the author has no account. This is the only edit inside a service function, and it stays in the kept path.
- Fix the dead `adminCommentCount` unread test in `HRInbox` (or leave it; it is harmless). Your call.

Risk: this is a small amount of new read code (about 25 lines), which is technically "building". The alternative is notes that can be written but never read. Decision 2.

## 6. Firestore rules, indexes and Cloud Functions to clean up (NOT changed by me)
Rules and indexes are deployed config, so I will not edit them without you; I'll list them in the final summary.

`firestore.rules`
- `posts/{id}/likes`, `/comments`, `/reactions` subcollections (lines ~180–226).
- `posts` update clauses allowing "any company member" to update `reactions`, `comments` or `reportCount` only (lines ~166–171).
- `discussions` collection (~263).
- `bookmarks` (~828), and polls/votes if present.
- The `comments` top-level rule should eventually restrict reads to HR/admin once public comments are gone (finding 2).
- `companies` allows unauthenticated `read` "for QR registration flow" (~129): you will probably still need it for the public report link, so left alone.
- `users` create rule: no longer needed for self-registration; verify it is limited to admin paths.

`firestore.indexes.json` (do not remove blindly; check which kept queries use them)
- `posts` (`companyId`, `type`, `createdAt`) and (`companyId`, `authorId`, `createdAt`) were used by the feeds/My Posts. `contentReports`, `moderationActivities`, `userStrikes` indexes stay, because the moderation files stay.

`functions/` (no triggers exist, nothing to remove for like/comment triggers)
- `api/notificationApi.js`: default preferences include `comments` and `reactions`.
- `scheduled/notificationJobs.js`: the weekly digest counts `comments` and labels `comment`/`reaction`.
- `api/searchApi.js`: `searchInComments` option.
- All are server-side; I won't touch them in this task. They are listed so you can clean them up (or I can in a follow-up).

## 7. i18n plan (Phase 4)
- Script-driven: for every key in `en.json`, the key is deleted from all 5 files only if a whole-key grep of `src/**/*.{js,jsx}` finds zero references after the code removal, **and** no dynamic template usage like `` t(`prefix.${x}`) `` covers that prefix.
- Candidate groups, to be confirmed by the script: `feed.*`, `reactions.*`, `comments.*`, `myPosts.*`, `drafts.*`, `scheduled.*`, `messages.*`, `employee.*`, `createPost.*`, `postActions.*`, `post.*`, `auth.register.*`, QR-scan strings (`qr.scan*`, `qr.howToScan`, `qr.instruction1-4`), `auth.login.*` (scan, contactHR, invalid QR, scanner error), `navigation.{creative,problems,discussions,walls,myPosts,messages,feed}`, `notifications.{newComment,newReaction}`, `company.{problemReports,creativeIdeas,discussions,creativeWall,clickToView*,archivedPosts*,employeeSingular,employeePlural,pendingApprovalAlert,reviewApproveRegistrations,employeeRoleDesc,roleEmployee}`, wall/employee entries under `help.*` and `guidance.roles.employee`, and the wall-specific `guidance.*` rows.
- Keys that are *already* unreferenced today but unrelated to this task (for example `common.*`, `validation.*`, `success.*`) are **not** deleted: your rule is to remove keys that this change orphans.
- `si.json` is only ~282 keys (vs 981 in en/it, 888 in es/fr), so it is partial; the script handles missing keys gracefully.
- Validate JSON parse for all 5 files after each run. `src/i18n/README.md` is checked for mentions of removed keys.

## 8. Order of work and gates
1. **Phase 1**: walls and social (incl. `MyPosts`, pin, public comments/reactions, `AssignedToMe` edit, nav + dashboard wall cards, `/` redirect). Commit.
2. **Phase 2**: employee layer (Register, QR login, `EmployeeLayout` and messages, employee role, `AccountInactive`, auth edits, Login, pending-approval UI). Commit.
3. **Phase 3**: authoring extras (Drafts, Scheduled, Archived, archive toggle, like/comment notification types, services). Commit.
4. **Phase 4**: HelpCenter, RoleDefinitions, guidance, Analytics widget, i18n. Commit.
After each phase: `npm run lint` and `npm run build`. Final grep sweep for the terms you listed, and `npm ls`/`package.json` check for unused deps.

## 9. Decisions I need from you

1. **Lint gate.** Baseline is 273 problems, ~170 in `functions/` (CommonJS globals) and ~100 in `src/` that already exist. *Recommended:* gate on "no new problems vs the baseline and zero problems in every file I edit", and leave the `functions/` lint config for a separate task. Alternative: fix all pre-existing errors now (larger diff, touches protected files). Which do you want?
2. **Private notes.** OK to (a) keep the write path as-is, (b) add the small read-only notes list in `AdminActionPanel`, and (c) drop the author notification in `addAdminComment`? *Recommended: yes.*
3. **Archive toggle** in `AdminActionPanel`. With `ArchivedPosts` gone, an archived case could never be un-archived. *Recommended:* remove the toggle (Phase 3). Existing `isArchived` data is untouched.
4. **Moderation routes.** *Recommended:* keep `/moderation*` routes registered (reachable only by URL, files compile and stay reviewable), but unlinked from every nav. Alternative: unregister the routes too.
5. **`super_admin` on shared pages** (`/help`, `/policies`, `/notifications`, `/vendor-risk`, `/templates`). Today they get `EmployeeLayout`. *Recommended:* `RoleBasedLayout` wraps `company_admin`/`hr` in `CompanyAdminLayout` and renders `super_admin` children without a shell, like the other `/admin/*` pages. Check that `CompanyAdminLayout` does not already support super_admin before I commit to this; I will verify when implementing.
6. **`/qr-generator`** (public credential-QR page): delete as part of QR login? *Recommended: yes.*
7. **`PolicyAcknowledgementBanner` and `AnonymityGuaranteeScreen`** become orphans. *Recommended:* leave both in place this task (policy area protected), and decide when the report-link flow is built. Alternative: delete both.
8. **CompanyAnalytics "user engagement / top contributors"** (counts public comments per user) and the "comments" fetch. You scoped only per-wall widgets, so I plan to leave these. *Recommended:* leave and revisit in the analytics review.
9. **Member management.** The Approve/Reject (pending) UI is the "HR approval step" and the "Employee" role option appears in role dialogs. *Recommended:* remove both, and render any legacy `employee` rows read-only with a neutral label so existing data still displays. Confirm, since `MemberManagement*` is not on your remove or protected lists.
10. **Existing employee data.** Employee `users` documents stay as-is in Firestore. They simply can no longer sign in (inactive screen). Nothing deletes them.

Nothing will change until you reply.
