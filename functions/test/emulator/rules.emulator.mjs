/**
 * Security-rules checks (claims-based auth, public report internals) against the emulators; nothing is deployed.
 *
 *   mkdir /tmp/rules-check && cd /tmp/rules-check && npm i firebase-tools @firebase/rules-unit-testing firebase
 *   cp <repo>/functions/test/emulator/rules.emulator.mjs .
 *   REPO_ROOT=<repo> npx firebase emulators:exec --only firestore,storage --project demo-voxwel "node rules.emulator.mjs"
 *
 * Known emulator gap: "anon cannot overwrite pending" reports FAIL because the Storage emulator
 * does not treat a re-upload as an update. Confirm against the real bucket.
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";

const root = process.env.REPO_ROOT || "/home/user/company-voice";
const env = await initializeTestEnvironment({
  projectId: "demo-voxwel",
  firestore: { rules: readFileSync(`${root}/firestore.rules`, "utf8"), host: "127.0.0.1", port: 8080 },
  storage: { rules: readFileSync(`${root}/storage.rules`, "utf8"), host: "127.0.0.1", port: 9199 },
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "companies", "c1"), { name: "Acme", isActive: true });
  await setDoc(doc(db, "companies", "c2"), { name: "Beta", isActive: true });
  await setDoc(doc(db, "users", "hr1"), { username: "hank", role: "hr", companyId: "c1", status: "active", displayName: "Hank" });
  await setDoc(doc(db, "users", "adm1"), { username: "alice", role: "company_admin", companyId: "c1", status: "active" });
  await setDoc(doc(db, "users", "hr2"), { username: "hera", role: "hr", companyId: "c2", status: "active" });
  await setDoc(doc(db, "userCredentials", "hr1"), { passwordHash: "x", algo: "scrypt" });
  await setDoc(doc(db, "posts", "pPublicHR"), { companyId: "c1", involvesHR: true, privacyLevel: "hr_only" });
  await setDoc(doc(db, "posts", "pPublicOK"), { companyId: "c1", involvesHR: false, privacyLevel: "hr_only" });
  await setDoc(doc(db, "posts", "pLegacy"), { companyId: "c1", privacyLevel: "hr_only" });
  await setDoc(doc(db, "posts", "pOtherCo"), { companyId: "c2", involvesHR: false });
  await setDoc(doc(db, "caseAccess", "VW-AAAA-BBBB"), { postId: "x", keyHash: "h" });
  await setDoc(doc(db, "reportSlugs", "acme-1234"), { companyId: "c1" });
  await setDoc(doc(db, "rateLimits", "h"), { count: 1 });
  await setDoc(doc(db, "authSessions", "legacy"), { role: "super_admin", userId: "x", companyId: null });
});

// Contexts. Staff carry the claims the login function mints; "anon" is any Firebase user without them.
const ctx = {
  hr: env.authenticatedContext("hr1", { role: "hr", companyId: "c1" }),
  admin: env.authenticatedContext("adm1", { role: "company_admin", companyId: "c1" }),
  hr2: env.authenticatedContext("hr2", { role: "hr", companyId: "c2" }),
  root: env.authenticatedContext("root1", { role: "super_admin", companyId: null }),
  anon: env.authenticatedContext("anon-attacker", { firebase: { sign_in_provider: "anonymous" } }),
  nobody: env.unauthenticatedContext(),
};
const fs = (k) => ctx[k].firestore();
let fails = 0;
const check = async (name, p) => { try { await p; console.log("PASS", name); } catch (e) { fails++; console.log("FAIL", name, e.message.slice(0, 120)); } };
const nowAllowed = { updatedAt: new Date() };

// ---- forgery: nothing a client does can grant a role
await check("anonymous user cannot write authSessions", assertFails(setDoc(doc(fs("anon"), "authSessions", "anon-attacker"), { role: "super_admin", userId: "x", companyId: null })));
await check("forged authSession grants nothing (still cannot read posts)", assertFails(getDoc(doc(fs("anon"), "posts", "pPublicOK"))));
await check("staff cannot read authSessions", assertFails(getDoc(doc(fs("root"), "authSessions", "legacy"))));
await check("staff cannot write authSessions", assertFails(setDoc(doc(fs("root"), "authSessions", "root1"), { role: "super_admin" })));
await check("anonymous cannot read users (password hashes are gone from this collection anyway)", assertFails(getDocs(collection(fs("anon"), "users"))));
await check("anonymous cannot create users", assertFails(setDoc(doc(fs("anon"), "users", "new1"), { username: "evil", role: "super_admin", companyId: "c1", status: "active" })));
await check("anonymous cannot read companies", assertFails(getDoc(doc(fs("anon"), "companies", "c1"))));
await check("unauthenticated cannot read companies or users", assertFails(getDoc(doc(fs("nobody"), "companies", "c1"))) && assertFails(getDoc(doc(fs("nobody"), "users", "hr1"))));
await check("role claim with a made-up value is not authenticated", assertFails(getDoc(doc(env.authenticatedContext("x", { role: "employee", companyId: "c1" }).firestore(), "posts", "pPublicOK"))));
for (const k of ["anon", "hr", "admin", "root"]) {
  await check(`${k} cannot read userCredentials`, assertFails(getDoc(doc(fs(k), "userCredentials", "hr1"))));
  await check(`${k} cannot write userCredentials`, assertFails(setDoc(doc(fs(k), "userCredentials", "hr1"), { passwordHash: "mine" })));
}

// ---- users
await check("user reads own document", assertSucceeds(getDoc(doc(fs("hr"), "users", "hr1"))));
await check("hr cannot read other company's user", assertFails(getDoc(doc(fs("hr"), "users", "hr2"))));
await check("hr reads same-company user", assertSucceeds(getDoc(doc(fs("hr"), "users", "adm1"))));
await check("company users query (companyId filter) works", assertSucceeds(getDocs(query(collection(fs("admin"), "users"), where("companyId", "==", "c1")))));
await check("cross-company users query is rejected", assertFails(getDocs(query(collection(fs("admin"), "users"), where("companyId", "==", "c2")))));
await check("super_admin reads any user", assertSucceeds(getDoc(doc(fs("root"), "users", "hr2"))));
await check("user may update own displayName", assertSucceeds(updateDoc(doc(fs("hr"), "users", "hr1"), { displayName: "Hank H", ...nowAllowed })));
for (const field of [["role", "company_admin"], ["status", "suspended"], ["companyId", "c2"], ["username", "root"], ["password", "abc"], ["mustChangePassword", false], ["suspendedUntil", new Date()]]) {
  await check(`user cannot update own ${field[0]}`, assertFails(updateDoc(doc(fs("hr"), "users", "hr1"), { [field[0]]: field[1] })));
  await check(`company_admin cannot update ${field[0]} of a member`, assertFails(updateDoc(doc(fs("admin"), "users", "hr1"), { [field[0]]: field[1] })));
  await check(`super_admin cannot update ${field[0]} from the client either`, assertFails(updateDoc(doc(fs("root"), "users", "hr1"), { [field[0]]: field[1] })));
}
await check("company_admin may set department/tag of a same-company user", assertSucceeds(updateDoc(doc(fs("admin"), "users", "hr1"), { departmentId: "d1", userTagId: "t1", ...nowAllowed })));
await check("company_admin cannot touch another company's user", assertFails(updateDoc(doc(fs("admin"), "users", "hr2"), { departmentId: "d1" })));
await check("hr cannot modify another user's displayName", assertFails(updateDoc(doc(fs("hr"), "users", "adm1"), { displayName: "pwned" })));
await check("nobody deletes users from the client", assertFails(deleteDoc(doc(fs("root"), "users", "hr1"))));

// ---- companies
await check("member reads own company", assertSucceeds(getDoc(doc(fs("hr"), "companies", "c1"))));
await check("member cannot read another company", assertFails(getDoc(doc(fs("hr"), "companies", "c2"))));
await check("company_admin cannot set reportSlug / isActive", assertFails(updateDoc(doc(fs("admin"), "companies", "c1"), { reportSlug: "x" })) && assertFails(updateDoc(doc(fs("admin"), "companies", "c1"), { isActive: false })));
await check("company_admin can update profile fields of own company", assertSucceeds(updateDoc(doc(fs("admin"), "companies", "c1"), { industry: "Retail" })));
await check("super_admin can toggle isActive", assertSucceeds(updateDoc(doc(fs("root"), "companies", "c1"), { isActive: true })));
await check("nobody creates or deletes companies from the client", assertFails(setDoc(doc(fs("root"), "companies", "cNew"), { name: "x" })) && assertFails(deleteDoc(doc(fs("root"), "companies", "c2"))));

// ---- posts: company isolation and the involvesHR restriction are unchanged
await check("hr cannot read involvesHR post", assertFails(getDoc(doc(fs("hr"), "posts", "pPublicHR"))));
await check("company_admin reads involvesHR post", assertSucceeds(getDoc(doc(fs("admin"), "posts", "pPublicHR"))));
await check("super_admin reads involvesHR post", assertSucceeds(getDoc(doc(fs("root"), "posts", "pPublicHR"))));
await check("hr reads normal post", assertSucceeds(getDoc(doc(fs("hr"), "posts", "pPublicOK"))));
await check("hr cannot read legacy post (no field) until backfilled", assertFails(getDoc(doc(fs("hr"), "posts", "pLegacy"))));
await check("hr unfiltered company query is rejected", assertFails(getDocs(query(collection(fs("hr"), "posts"), where("companyId", "==", "c1")))));
await check("hr query with involvesHR==false works", assertSucceeds(getDocs(query(collection(fs("hr"), "posts"), where("companyId", "==", "c1"), where("involvesHR", "==", false)))));
await check("admin unfiltered company query works", assertSucceeds(getDocs(query(collection(fs("admin"), "posts"), where("companyId", "==", "c1")))));
await check("company A staff cannot read company B posts", assertFails(getDoc(doc(fs("hr"), "posts", "pOtherCo"))) && assertFails(getDoc(doc(fs("admin"), "posts", "pOtherCo"))));
await check("hr cannot update involvesHR post", assertFails(updateDoc(doc(fs("hr"), "posts", "pPublicHR"), { status: "closed" })));
await check("admin can update involvesHR post", assertSucceeds(updateDoc(doc(fs("admin"), "posts", "pPublicHR"), { status: "closed" })));
await check("hr can update normal post", assertSucceeds(updateDoc(doc(fs("hr"), "posts", "pPublicOK"), { status: "closed" })));

// ---- public report internals stay server-only
for (const c of ["caseAccess/VW-AAAA-BBBB", "reportSlugs/acme-1234", "rateLimits/h", "posts/pPublicOK"]) {
  const [col, id] = c.split("/");
  await check(`unauthenticated cannot read ${c}`, assertFails(getDoc(doc(fs("nobody"), col, id))));
  await check(`anonymous cannot read ${c}`, assertFails(getDoc(doc(fs("anon"), col, id))));
}
for (const k of ["admin", "hr", "root"]) for (const c of ["caseAccess/VW-AAAA-BBBB", "reportSlugs/acme-1234", "rateLimits/h"]) {
  const [col, id] = c.split("/");
  await check(`${k} cannot read ${c}`, assertFails(getDoc(doc(fs(k), col, id))));
  await check(`${k} cannot write ${c}`, assertFails(setDoc(doc(fs(k), col, id), { a: 1 })));
}

// ---- storage
const st = (k) => ctx[k].storage();
const bytes = new Uint8Array([1, 2, 3]);
const up = (k, path, type, data = bytes) => uploadBytes(ref(st(k), path), data, { contentType: type });
await check("anon upload pdf to pending", assertSucceeds(up("nobody", "public-reports/pending/abcdefghijklmnop/a.pdf", "application/pdf")));
await check("anon upload disallowed mime", assertFails(up("nobody", "public-reports/pending/abcdefghijklmnop/a.exe", "application/x-msdownload")));
await check("anon upload oversize", assertFails(up("nobody", "public-reports/pending/abcdefghijklmnop/b.png", "image/png", new Uint8Array(10 * 1024 * 1024 + 1))));
await check("anon upload bad uploadId", assertFails(up("nobody", "public-reports/pending/short/a.pdf", "application/pdf")));
await check("anon cannot read pending", assertFails(getBytes(ref(st("nobody"), "public-reports/pending/abcdefghijklmnop/a.pdf"))));
await check("anon cannot overwrite pending", assertFails(up("nobody", "public-reports/pending/abcdefghijklmnop/a.pdf", "application/pdf")));
await check("anon cannot write case folder", assertFails(up("nobody", "companies/c1/cases/p1/x.pdf", "application/pdf")));
await check("staff cannot write case folder (functions only)", assertFails(up("admin", "companies/c1/cases/p1/x.pdf", "application/pdf")));
await env.withSecurityRulesDisabled(async (c) => { await uploadBytes(ref(c.storage(), "companies/c1/cases/p1/x.pdf"), bytes, { contentType: "application/pdf" }); await uploadBytes(ref(c.storage(), "companies/c2/cases/p2/y.pdf"), bytes, { contentType: "application/pdf" }); });
await check("company staff read own case files", assertSucceeds(getBytes(ref(st("hr"), "companies/c1/cases/p1/x.pdf"))));
await check("staff cannot read another company's case files", assertFails(getBytes(ref(st("hr"), "companies/c2/cases/p2/y.pdf"))));
await check("role-less Firebase user cannot read case files", assertFails(getBytes(ref(st("anon"), "companies/c1/cases/p1/x.pdf"))));
await check("super_admin reads any company's case files", assertSucceeds(getBytes(ref(st("root"), "companies/c2/cases/p2/y.pdf"))));
await check("company staff upload to own post attachments, not another company's", assertSucceeds(up("hr", "companies/c1/posts/p1/attachments/a.pdf", "application/pdf")) && assertFails(up("hr", "companies/c2/posts/p1/attachments/a.pdf", "application/pdf")));
await check("only company_admin changes the logo", assertSucceeds(up("admin", "companies/c1/logo/l.png", "image/png")) && assertFails(up("hr", "companies/c1/logo/l.png", "image/png")));
await check("role-less Firebase user cannot upload anywhere private", assertFails(up("anon", "companies/c1/posts/p1/attachments/a.pdf", "application/pdf")) && assertFails(up("anon", "temp/anon-attacker/a.pdf", "application/pdf")));
await check("admin/ folder is super_admin only", assertFails(up("admin", "admin/x/a.pdf", "application/pdf")) && assertSucceeds(up("root", "admin/x/a.pdf", "application/pdf")));
await env.cleanup();
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
