# AUTH_AUDIT: current authentication and authorization

Branch `rework/auth-hardening`, cut from `rework/public-report-form`. Audit of the state before this change.

## 0. Discrepancy with the task description

The removal phase is still not in the repo: `Register.jsx` (employee self-registration), `QRCodeGenerator.jsx`, the QR-credential login in `Login.jsx`, `EmployeeLayout`, the feeds and the employee role are all present. Consequences handled in this change:

- `Register.jsx` writes `users` documents from the browser with a client-side hash. It cannot survive the new rules, so the page, its route and the Login hand-off to it are removed. Nothing in the spec needs it.
- The credential-QR login in `Login.jsx` just calls `login(username, password)`, so it keeps working through the new callable. It is not touched beyond the removed `/register` hand-offs.
- The `employee` role cannot log in any more (login callable and rules only know super_admin, company_admin, hr).

## 1. How login works today

`src/services/authService.js loginWithUsernamePassword`:
1. `CryptoJS.SHA256(password)` in the browser (unsalted).
2. `signInAnonymously` (reuses `auth.currentUser`).
3. Writes `authSessions/{uid}` = `{userId:"pending", role:"pending", ...}` so rules let the next queries run.
4. Queries `users` where `username == x && password == hash` (the hash is stored in the `users` doc and readable by any anonymous user).
5. Status checks in the browser (`suspended` with `suspendedUntil`, `invited`, anything not `active` = deactivated), company `isActive` check (reads `companies/{id}`, which is world-readable).
6. Writes the real `authSessions/{uid}` = `{userId, username, companyId, role}` (client-writable: this is what lets any client forge a session).
7. `updateDoc(users/{id}, {lastLogin})`.
8. `AuthContext` stores the user in `localStorage.currentUser` and re-validates it against Firestore on reload.

`logout` writes `authSessions` back to `pending` and clears `currentUser`; it never signs out of Firebase.

`functions/api/authApi.js generateAuthToken` (v2 `onCall`, `cors: true`, no App Check, no rate limit, unsalted SHA-256 compare, returns the whole users doc minus `password`) exists but no client calls it.

## 2. Every reader/writer of `users`

| Where | Operation | Fields |
|---|---|---|
| `authService.js` | read by username+hash, update `lastLogin`, `checkUsernameExists` (unauthenticated query) | `password` read in query |
| `AuthContext.jsx` | read own doc on session restore and refresh | |
| `pages/admin/CompanyManagement.jsx` | **create** company admin (`addDoc users`, hashes password in browser), **batch delete** users of a company, delete `authSessions` of the company | `password`, `role`, `status`, `companyId` |
| `pages/Register.jsx` | **create** employee/pending users with client hash | `password`, `role`, `status` |
| `pages/company/MemberManagement.jsx` | update `status` (approve/reject/remove), `role`, `userTagId`, `departmentId`, `hadPosts`, `removedAt`; batch delete removed users | privileged: `status`, `role`, `hadPosts`, `removedAt` |
| `pages/company/MemberManagementWithDepartments.jsx` | same plus `status: suspended`, reactivate | privileged: `status`, `role` |
| `services/departmentservice.js` | update `departmentId`, `previousDepartmentId`, `departmentChangedAt`; reads | org fields |
| `services/moderationService.js` (L575, L785) | **suspend** a user: `status`, `suspendedAt`, `suspendedUntil`, `suspensionReason`, `suspendedBy` | privileged |
| `pages/Profile.jsx` | self update `displayName`, `email` | profile |
| `components/DisclosureModal.jsx`, `AdminActionPanel`, `CreatePost` (notify), `policyService`, `mentionsService`, `AuditLog`, `CompanyAnalytics`, `CompanyDashboard`, `PolicyManagement`, `CompanyBilling` | read only (company-scoped queries) | |
| `functions/api/searchApi.js`, `notificationApi.js`, `companyAdminApi.js`, `superAdminApi.js` (via helpers), `usageTrackingService.js`, `scheduled/notificationJobs.js`, `publicReportApi.js` | Admin SDK reads (role, companyId, counts, notification targets) | |

No code creates users with status `invited`, no invitation email or token exists, and no password reset or change exists anywhere. Gap: the "invitation/activation flow" is only a status label that login messages for. It is **not built** here (listed as a gap); `createStaffUser` returns a one-time temporary password instead.

## 3. Every reader/writer of `authSessions`

- Client: `authService.js` (create pending, upgrade, reset on failure), `AuthContext.jsx` (create/update during session restore, reset on logout), `CompanyManagement.jsx` (delete sessions of a deleted company).
- Rules: `getSession()` is the source of `getUserRole()`, `getUserCompanyId()`, `getUserId()`; collection rule lets the owner of the uid create, update, delete, read.
- Functions: `utils/helpers.js getUserIdFromAuthSession` and, through it, `isSuperAdmin`, `isCompanyAdmin`; direct users: `searchApi` (6 callables), `notificationApi` (7), `companyAdminApi` (13 call sites), `superAdminApi` (7), `publicReportApi ensureReportSlug/setReportingEnabled`.
- Tests/scripts: `functions/test/emulator/*.mjs` seed `authSessions`.

## 4. `localStorage.currentUser`

Only `AuthContext.jsx` reads/writes it (`rememberedUsername` in `Login.jsx` is a separate convenience key and stays). `KeyVaultSetup.jsx` and `utils/constants.js` mention `currentUser` in comments/props only.

## 5. Rules helpers that depend on the session

`firestore.rules`: `getSession/getUserRole/getUserCompanyId/getUserId`, `isSuperAdmin/isCompanyAdmin/isHR/isAdminOrHR/isCompanyStaff/belongsToCompany/isSuperAdminOrBelongsToCompany/isLoginPending/isAdminOrHRInCompany/canReadPost`. All ~140 uses of the collection rules go through these helpers, so redefining the helpers on claims migrates every collection rule without touching their bodies. Special cases: `users` rules (anonymous-provider allowance on read and create, `isLoginPending`), `companies` (`allow read: if true`), the `authSessions` collection itself.

## 6. Storage rules that depend on identity

`storage.rules` uses only `isAuthenticated()` (any signed-in session, including a forged one) with no company or role scoping on `companies/*/posts`, `discussions`, `documents`, `exports`, `logo`, `users/*/profile`, `posts/{companyId}`, `policies`, `vendorEvidence`, `legal-evidence`, `temp/{userId}`, `admin/*`. It cannot read Firestore, so after this change it must use claims (`token.role`, `token.companyId`).

## 7. Weaknesses confirmed

1. `authSessions` self-writable: any anonymous user becomes super_admin (verified earlier in the emulator).
2. `users` readable and creatable by any anonymous user; password hashes in the same documents.
3. Unsalted SHA-256, hash compared in a Firestore query from the browser; no server-side lockout; unlimited guessing.
4. `generateAuthToken`: same hash, `cors: true`, no App Check, returns more fields than needed, error messages echo `error.message`.
5. Account state checks (suspended, invited, deactivated, company inactive) run in the browser against data any anonymous user can read, so state is not protected from guessers either.
6. Signing out never signs out of Firebase; the anonymous uid persists.
7. `Login` QR flow places credentials in a QR image (out of scope; noted).
8. Out of scope but still present: the AES secret for anonymous author/thread encryption is bundled into the client (`VITE_ANONYMOUS_SECRET`).
