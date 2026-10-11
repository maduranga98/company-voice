/**
 * End-to-end check of the policy acknowledgement callables against the Firebase emulators
 * (functions, firestore, auth). Nothing is deployed.
 *
 * From a scratch dir that has `firebase-tools` installed:
 *   REPO_ROOT=<repo> npx firebase emulators:exec --only functions,firestore,auth \
 *     --project demo-voxwel --config <repo>/firebase.json "node policyAck.emulator.mjs"
 *
 * Needs functions/.secret.local with ANONYMOUS_SECRET, CASE_KEY_PEPPER and IP_HASH_SALT (gitignored).
 */

import crypto from "node:crypto";
import { createRequire } from "node:module";

const root = process.env.REPO_ROOT || "/home/user/company-voice";
const require = createRequire(`${root}/functions/`);
const admin = require("firebase-admin");

const PROJECT = "demo-voxwel";
const FN = `http://127.0.0.1:5001/${PROJECT}/us-central1`;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`);
};

// The emulator skips signature checks but still requires an App Check header on enforced callables.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const APP_CHECK = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "1:1:web:test", aud: [`projects/${PROJECT}`], iss: "https://firebaseappcheck.googleapis.com/1" })}.x`;

async function call(name, data, token) {
  const res = await fetch(`${FN}/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-firebase-appcheck": APP_CHECK,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const json = await res.json();
  return json.error ? { error: json.error } : { result: json.result };
}

const rid = (n) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
const sha = (p) => crypto.createHash("sha256").update(p, "utf8").digest("hex");
async function signIn(username, password) {
  const login = await call("login", { username, password });
  const session = await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: login.result.customToken, returnSecureToken: true }) })).json();
  return session.idToken;
}

const submit = (slug, extra = {}) =>
  call("submitPolicyAcknowledgement", {
    slug,
    employeeId: "EMP-0042",
    employeeName: "Ada Lovelace",
    response: "acknowledged",
    policyVersion: "1.0",
    idempotencyToken: rid(24),
    website: "",
    elapsedMs: 30000,
    clientLang: "en",
    ...extra,
  });

// ---- seed
await db.doc("companies/c1").set({ name: "Acme Corp", isActive: true, defaultLanguage: "fr" });
await db.doc("companies/c2").set({ name: "Beta Ltd", isActive: true });
await db.doc("users/admin1").set({ companyId: "c1", role: "company_admin", status: "active", username: "admin1", password: sha("AdminPass123!") });
await db.doc("users/hr1").set({ companyId: "c1", role: "hr", status: "active", username: "hr1", password: sha("HrPass12345!") });
await db.doc("users/hr2").set({ companyId: "c2", role: "hr", status: "active", username: "hr2", password: sha("HrPass22222!") });
await db.doc("policies/p1").set({ companyId: "c1", title: "Code of Conduct", category: "code_of_conduct", version: "1.0", status: "published", content: "Be kind.\nBe honest.", effectiveDate: new Date("2026-01-01"), fileUrl: "https://evil.example/x.pdf", fileName: "x.pdf" });
await db.doc("policies/p2").set({ companyId: "c1", title: "Draft", version: "1.0", status: "draft", content: "wip" });
await db.doc("policies/p3").set({ companyId: "c2", title: "Beta policy", version: "1.0", status: "published", content: "x" });

const adminToken = await signIn("admin1", "AdminPass123!");
const hrToken = await signIn("hr1", "HrPass12345!");
const otherHrToken = await signIn("hr2", "HrPass22222!");

// ---- A. staff: ensurePolicyLink
check("ensurePolicyLink needs sign-in", (await call("ensurePolicyLink", { policyId: "p1" })).error?.status === "UNAUTHENTICATED");
check("another company's HR cannot create a link", (await call("ensurePolicyLink", { policyId: "p1" }, otherHrToken)).error?.status === "PERMISSION_DENIED");
check("a draft policy cannot be shared", (await call("ensurePolicyLink", { policyId: "p2" }, adminToken)).error?.status === "FAILED_PRECONDITION");
check("unknown policy is not-found", (await call("ensurePolicyLink", { policyId: "nope" }, adminToken)).error?.status === "NOT_FOUND");
const created = await call("ensurePolicyLink", { policyId: "p1" }, adminToken);
const slug = created.result?.slug;
check("admin creates a link: company-name slug + 4 chars", /^acme-corp-[0-9a-z]{4}$/.test(slug || ""), JSON.stringify(created));
const again = await call("ensurePolicyLink", { policyId: "p1" }, hrToken);
check("HR of the same company gets the same link (idempotent)", again.result?.slug === slug, JSON.stringify(again));
const linkDoc = (await db.doc(`policyLinks/${slug}`).get()).data();
check("link doc is bound to the policy and company", linkDoc.policyId === "p1" && linkDoc.companyId === "c1" && linkDoc.active === true && linkDoc.requireRoster === false);

// ---- B. public: getPolicyForLink
const view = await call("getPolicyForLink", { slug });
check("link returns company name, language and live policy content", view.result?.companyName === "Acme Corp" && view.result.defaultLanguage === "fr" && view.result.policy.content.includes("Be honest") && view.result.policy.version === "1.0", JSON.stringify(view));
check("non-storage file URLs are never exposed", view.result?.policy.fileUrl === null);
check("response never carries companyId or policyId", !/"c1"|"p1"|companyId|policyId/.test(JSON.stringify(view.result)));
const e1 = await call("getPolicyForLink", { slug: "nope-nope-1234" });
const e2 = await call("getPolicyForLink", { slug: "../x" });
await call("setPolicyLinkActive", { slug, active: false }, adminToken);
const e3 = await call("getPolicyForLink", { slug });
check("unknown, malformed and paused links return identical errors", e1.error?.status === "NOT_FOUND" && JSON.stringify(e1) === JSON.stringify(e2) && JSON.stringify(e2) === JSON.stringify(e3), JSON.stringify([e1, e2, e3]));
check("a paused link refuses submissions", (await submit(slug)).error?.status === "NOT_FOUND");
check("another company's HR cannot pause or resume it", (await call("setPolicyLinkActive", { slug, active: true }, otherHrToken)).error?.status === "PERMISSION_DENIED");
await call("setPolicyLinkActive", { slug, active: true }, hrToken);
check("resuming restores it", (await call("getPolicyForLink", { slug })).result?.policy.title === "Code of Conduct");
await db.doc("policies/p1").update({ status: "archived" });
check("an unpublished policy is no longer served", (await call("getPolicyForLink", { slug })).error?.status === "NOT_FOUND");
await db.doc("policies/p1").update({ status: "published" });

// ---- C. acknowledgement + dedupe
const first = await submit(slug);
check("acknowledge succeeds", first.result?.status === "acknowledged", JSON.stringify(first));
const dup = await submit(slug, { employeeId: " emp- 0042 ", employeeName: "A. Lovelace" });
check("same employee (different case/spacing) is deduped, not an error", dup.result?.status === "already_acknowledged", JSON.stringify(dup));
let responses = (await db.collection("companies/c1/policyResponses").get()).docs.map((d) => d.data());
check("exactly one acknowledgement stored, keeping the first record", responses.length === 1 && responses[0].employeeName === "Ada Lovelace" && responses[0].policyVersion === "1.0" && responses[0].createdAt, JSON.stringify(responses));
const emp = (await db.doc("companies/c1/policyEmployees/emp-0042").get()).data();
check("distinct-employee roster doc created once", emp?.acknowledgementCount === 1 && emp.employeeId === "EMP-0042" && emp.firstAcknowledgedAt, JSON.stringify(emp));

const stale = await submit(slug, { policyVersion: "0.9" });
check("answering an out-of-date version is refused with a reason", stale.error?.status === "FAILED_PRECONDITION" && stale.error.details?.reason === "policy_updated", JSON.stringify(stale));
await db.doc("policies/p1").update({ version: "2.0" });
check("the old version is refused after the policy changes", (await submit(slug)).error?.details?.reason === "policy_updated");
const v2 = await submit(slug, { policyVersion: "2.0" });
check("a new version needs a fresh acknowledgement", v2.result?.status === "acknowledged", JSON.stringify(v2));
check("...but it is still one distinct employee", (await db.collection("companies/c1/policyEmployees").get()).size === 1 && (await db.doc("companies/c1/policyEmployees/emp-0042").get()).data().acknowledgementCount === 2);
await submit(slug, { policyVersion: "2.0", employeeId: "EMP-7", employeeName: "Grace Hopper" });
const countSnap = await db.collection("companies/c1/policyEmployees").count().get();
check("billing quantity = count() over policyEmployees = 2 distinct employees", countSnap.data().count === 2, String(countSnap.data().count));

// ---- D. validation / bot traps
const bad = async (extra) => (await submit(slug, { policyVersion: "2.0", ...extra })).error?.status;
check("empty id, short name, bad response, honeypot, instant submit are rejected",
  (await bad({ employeeId: "" })) === "INVALID_ARGUMENT" && (await bad({ employeeName: "A" })) === "INVALID_ARGUMENT" &&
  (await bad({ response: "maybe" })) === "INVALID_ARGUMENT" && (await bad({ website: "http://spam" })) === "INVALID_ARGUMENT" &&
  (await bad({ elapsedMs: 100 })) === "INVALID_ARGUMENT" && (await bad({ employeeId: "a/b" })) === "INVALID_ARGUMENT");
check("html is stripped from names", (await bad({ employeeId: "EMP-8", employeeName: "<script>x</script>Mallory" })) === undefined &&
  (await db.collection("companies/c1/policyResponses").where("employeeKey", "==", "emp-8").get()).docs[0].data().employeeName === "xMallory");

// ---- E. concerns
const concernBody = { response: "concern", policyVersion: "2.0", employeeId: "EMP-9", employeeName: "Alan Turing", concernText: "Clause 4 contradicts the handbook." };
check("a concern needs real text", (await submit(slug, { ...concernBody, concernText: "short" })).error?.status === "INVALID_ARGUMENT");
const token = rid(24);
const concern = await submit(slug, { ...concernBody, idempotencyToken: token });
check("a concern is accepted", concern.result?.status === "concern_received", JSON.stringify(concern));
const replay = await submit(slug, { ...concernBody, idempotencyToken: token });
check("replaying the same token does not file it twice", replay.error?.status === "ALREADY_EXISTS", JSON.stringify(replay));
const posts = (await db.collection("posts").where("source", "==", "policy_link").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
check("exactly one post in the HR queue", posts.length === 1, String(posts.length));
const post = posts[0];
check("post follows the report conventions and is not anonymous",
  post.companyId === "c1" && post.type === "problem_report" && post.privacyLevel === "hr_only" && post.involvesHR === false &&
  post.isAnonymous === false && post.authorId === null && post.authorName === "Alan Turing" && post.employeeId === "EMP-9" &&
  post.status === "open" && post.description === "Clause 4 contradicts the handbook." && post.policyId === "p1" && post.policyVersion === "2.0", JSON.stringify(post));
const concernResp = (await db.collection("companies/c1/policyResponses").where("response", "==", "concern").get()).docs.map((d) => d.data());
check("concern is linked to its post and does NOT join the billing roster", concernResp.length === 1 && concernResp[0].postId === post.id && !(await db.doc("companies/c1/policyEmployees/emp-9").get()).exists);
const notes = (await db.collection("notifications").where("type", "==", "policy_concern").get()).docs.map((d) => d.data().userId).sort();
check("admin and HR of that company are notified (nobody else)", JSON.stringify(notes) === JSON.stringify(["admin1", "hr1"]), JSON.stringify(notes));
check("activity log written", (await db.collection("postActivities").where("postId", "==", post.id).get()).size === 1);

let limited = null;
for (let i = 0; i < 6 && !limited; i++) {
  const r = await submit(slug, { ...concernBody, concernText: `Another concern number ${i} about clause 4.` });
  if (r.error) limited = { i, status: r.error.status };
}
check("per-employee concern limit (5/day) kicks in on the 5th more", limited?.status === "RESOURCE_EXHAUSTED" && limited.i === 4, JSON.stringify(limited));

// ---- F. roster
check("another company's HR cannot set the roster", (await call("setPolicyLinkRoster", { slug, rosterText: "X1, X" }, otherHrToken)).error?.status === "PERMISSION_DENIED");
const rosterText = "Employee ID, Name\nEMP-0042, Ada Lovelace\nEMP-7, Grace Hopper\nEMP-100, Linus T\nbad/id, Nope\nEMP-100, Duplicate";
const saved = await call("setPolicyLinkRoster", { slug, rosterText, requireRoster: true }, hrToken);
check("roster saved: header skipped, duplicate dropped, bad line reported", saved.result?.rosterCount === 3 && saved.result.requireRoster === true && JSON.stringify(saved.result.rejectedLines) === "[5]", JSON.stringify(saved));
const outsider = await submit(slug, { policyVersion: "2.0", employeeId: "EMP-555", employeeName: "Mallory" });
check("an ID outside the roster is refused (and nothing is stored)", outsider.error?.status === "FAILED_PRECONDITION" && outsider.error.details?.reason === "not_on_roster" && !(await db.doc("companies/c1/policyEmployees/emp-555").get()).exists, JSON.stringify(outsider));
check("roster member is accepted and flagged onRoster", (await submit(slug, { policyVersion: "2.0", employeeId: "emp-100", employeeName: "Linus Torvalds" })).result?.status === "acknowledged" && (await db.doc("companies/c1/policyEmployees/emp-100").get()).data().onRoster === true);
check("requiring an empty roster is silently turned off", (await call("setPolicyLinkRoster", { slug, rosterText: "", requireRoster: true }, adminToken)).result?.requireRoster === false);

// ---- G. privacy of server-only data + per-IP limit
const limits = await db.collection("rateLimits").get();
const dump = JSON.stringify(limits.docs.map((d) => [d.id, d.data()]));
check("rate limit docs hold no raw IP, employee id or name", !dump.includes("127.0.0.1") && !dump.includes("::1") && !/emp-?0042|lovelace|turing/i.test(dump));

let ipLimited = null;
for (let i = 0; i < 80 && !ipLimited; i++) {
  const r = await submit(slug, { policyVersion: "2.0", employeeId: `BULK-${i}`, employeeName: "Bulk Person" });
  if (r.error) ipLimited = { i, status: r.error.status };
}
check("per-IP limit (60/hour) eventually blocks bulk submissions", ipLimited?.status === "RESOURCE_EXHAUSTED", JSON.stringify(ipLimited));

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
