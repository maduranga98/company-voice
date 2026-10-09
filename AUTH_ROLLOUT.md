# Auth hardening: rollout, rollback, bootstrap

What changes: credentials are checked by the `login` Cloud Function (scrypt, throttled), sessions are Firebase Auth users whose uid is the `users/{id}` document id and whose custom claims are `{ role, companyId }`, and Firestore and Storage rules authorize from those claims only. Clients can no longer write roles, statuses, company ids, usernames or credentials.

**Everyone is signed out once.** Existing staff sessions are anonymous Firebase users without a role claim; the new client signs them out on load and they must log in again. Rules and client must go out together: the new rules reject the old client (no claims) and the old rules do not understand the new client.

## One-time prerequisites

1. Secrets (all are `firebase functions:secrets:set NAME`): `IP_HASH_SALT` is now also used for login throttling, so it must exist before `login` is deployed. The public-report secrets from step 1 are unchanged.
2. The Functions runtime service account needs **Service Account Token Creator** on itself (`createCustomToken` signs through IAM). `generateAuthToken` needed the same, so this is probably already granted:
   `gcloud iam service-accounts add-iam-policy-binding <project>@appspot.gserviceaccount.com --member=serviceAccount:<project>@appspot.gserviceaccount.com --role=roles/iam.serviceAccountTokenCreator`
3. App Check is enforced on `login` and every user-management callable, so the web app needs `VITE_APPCHECK_SITE_KEY` (already required for the public report line) and the portal domain registered in the reCAPTCHA key. Without it staff cannot log in.
4. Make sure Application Default Credentials work for the scripts (`gcloud auth application-default login`) and that you are pointed at the right project (`GOOGLE_CLOUD_PROJECT=<id>`).
5. Have a way back in: create or confirm a super_admin credential first (see Bootstrap below).

## Deploy order

1. **Deploy functions.** `firebase deploy --only functions`. Safe while the old client is live: the new functions are additive, `login` falls back to `users.password` for accounts that are not migrated yet, and the old client does not call any of them. Functions that changed identity resolution (search, notifications, billing, super admin, report link) now read claims, so they stop working for old anonymous sessions from this moment until step 3. If that matters, do steps 1 to 3 in one maintenance window.
2. **Migrate credentials.** `GOOGLE_CLOUD_PROJECT=<id> node scripts/migrateCredentials.js --dry-run`, check the counts, then without the flag. It copies each `users.password` hash into `userCredentials/{id}` (`algo: "sha256-legacy"`), deletes the `password` field from the user documents, never overwrites an existing credential, and is idempotent (safe to re-run). Hashes are upgraded to scrypt at each user's next login. Running it before step 3 breaks the old client's login (it queries `users.password`), so run it immediately before step 3.
3. **Deploy rules and client together.** `firebase deploy --only firestore:rules,storage,hosting` (and rebuild the client with the production env, including `VITE_APPCHECK_SITE_KEY`). Run `scripts/backfillInvolvesHR.js --apply` before this if the step 1 rollout has not already (see STEP1_NOTES.md).
4. **Delete the old sessions.** `node scripts/deleteAuthSessions.js` (dry run) then `--apply`. The rules already deny the collection; this removes the data. Also consider deleting the leftover anonymous Firebase Auth users in the console (Authentication > Users, filter by provider "Anonymous").
5. **Verify.**
   - Log in as super_admin, a company_admin and an hr user; each lands on its dashboard.
   - A wrong password shows "Invalid username or password"; ten wrong attempts lock the username for 15 minutes.
   - hr cannot see an `involvesHR` case in the inbox; company_admin can.
   - A company_admin cannot open another company's data (try a copied company id).
   - In the browser console, `getDocs(collection(db, "userCredentials"))` and `getDocs(collection(db, "authSessions"))` are denied; `users` documents have no `password` field.
   - Add an HR user (temporary password appears once), reset a password, suspend a member (they are signed out within minutes), change your own password.

## Behaviour notes

- Revocation: suspending, deactivating, removing, resetting the password of, or changing the role of a user calls `revokeRefreshTokens`. The client refreshes its ID token every 5 minutes and on every hourly expiry, so the user is signed out within about 5 minutes. Firestore and Storage rules do not check revocation, so an already-issued ID token keeps working until it expires (at most 1 hour). User-management callables re-read the caller's `users` document, so they stop working immediately.
- Role or company changes take effect at the next login (claims are minted from the `users` document at login).
- The `invited` status has no flow behind it (no invitation creation, email or activation existed before). Not built: listed as a gap. `createStaffUser` returns a one-time temporary password instead, and the user must change it at first login.
- Expired suspensions no longer block login: the next successful login clears them (the old client left such users unable to log in).
- `Register.jsx` (employee self-registration) is removed: clients cannot create users any more.

## Rollback

Rollback must also be done together (rules + client + functions), because the old client needs the old rules.

1. Redeploy the previous commit's rules and hosting build (`git checkout <previous> -- firestore.rules storage.rules` and rebuild the client), then functions.
2. The old login queries `users.password`. If you already ran `migrateCredentials.js`, restore the field first: for each `userCredentials` doc with `algo: "sha256-legacy"` the hash can be written back to `users/{id}.password`; **scrypt hashes cannot be converted back** (users who already logged in after the migration have scrypt credentials). In that case reset those users' passwords through the old super_admin flow or set a known SHA-256 hash by hand. This is why the migration step is last before the rules/client deploy and should be dry-run first.
3. `authSessions` documents are recreated by the old client at login, so deleting them (step 4) does not block a rollback.
4. If only the new client misbehaves but rules/functions are fine, roll back hosting alone is **not** possible (the old client cannot log in against the new rules). Fix forward or roll back everything.

## Bootstrap: first super_admin

`scripts/createSuperAdmin.js <username> [--display-name "Name"]` creates (or resets the password of) a super_admin directly with the Admin SDK. The password comes from a hidden prompt (or `CREATE_SUPER_ADMIN_PASSWORD` for non-interactive use), is never an argument, is hashed with scrypt before it is written, and is never printed or stored in a file:

```
GOOGLE_CLOUD_PROJECT=<id> node scripts/createSuperAdmin.js root --display-name "Platform Admin"
```

Use it before the first deploy if there is no working super_admin, and as the recovery path if the last super_admin password is lost (it also revokes that account's sessions).
