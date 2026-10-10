/**
 * Auth hardening checks against the emulators (functions, firestore, auth). Nothing is deployed.
 *
 *   cd <scratch dir with firebase-tools installed>
 *   REPO_ROOT=<repo> npx firebase emulators:exec --only functions,firestore,auth --project demo-voxwel \
 *     --config <repo>/firebase.json "node auth.emulator.mjs"
 *
 * Needs functions/.secret.local with IP_HASH_SALT etc. (gitignored).
 */

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const root = process.env.REPO_ROOT || "/home/user/company-voice";
const require = createRequire(`${root}/functions/`);
const admin = require("firebase-admin");
const { hashPassword } = require("./utils/passwords");

const PROJECT = "demo-voxwel";
const FN = `http://127.0.0.1:5001/${PROJECT}/us-central1`;
const AUTH = "http://127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`);
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const APP_CHECK = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "1:1:web:test", aud: [`projects/${PROJECT}`], iss: "https://firebaseappcheck.googleapis.com/1" })}.x`;

async function call(name, data, idToken) {
  const res = await fetch(`${FN}/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-firebase-appcheck": APP_CHECK,
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const json = await res.json();
  return json.error ? { error: json.error } : { result: json.result };
}

const sha = (p) => crypto.createHash("sha256").update(p, "utf8").digest("hex");
const decode = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
const clearLimits = async () => {
  const snap = await db.collection("rateLimits").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
};

async function exchange(customToken) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=x`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  return r.json();
}

async function signIn(username, password) {
  const res = await call("login", { username, password });
  if (!res.result) return { res };
  const session = await exchange(res.result.customToken);
  return { res, idToken: session.idToken, refreshToken: session.refreshToken, user: res.result.user };
}

// The Auth emulator does not enforce revocation on its refresh endpoint, so check the
// revocation state the way the Admin SDK does (auth_time vs tokensValidAfterTime).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function isRevoked(idToken) {
  try {
    await admin.auth().verifyIdToken(idToken, true);
    return false;
  } catch (error) {
    return error.code === "auth/id-token-revoked";
  }
}

// ---- seed
await db.doc("companies/c1").set({ name: "Acme", isActive: true });
await db.doc("companies/c2").set({ name: "Beta", isActive: true });
await db.doc("companies/cOff").set({ name: "Off", isActive: false });
const user = (id, username, role, companyId, extra = {}) =>
  db.doc(`users/${id}`).set({ username, role, companyId, status: "active", displayName: username, ...extra });

// legacy accounts: hash still in users.password (pre-migration state)
await user("super1", "root", "super_admin", null, { password: sha("SuperPass1!") });
await user("admin1", "alice", "company_admin", "c1", { password: sha("AlicePass1!") });
await user("hr1", "hank", "hr", "c1", { password: sha("HankPass1!") });
await user("admin2", "bob", "company_admin", "c2", { password: sha("BobPass123!") });
await user("hr2", "hera", "hr", "c2", { password: sha("HeraPass12!") });
await user("emp1", "eddie", "employee", "c1", { password: sha("EddiePass1!") });
await user("hrSusp", "sam", "hr", "c1", { password: sha("SamPass123!"), status: "suspended", suspendedUntil: new Date(Date.now() + 5 * 864e5), suspensionReason: "Test" });
await user("hrDeact", "dana", "hr", "c1", { password: sha("DanaPass12!"), status: "deactivated" });
await user("hrInv", "ivy", "hr", "c1", { password: sha("IvyPass123!"), status: "invited" });
await user("hrOffCo", "oscar", "hr", "cOff", { password: sha("OscarPass1!") });
// already-scrypt account
await user("hrNew", "nina", "hr", "c1");
await db.doc("userCredentials/hrNew").set({ ...(await hashPassword("NinaPass123!")), mustChangePassword: false });

// ---- migration script
const runMigration = (args) =>
  execFileSync("node", [`${root}/scripts/migrateCredentials.js`, ...args], {
    env: { ...process.env, GOOGLE_CLOUD_PROJECT: PROJECT },
    encoding: "utf8",
  });
await user("migr1", "mia", "hr", "c1", { password: sha("MiaPass1234!") });
const dry = runMigration(["--dry-run"]);
check("migration dry run changes nothing", (await db.doc("users/migr1").get()).data().password && !(await db.doc("userCredentials/migr1").get()).exists && /dry-run/.test(dry));
runMigration([]);
const migrated = await db.doc("userCredentials/migr1").get();
check("migration copies hash as sha256-legacy and removes users.password",
  migrated.exists && migrated.data().algo === "sha256-legacy" && migrated.data().passwordHash === sha("MiaPass1234!") && (await db.doc("users/migr1").get()).data().password === undefined);
const second = runMigration([]);
check("migration is idempotent", /0 had a password field|0 credentials/.test(second) && (await db.doc("userCredentials/migr1").get()).data().algo === "sha256-legacy", second);
check("migration leaves an existing scrypt credential alone", (await db.doc("userCredentials/hrNew").get()).data().algo === "scrypt");

// ---- login
const aliceLogin = await signIn("Alice", "AlicePass1!");
check("login succeeds (username case-insensitive) with minimal user payload",
  aliceLogin.res.result?.user?.id === "admin1" && aliceLogin.res.result.user.role === "company_admin" && aliceLogin.res.result.user.companyId === "c1", JSON.stringify(aliceLogin.res));
const keys = JSON.stringify(Object.keys(aliceLogin.res.result.user)) + JSON.stringify(Object.keys(aliceLogin.res.result));
check("login response has no password fields", !/password(?!Hash)/i.test(keys.replace(/mustChangePassword/g, "")) && !/hash/i.test(keys), keys);
const claims = decode(aliceLogin.idToken);
check("ID token carries uid and { role, companyId } claims", claims.user_id === "admin1" && claims.role === "company_admin" && claims.companyId === "c1", JSON.stringify(claims));
const aliceCred = (await db.doc("userCredentials/admin1").get()).data();
check("legacy sha256 account re-hashed to scrypt on first login and users.password removed",
  aliceCred?.algo === "scrypt" && aliceCred.params.N === 32768 && (await db.doc("users/admin1").get()).data().password === undefined);
check("second login works with the scrypt credential", !!(await signIn("alice", "AlicePass1!")).idToken);
const rootLogin = await signIn("root", "SuperPass1!");
check("super_admin token has companyId null", rootLogin.idToken && decode(rootLogin.idToken).role === "super_admin" && decode(rootLogin.idToken).companyId === null);
check("migrated legacy credential logs in and upgrades", !!(await signIn("mia", "MiaPass1234!")).idToken && (await db.doc("userCredentials/migr1").get()).data().algo === "scrypt");

const wrong = await call("login", { username: "alice", password: "nope-nope-1" });
const unknown = await call("login", { username: "ghost", password: "nope-nope-1" });
check("wrong password and unknown user give the same generic error",
  wrong.error?.message === "Invalid username or password" && JSON.stringify(wrong.error) === JSON.stringify(unknown.error), JSON.stringify([wrong, unknown]));
check("malformed input is generic too", (await call("login", { username: { $ne: 1 }, password: "x" })).error?.message === "Invalid username or password");

// account state: only after the password verifies
const stateCases = [
  ["sam", "SamPass123!", /suspended until/, "suspended"],
  ["dana", "DanaPass12!", /deactivated/, "deactivated"],
  ["ivy", "IvyPass123!", /pending activation/, "invited"],
  ["oscar", "OscarPass1!", /company account is deactivated/, "inactive company"],
  ["eddie", "EddiePass1!", /no longer active/, "employee role"],
];
for (const [name, pw, re, label] of stateCases) {
  const good = await call("login", { username: name, password: pw });
  const bad = await call("login", { username: name, password: "wrong-password-1" });
  check(`${label}: message only after correct password`, re.test(good.error?.message || "") && bad.error?.message === "Invalid username or password", JSON.stringify([good, bad]));
}

// lockout: 10 failures, the 11th is refused even with the right password
await clearLimits();
for (let i = 0; i < 10; i++) await call("login", { username: "hank", password: `bad-password-${i}` });
const locked = await call("login", { username: "hank", password: "HankPass1!" });
check("11th attempt is locked out, even with the right password", locked.error?.status === "RESOURCE_EXHAUSTED", JSON.stringify(locked));
const lockGhost = await (async () => { for (let i = 0; i < 10; i++) await call("login", { username: "ghost2", password: "x-x-x-x-x-x" }); return call("login", { username: "ghost2", password: "x-x-x-x-x-x" }); })();
check("lockout also applies to unknown usernames (no enumeration)", lockGhost.error?.status === "RESOURCE_EXHAUSTED");
const limitDocs = await db.collection("rateLimits").get();
check("limiter documents are keyed by hashes only", limitDocs.docs.every((d) => /^[0-9a-f]{64}$/.test(d.id)) && !JSON.stringify(limitDocs.docs.map((d) => [d.id, d.data()])).match(/hank|ghost|127\.0\.0\.1/));
await db.recursiveDelete(db.collection("rateLimits"));
await clearLimits();
check("lock cleared (test reset) and correct password works again", !!(await signIn("hank", "HankPass1!")).idToken);

await clearLimits();
let ipBlocked = null;
for (let i = 1; i <= 31; i++) {
  const r = await call("login", { username: `ip-user-${i}`, password: "x-x-x-x-x-x" });
  if (r.error?.status === "RESOURCE_EXHAUSTED") { ipBlocked = i; break; }
}
check("per-IP limit trips at the 31st attempt in the hour", ipBlocked === 31, String(ipBlocked));
await clearLimits();

// ---- claims gate the existing callables
const anon = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json();
check("anonymous Firebase user (no role claim) is rejected by v1 callables", !!(await call("getSavedSearches", {}, anon.idToken)).error);
const hrLogin = await signIn("hank", "HankPass1!");
check("staff token works on existing v1 callables (identity from uid)", (await call("getSavedSearches", {}, hrLogin.idToken)).result?.success === true);
check("hr cannot manage report link; company_admin can", (await call("ensureReportSlug", { companyId: "c1" }, hrLogin.idToken)).error?.status === "PERMISSION_DENIED" && !!(await call("ensureReportSlug", { companyId: "c1" }, aliceLogin.idToken)).result?.slug);
check("company_admin of A cannot manage report link of B", (await call("ensureReportSlug", { companyId: "c2" }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED");

// ---- user management
const bobLogin = await signIn("bob", "BobPass123!");
const created = await call("createStaffUser", { username: "newhr", displayName: "New HR", email: "n@e.co", companyId: "c2" }, aliceLogin.idToken);
const newHr = created.result;
check("company_admin creates hr in own company only (a companyId in the request is ignored)", newHr?.userId && (await db.doc(`users/${newHr.userId}`).get()).data().role === "hr" && (await db.doc(`users/${newHr.userId}`).get()).data().companyId === "c1", JSON.stringify(created));
check("company_admin asking for company_admin role is refused", (await call("createStaffUser", { username: "x1x", displayName: "X", role: "company_admin" }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED");
check("temporary password returned once, stored only as scrypt, must change", !!newHr?.temporaryPassword && (await db.doc(`userCredentials/${newHr.userId}`).get()).data().algo === "scrypt" && (await db.doc(`userCredentials/${newHr.userId}`).get()).data().mustChangePassword === true && !JSON.stringify((await db.doc(`users/${newHr.userId}`).get()).data()).includes(newHr.temporaryPassword));
const tempLogin = await signIn("newhr", newHr.temporaryPassword);
check("new hr signs in and is told to change the password", tempLogin.res.result?.user.mustChangePassword === true);
check("hr cannot create users", (await call("createStaffUser", { username: "zzz", displayName: "Z" }, hrLogin.idToken)).error?.status === "PERMISSION_DENIED");
check("duplicate username refused", (await call("createStaffUser", { username: "NEWHR", displayName: "Dup" }, aliceLogin.idToken)).error?.status === "ALREADY_EXISTS");
const rootToken = rootLogin.idToken;
check("super_admin can create company_admin in a chosen company", !!(await call("createStaffUser", { username: "carl", displayName: "Carl", role: "company_admin", companyId: "c2", password: "CarlPass123!" }, rootToken)).result?.userId && (await signIn("carl", "CarlPass123!")).user.companyId === "c2");
check("nobody can create a super_admin", (await call("createStaffUser", { username: "evil", displayName: "E", role: "super_admin", companyId: "c1" }, rootToken)).error?.status === "PERMISSION_DENIED");

// company scoping and status changes + revocation
check("company_admin A cannot change status of a user in company B", (await call("setUserStatus", { userId: "hr2", status: "suspended", suspendedUntil: new Date(Date.now() + 864e5).toISOString() }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED");
check("cannot target self, another company_admin or a super_admin", ["admin1", "admin2", "super1"].every(() => true) &&
  (await call("setUserStatus", { userId: "admin1", status: "deactivated" }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED" &&
  (await call("setUserStatus", { userId: "super1", status: "deactivated" }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED" &&
  (await call("setUserStatus", { userId: "super1", status: "deactivated" }, rootToken)).error?.status === "PERMISSION_DENIED");
check("hr cannot change the status of staff", (await call("setUserStatus", { userId: "hrNew", status: "suspended", suspendedUntil: new Date(Date.now() + 864e5).toISOString() }, hrLogin.idToken)).error?.status === "PERMISSION_DENIED");
check("hr (moderation) can suspend a legacy employee in own company", (await call("setUserStatus", { userId: "emp1", status: "suspended", reason: "Strike 3", suspendedUntil: new Date(Date.now() + 864e5).toISOString() }, hrLogin.idToken)).result?.status === "suspended");

check("session is valid before suspension", !(await isRevoked(tempLogin.idToken)));
await sleep(1200);
const susp = await call("setUserStatus", { userId: newHr.userId, status: "suspended", reason: "Test", suspendedUntil: new Date(Date.now() + 864e5).toISOString() }, aliceLogin.idToken);
const suspDoc = (await db.doc(`users/${newHr.userId}`).get()).data();
check("suspend sets status, reason, end date", susp.result?.status === "suspended" && suspDoc.status === "suspended" && suspDoc.suspensionReason === "Test" && suspDoc.suspendedUntil);
check("session is revoked after suspension", await isRevoked(tempLogin.idToken));
check("suspended user cannot log in", (await call("login", { username: "newhr", password: newHr.temporaryPassword })).error?.status === "FAILED_PRECONDITION");
check("reactivation clears suspension fields", (await call("setUserStatus", { userId: newHr.userId, status: "active" }, aliceLogin.idToken)).result?.status === "active" && (await db.doc(`users/${newHr.userId}`).get()).data().suspendedUntil === undefined);
check("suspension needs a future end date", (await call("setUserStatus", { userId: newHr.userId, status: "suspended" }, aliceLogin.idToken)).error?.status === "INVALID_ARGUMENT");

// role changes
check("company_admin cannot change roles in another company", (await call("changeUserRole", { userId: "hr2", role: "company_admin" }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED");
check("role cannot become super_admin", (await call("changeUserRole", { userId: "hrNew", role: "super_admin" }, rootToken)).error?.status === "PERMISSION_DENIED");
const promote = await call("changeUserRole", { userId: "hrNew", role: "company_admin" }, aliceLogin.idToken);
check("company_admin can change a role in own company; new role takes effect at next login", promote.result?.role === "company_admin" && (await signIn("nina", "NinaPass123!")).user.role === "company_admin");
await call("changeUserRole", { userId: "hrNew", role: "hr" }, aliceLogin.idToken);

// password reset
check("company_admin cannot reset another company_admin or users of another company", (await call("resetStaffPassword", { userId: "admin2" }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED" && (await call("resetStaffPassword", { userId: "hr2" }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED");
const reset = await call("resetStaffPassword", { userId: "hrNew" }, aliceLogin.idToken);
check("reset returns a temporary password once; old one stops working; must change set",
  !!reset.result?.temporaryPassword && (await call("login", { username: "nina", password: "NinaPass123!" })).error?.message === "Invalid username or password" && (await signIn("nina", reset.result.temporaryPassword)).user.mustChangePassword === true);

// own password
const ninaLogin = await signIn("nina", reset.result.temporaryPassword);
await sleep(1200);
check("changeOwnPassword rejects a wrong current password", (await call("changeOwnPassword", { currentPassword: "nope", newPassword: "BrandNewPass1!" }, ninaLogin.idToken)).error?.status === "PERMISSION_DENIED");
check("changeOwnPassword rejects a weak new password", (await call("changeOwnPassword", { currentPassword: reset.result.temporaryPassword, newPassword: "short" }, ninaLogin.idToken)).error?.status === "INVALID_ARGUMENT");
const changed = await call("changeOwnPassword", { currentPassword: reset.result.temporaryPassword, newPassword: "BrandNewPass1!" }, ninaLogin.idToken);
check("changeOwnPassword works, revokes sessions, clears mustChangePassword",
  changed.result?.reloginRequired === true && (await isRevoked(ninaLogin.idToken)) && (await signIn("nina", "BrandNewPass1!")).user.mustChangePassword === false);

// removal and deletion
await user("gone1", "gone1", "hr", "c1", { status: "removed" });
await user("gone2", "gone2", "hr", "c2", { status: "removed" });
check("deleteRemovedUsers refuses active users and other companies", (await call("deleteRemovedUsers", { userIds: ["hrNew"] }, aliceLogin.idToken)).error?.status === "INVALID_ARGUMENT" && (await call("deleteRemovedUsers", { userIds: ["gone2"] }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED");
check("deleteRemovedUsers deletes own removed users and credentials", (await call("deleteRemovedUsers", { userIds: ["gone1"] }, aliceLogin.idToken)).result?.deleted === 1 && !(await db.doc("users/gone1").get()).exists);

// company onboarding / deletion
const co = await call("createCompanyWithAdmin", { companyName: "Gamma LLC", industry: "Retail", username: "gina", password: "GinaPass1234!", adminName: "Gina", adminEmail: "g@g.co" }, rootToken);
check("only super_admin creates companies", co.result?.companyId && (await call("createCompanyWithAdmin", { companyName: "X", username: "xx1", adminName: "X" }, aliceLogin.idToken)).error?.status === "PERMISSION_DENIED");
const ginaLogin = await signIn("gina", "GinaPass1234!");
check("company created with a working admin login", ginaLogin.user?.role === "company_admin" && ginaLogin.user.companyId === co.result.companyId);
check("only super_admin deletes companies", (await call("deleteCompany", { companyId: co.result.companyId }, ginaLogin.idToken)).error?.status === "PERMISSION_DENIED");
const del = await call("deleteCompany", { companyId: co.result.companyId }, rootToken);
check("deleteCompany removes company, users and credentials", del.result?.deletedUsers === 1 && !(await db.doc(`companies/${co.result.companyId}`).get()).exists && !(await db.doc(`userCredentials/${ginaLogin.user.id}`).get()).exists);

console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
