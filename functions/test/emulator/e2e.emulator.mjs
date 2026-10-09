/**
 * End-to-end check of the public report callables against the Firebase emulators
 * (functions, firestore, storage, auth). Nothing is deployed.
 *
 * From a scratch dir that has `firebase` and `firebase-tools` installed:
 *   TURNSTILE_VERIFY_URL=http://127.0.0.1:9998 \
 *   npx firebase emulators:exec --only functions,firestore,storage,auth --project demo-voxwel \
 *     --config <repo>/firebase.json "node e2e.emulator.mjs"
 *
 * Needs functions/.secret.local with the four secrets (gitignored) and REPO_ROOT set.
 */

import crypto from "node:crypto";
import http from "node:http";
import { createRequire } from "node:module";
import { initializeApp } from "firebase/app";
import { getStorage, connectStorageEmulator, ref, uploadBytes } from "firebase/storage";

const root = process.env.REPO_ROOT || "/home/user/company-voice";
const require = createRequire(`${root}/functions/`);
const admin = require("firebase-admin");

const PROJECT = "demo-voxwel";
const BUCKET = `${PROJECT}.appspot.com`;
const FN = `http://127.0.0.1:5001/${PROJECT}/us-central1`;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

// Stand-in for Cloudflare: only the token "ok-token" passes.
const turnstile = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const ok = new URLSearchParams(body).get("response") === "ok-token";
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: ok }));
  });
});
await new Promise((r) => turnstile.listen(9998, "127.0.0.1", r));

admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = initializeApp({ projectId: PROJECT, storageBucket: BUCKET, apiKey: "x" });
const storage = getStorage(app);
connectStorageEmulator(storage, "127.0.0.1", 9199);

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

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
async function upload(uploadId, name, bytes, type) {
  const path = `public-reports/pending/${uploadId}/${name}`;
  await uploadBytes(ref(storage, path), bytes, { contentType: type });
  return path;
}

const rid = (n) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
const base = (extra = {}) => ({
  slug: "acme-corp-7k3m",
  type: "concern",
  category: "safety",
  description: "The loading dock has no guard rail and someone will fall off it.",
  involvesHR: false,
  idempotencyToken: rid(24),
  turnstileToken: "ok-token",
  clientLang: "en",
  ...extra,
});

// ---- seed
await db.doc("companies/c1").set({ name: "Acme Corp", reportSlug: "acme-corp-7k3m", reportingEnabled: true });
await db.doc("reportSlugs/acme-corp-7k3m").set({ companyId: "c1", active: true });
await db.doc("companies/c2").set({ name: "Off Inc", reportSlug: "off-inc-aaaa", reportingEnabled: false });
await db.doc("reportSlugs/off-inc-aaaa").set({ companyId: "c2", active: true });
await db.doc("companies/c3").set({ name: "Old Ltd", reportSlug: "old-ltd-bbbb2", reportingEnabled: true });
await db.doc("reportSlugs/old-ltd-bbbb2").set({ companyId: "c3", active: false });
await db.doc("companies/c4").set({ name: "Brand New" });
await db.doc("users/admin1").set({ companyId: "c1", role: "company_admin", status: "active" });
await db.doc("users/hr1").set({ companyId: "c1", role: "hr", status: "active" });
await db.doc("users/hr9").set({ companyId: "c9", role: "hr", status: "active" });

// ---- A. config
const cfg = await call("getPublicReportConfig", { slug: "acme-corp-7k3m" });
check("config returns company name, limits, categories", cfg.result?.companyName === "Acme Corp" && cfg.result.limits.maxFiles === 5 && cfg.result.categories.length > 0, JSON.stringify(cfg));
check("config never returns companyId", !JSON.stringify(cfg).includes("c1\"") && !("companyId" in (cfg.result || {})));
const bad = await call("getPublicReportConfig", { slug: "nope-nope-1234" });
const off = await call("getPublicReportConfig", { slug: "off-inc-aaaa" });
const inactive = await call("getPublicReportConfig", { slug: "old-ltd-bbbb2" });
const malformed = await call("getPublicReportConfig", { slug: "../x" });
check("bad slug, disabled company, inactive slug, malformed slug return identical errors",
  bad.error && JSON.stringify(bad.error) === JSON.stringify(off.error) && JSON.stringify(off.error) === JSON.stringify(inactive.error) && JSON.stringify(inactive.error) === JSON.stringify(malformed.error),
  JSON.stringify([bad, off, inactive, malformed]));
const badSubmit = await call("submitPublicReport", base({ slug: "off-inc-aaaa" }));
check("submit to a disabled company returns the same not-found error", JSON.stringify(badSubmit.error) === JSON.stringify(bad.error), JSON.stringify(badSubmit));

// ---- B. submit: rejections (these must not consume the 5/hour budget)
const ts = await call("submitPublicReport", base({ turnstileToken: "bad-token" }));
check("turnstile failure rejected", ts.error?.status === "FAILED_PRECONDITION", JSON.stringify(ts));
const short = await call("submitPublicReport", base({ description: "too short" }));
check("short description rejected", short.error?.status === "INVALID_ARGUMENT");

const fakeId = rid(20);
const fakePath = await upload(fakeId, "evil.png", new TextEncoder().encode("MZ this is not an image at all"), "image/png");
const spoof = await call("submitPublicReport", base({ uploadId: fakeId, attachments: [{ path: fakePath }] }));
check("file whose bytes don't match its declared type rejected", spoof.error?.status === "INVALID_ARGUMENT", JSON.stringify(spoof));
const missing = await call("submitPublicReport", base({ uploadId: fakeId, attachments: [{ path: `public-reports/pending/${fakeId}/ghost.png` }] }));
check("missing pending file rejected", missing.error?.status === "FAILED_PRECONDITION", JSON.stringify(missing));
const outside = await call("submitPublicReport", base({ uploadId: fakeId, attachments: [{ path: `public-reports/pending/${rid(20)}/a.png` }] }));
check("attachment outside the upload folder rejected", outside.error?.status === "INVALID_ARGUMENT");

// ---- B. submit: success path with evidence + contact
const uploadId = rid(20);
const png = await upload(uploadId, "photo.png", PNG, "image/png");
const okSubmit = await call("submitPublicReport", base({
  uploadId, attachments: [{ path: png }],
  contact: { name: "Pat Example", email: "pat@example.com", phone: "" },
}));
check("valid submit returns only caseCode + secretKey",
  okSubmit.result && Object.keys(okSubmit.result).sort().join() === "caseCode,secretKey" &&
  /^VW-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(okSubmit.result.caseCode) && /^([0-9A-Z]{4}-){3}[0-9A-Z]{4}$/.test(okSubmit.result.secretKey),
  JSON.stringify(okSubmit));
const { caseCode, secretKey } = okSubmit.result || {};

const access = await db.doc(`caseAccess/${caseCode}`).get();
const post = access.exists ? (await db.doc(`posts/${access.data().postId}`).get()) : null;
const p = post?.data() || {};
check("caseAccess has a hash, not the key", access.exists && /^[0-9a-f]{64}$/.test(access.data().keyHash) && access.data().failedAttempts === 0 && access.data().lockedUntil === null);
check("post matches the pipeline shape", p.companyId === "c1" && p.type === "problem_report" && p.isAnonymous === true && p.authorId === null && p.source === "public_link" && p.status === "open" && p.priority === "medium" && p.privacyLevel === "hr_only" && p.involvesHR === false && p.caseCode === caseCode, JSON.stringify(p));
check("contact stored encrypted only", typeof p.reporterContactEncrypted === "string" && !JSON.stringify(p).includes("pat@example.com"));
check("attachment metadata points at the case folder", p.attachments?.length === 1 && p.attachments[0].path.startsWith(`companies/c1/cases/${post.id}/`) && p.attachments[0].name === "evidence-1.png");
const [pendingExists] = await bucket.file(png).exists();
const [movedExists] = await bucket.file(p.attachments[0].path).exists();
check("pending original deleted and file moved", !pendingExists && movedExists);
const acts = await db.collection("postActivities").where("postId", "==", post.id).get();
check("CREATED activity by public_reporter", acts.size === 1 && acts.docs[0].data().actor === "public_reporter" && acts.docs[0].data().type === "created");
const notes = await db.collection("notifications").where("metadata.postId", "==", post.id).get();
check("admin and HR of the company notified (other company not)", notes.docs.map((d) => d.data().userId).sort().join() === "admin1,hr1");

// duplicate token
const dupToken = rid(24);
const first = await call("submitPublicReport", base({ idempotencyToken: dupToken, involvesHR: true }));
const dup = await call("submitPublicReport", base({ idempotencyToken: dupToken, involvesHR: true }));
check("involvesHR submit works", !!first.result);
check("same idempotency token cannot submit twice", dup.error?.status === "ALREADY_EXISTS", JSON.stringify(dup));
const hrPostId = (await db.doc(`caseAccess/${first.result.caseCode}`).get()).data().postId;
const hrNotes = await db.collection("notifications").where("metadata.postId", "==", hrPostId).get();
check("involvesHR case notifies company_admin only", hrNotes.docs.map((d) => d.data().userId).join() === "admin1");

// ---- rate limit: 2 successes so far from this IP; 3 more, then the 6th is blocked
const more = [];
for (let i = 0; i < 4; i++) more.push(await call("submitPublicReport", base()));
check("3rd-5th submissions allowed", more.slice(0, 3).every((r) => r.result), JSON.stringify(more));
check("6th submission from the same hashed IP is rate limited", more[3].error?.status === "RESOURCE_EXHAUSTED", JSON.stringify(more[3]));

// ---- privacy: nothing stored contains the IP, the raw key, or the report text beyond the post
const limits = await db.collection("rateLimits").get();
check("rateLimits docs are keyed by hashes with expiresAt", limits.size >= 3 && limits.docs.every((d) => /^[0-9a-f]{64}$/.test(d.id) && d.data().expiresAt));
const dump = JSON.stringify([
  ...(await db.collection("caseAccess").get()).docs.map((d) => d.data()),
  ...limits.docs.map((d) => [d.id, d.data()]),
  ...(await db.collection("postActivities").get()).docs.map((d) => d.data()),
]);
check("no raw IP or secret key in server-only collections", !dump.includes("127.0.0.1") && !dump.includes("::1") && !dump.includes(secretKey) && !dump.includes(secretKey.replace(/-/g, "")));

// ---- C. ensureReportSlug / setReportingEnabled (authenticated)
// Staff sign in through the login callable (claims-based identity).
const sha = (p) => crypto.createHash("sha256").update(p, "utf8").digest("hex");
async function signIn(username, password) {
  const login = await call("login", { username, password });
  const session = await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: login.result.customToken, returnSecureToken: true }) })).json();
  return { token: session.idToken };
}
await db.doc("users/admin1").update({ username: "admin1", password: sha("AdminPass123!") });
await db.doc("users/hr1").update({ username: "hr1", password: sha("HrPass12345!") });
await db.doc("companies/c1").update({ isActive: true });
const adminAuth = await signIn("admin1", "AdminPass123!");
const hrAuth = await signIn("hr1", "HrPass12345!");

check("ensureReportSlug needs sign-in", (await call("ensureReportSlug", { companyId: "c1" })).error?.status === "UNAUTHENTICATED");
check("HR cannot rotate", (await call("ensureReportSlug", { companyId: "c1", rotate: true }, hrAuth.token)).error?.status === "PERMISSION_DENIED");
check("company_admin cannot touch another company", (await call("ensureReportSlug", { companyId: "c4" }, adminAuth.token)).error?.status === "PERMISSION_DENIED");
const same = await call("ensureReportSlug", { companyId: "c1" }, adminAuth.token);
check("existing slug returned unchanged", same.result?.slug === "acme-corp-7k3m", JSON.stringify(same));
const rotated = await call("ensureReportSlug", { companyId: "c1", rotate: true }, adminAuth.token);
check("rotate issues a new slug", rotated.result?.slug && rotated.result.slug !== "acme-corp-7k3m" && /^acme-corp-[0-9a-z]{4}$/.test(rotated.result.slug), JSON.stringify(rotated));
check("old slug deactivated, new one active, company updated",
  (await db.doc("reportSlugs/acme-corp-7k3m").get()).data().active === false &&
  (await db.doc(`reportSlugs/${rotated.result.slug}`).get()).data().active === true &&
  (await db.doc("companies/c1").get()).data().reportSlug === rotated.result.slug);
check("old link now not found", (await call("getPublicReportConfig", { slug: "acme-corp-7k3m" })).error?.status === "NOT_FOUND");
check("new link works", !!(await call("getPublicReportConfig", { slug: rotated.result.slug })).result);
const toggled = await call("setReportingEnabled", { companyId: "c1", enabled: false }, adminAuth.token);
check("disable reporting", toggled.result?.enabled === false && (await call("getPublicReportConfig", { slug: rotated.result.slug })).error?.status === "NOT_FOUND");

turnstile.close();
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
