/**
 * End-to-end check of category management, routing rules, submission-time routing and the
 * migration against the Firebase emulators (functions, firestore, auth). Nothing is deployed.
 *
 * From a scratch dir that has `firebase`, `firebase-tools` installed:
 *   npx firebase emulators:exec --only functions,firestore,storage,auth --project demo-voxwel \
 *     --config <repo>/firebase.json "node categoryRouting.emulator.mjs"
 *
 * Needs functions/.secret.local with ANONYMOUS_SECRET, CASE_KEY_PEPPER, IP_HASH_SALT (gitignored)
 * and REPO_ROOT set.
 */

import { createRequire } from "node:module";

const root = process.env.REPO_ROOT || "/home/user/company-voice";
const require = createRequire(`${root}/functions/`);
const admin = require("firebase-admin");

const PROJECT = "demo-voxwel";
const FN = `http://127.0.0.1:5001/${PROJECT}/us-central1`;
const AUTH = "http://127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`);
};

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

async function tokenFor(uid, claims) {
  const custom = await admin.auth().createCustomToken(uid, claims);
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=x`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}

const clearLimits = async () => {
  const snap = await db.collection("rateLimits").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
};
const rid = (n) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
const report = (extra = {}) => ({
  slug: "acme-corp-7k3m",
  type: "concern",
  category: "safety",
  description: "The loading dock has no guard rail and someone will fall off it.",
  involvesHR: false,
  idempotencyToken: rid(24),
  website: "",
  elapsedMs: 30000,
  clientLang: "en",
  ...extra,
});
const submit = async (extra) => {
  await clearLimits();
  const res = await call("submitPublicReport", report(extra));
  if (!res.result) return { res, post: null };
  const access = await db.doc(`caseAccess/${res.result.caseCode}`).get();
  const collection = access.data().caseType === "vendor" ? "vendorReports" : "posts";
  const post = (await db.doc(`${collection}/${access.data().postId}`).get()).data();
  const notes = await db.collection("notifications").where("metadata.postId", "==", access.data().postId).get();
  return { res, post, notified: notes.docs.map((d) => d.data().userId).sort() };
};
const cats = async () => Object.fromEntries((await db.collection("companies/c1/categories").get()).docs.map((d) => [d.id, d.data()]));
const code = (r) => r.error?.status;

// ---- seed (c1 is deliberately NOT migrated: it is seeded lazily on first use)
await db.doc("companies/c1").set({ name: "Acme Corp", reportSlug: "acme-corp-7k3m", reportingEnabled: true });
await db.doc("reportSlugs/acme-corp-7k3m").set({ companyId: "c1", active: true });
await db.doc("companies/c2").set({ name: "Other Co" });
const staff = {
  admin1: { companyId: "c1", role: "company_admin", status: "active", displayName: "Ada Admin" },
  hr1: { companyId: "c1", role: "hr", status: "active", displayName: "Hal HR" },
  hr2: { companyId: "c1", role: "hr", status: "active", displayName: "Hana HR" },
  hrOff: { companyId: "c1", role: "hr", status: "suspended", displayName: "Sam Suspended" },
  other1: { companyId: "c2", role: "hr", status: "active", displayName: "Olly Other" },
  root: { companyId: null, role: "super_admin", status: "active", displayName: "Root" },
};
for (const [id, data] of Object.entries(staff)) await db.doc(`users/${id}`).set(data);
const tok = {};
for (const [id, data] of Object.entries(staff)) tok[id] = await tokenFor(id, { role: data.role, companyId: data.companyId });

// ---- lazy seeding + public config
const cfg = await call("getPublicReportConfig", { slug: "acme-corp-7k3m" });
const names = (cfg.result?.categories || []).map((c) => c.name);
check("config seeds a never-migrated company and lists its categories", names.length === 8 && names.includes("Health and safety"), JSON.stringify(cfg));
check("config categories are { id, name, i18nKey } and exclude Vendor Risk", cfg.result.categories.every((c) => c.id && c.name && "i18nKey" in c) && !cfg.result.categories.some((c) => c.id === "vendor_risk"));
let c1 = (await db.doc("companies/c1").get()).data();
check("seeding set the default assignee to the HR role and the marker", c1.defaultRoutingAssigneeType === "role" && c1.defaultRoutingAssigneeId === "hr" && !!c1.categoriesSeededAt, JSON.stringify(c1));
check("Vendor Risk is stored as a locked system category", (await cats()).vendor_risk?.isSystemDefined === true);
check("config exposes no routing data", !JSON.stringify(cfg).match(/assignee|routing|hr1|admin1/i));

// ---- category CRUD: auth + validation
check("unauthenticated createCategory rejected", code(await call("createCategory", { name: "X" })) === "UNAUTHENTICATED");
check("hr can create a category", !!(await call("createCategory", { name: "  Remote   work " }, tok.hr1)).result?.id);
const remote = Object.entries(await cats()).find(([, c]) => c.name === "Remote work");
check("name is trimmed and whitespace-collapsed, new category is active and unlocked", remote && remote[1].isActive === true && remote[1].isSystemDefined === false);
check("duplicate name (case-insensitive) rejected", code(await call("createCategory", { name: "REMOTE WORK" }, tok.admin1)) === "ALREADY_EXISTS");
check("duplicate of a seeded name rejected", code(await call("createCategory", { name: "health and safety" }, tok.admin1)) === "ALREADY_EXISTS");
check("duplicate of Vendor Risk rejected", code(await call("createCategory", { name: "vendor risk" }, tok.admin1)) === "ALREADY_EXISTS");
check("empty name rejected", code(await call("createCategory", { name: "   " }, tok.admin1)) === "INVALID_ARGUMENT");
check("61-char name rejected, 60 accepted", code(await call("createCategory", { name: "a".repeat(61) }, tok.admin1)) === "INVALID_ARGUMENT" && !!(await call("createCategory", { name: "b".repeat(60) }, tok.admin1)).result);
const spoof = await call("createCategory", { name: "Spoof", companyId: "c1" }, tok.other1);
check("companyId in the body is ignored: the category lands in the caller's own company", !!spoof.result
  && (await db.collection("companies/c1/categories").where("name", "==", "Spoof").get()).empty
  && (await db.collection("companies/c2/categories").where("name", "==", "Spoof").get()).size === 1, JSON.stringify(spoof));
check("the other company was seeded with its own categories", (await db.collection("companies/c2/categories").get()).size >= 10);
const sa = await call("createCategory", { name: "Super" }, tok.root);
check("super_admin cannot write categories", code(sa) === "PERMISSION_DENIED", JSON.stringify(sa));

// ---- rename / deactivate / system lock / last-active guard
const remoteId = remote[0];
check("rename updates the name and drops the translation key", !!(await call("updateCategory", { categoryId: remoteId, name: "Hybrid work" }, tok.admin1)).result && (await cats())[remoteId].name === "Hybrid work");
await call("updateCategory", { categoryId: "safety", name: "Site safety" }, tok.admin1);
check("renaming a seeded category clears its i18nKey", (await cats()).safety.name === "Site safety" && (await cats()).safety.i18nKey === null);
check("rename to an existing name rejected", code(await call("updateCategory", { categoryId: remoteId, name: "site SAFETY" }, tok.admin1)) === "ALREADY_EXISTS");
check("Vendor Risk cannot be renamed", code(await call("updateCategory", { categoryId: "vendor_risk", name: "Nope" }, tok.admin1)) === "PERMISSION_DENIED");
check("Vendor Risk cannot be deactivated", code(await call("updateCategory", { categoryId: "vendor_risk", isActive: false }, tok.admin1)) === "PERMISSION_DENIED");
check("unknown category -> not found", code(await call("updateCategory", { categoryId: "nope", name: "Z" }, tok.admin1)) === "NOT_FOUND");
check("empty update rejected", code(await call("updateCategory", { categoryId: remoteId }, tok.admin1)) === "INVALID_ARGUMENT");

check("deactivate hides a category from the public form but keeps the document", !!(await call("updateCategory", { categoryId: remoteId, isActive: false }, tok.hr1)).result
  && !(await call("getPublicReportConfig", { slug: "acme-corp-7k3m" })).result.categories.some((c) => c.id === remoteId)
  && (await cats())[remoteId].isActive === false);
const inactiveSubmit = await submit({ category: remoteId });
check("submitting to a deactivated category is rejected", code(inactiveSubmit.res) === "INVALID_ARGUMENT");
check("submitting to Vendor Risk as a concern is rejected", code((await submit({ category: "vendor_risk" })).res) === "INVALID_ARGUMENT");
check("submitting to another company's category id is rejected", code((await submit({ category: "doesnotexist1" })).res) === "INVALID_ARGUMENT");
check("reactivate works", !!(await call("updateCategory", { categoryId: remoteId, isActive: true }, tok.hr1)).result);

// ---- reorder
const editable = Object.entries(await cats()).filter(([, c]) => !c.isSystemDefined).sort((a, b) => a[1].order - b[1].order).map(([id]) => id);
const reversed = [...editable].reverse();
check("reorder applies the new order", !!(await call("reorderCategories", { orderedIds: reversed }, tok.admin1)).result
  && (await call("getPublicReportConfig", { slug: "acme-corp-7k3m" })).result.categories.map((c) => c.id).join() === reversed.join());
check("reorder with a missing id is rejected as stale", code(await call("reorderCategories", { orderedIds: reversed.slice(1) }, tok.admin1)) === "FAILED_PRECONDITION");
check("reorder including Vendor Risk is rejected", code(await call("reorderCategories", { orderedIds: [...reversed, "vendor_risk"] }, tok.admin1)) === "FAILED_PRECONDITION");
check("reorder with duplicates rejected", code(await call("reorderCategories", { orderedIds: [reversed[0], reversed[0]] }, tok.admin1)) === "INVALID_ARGUMENT");

// ---- routing rule validation (server-side, not just the UI)
const rule = (categoryId, assigneeType, assigneeId, who = "admin1") => call("setCategoryRoutingRule", { categoryId, assigneeType, assigneeId }, tok[who]);
check("rule to a user of another company rejected", code(await rule("safety", "user", "other1")) === "FAILED_PRECONDITION");
check("rule to a suspended user rejected", code(await rule("safety", "user", "hrOff")) === "FAILED_PRECONDITION");
check("rule to a missing user rejected", code(await rule("safety", "user", "ghost")) === "FAILED_PRECONDITION");
check("rule with a bad role rejected", code(await rule("safety", "role", "super_admin")) === "INVALID_ARGUMENT");
check("rule with a bad assignee type rejected", code(await rule("safety", "team", "hr")) === "INVALID_ARGUMENT");
check("rule for an unknown category rejected", code(await rule("ghost", "user", "hr1")) === "NOT_FOUND");
check("unauthenticated rule write rejected", code(await call("setCategoryRoutingRule", { categoryId: "safety", assigneeType: "user", assigneeId: "hr1" })) === "UNAUTHENTICATED");
check("super_admin rule write rejected", code(await rule("safety", "user", "hr1", "root")) === "PERMISSION_DENIED");
check("hr can route a category to a specific person", !!(await rule("safety", "user", "admin1", "hr1")).result);
const stored = (await db.doc("companies/c1/routingRules/safety").get()).data();
check("rule stored with the shape the model describes", stored.categoryId === "safety" && stored.assigneeType === "user" && stored.assigneeId === "admin1" && stored.isActive === true && stored.createdBy === "hr1" && !!stored.createdAt && !!stored.updatedAt, JSON.stringify(stored));

// ---- default assignee
check("default assignee to another company's user rejected", code(await call("setDefaultRoutingAssignee", { assigneeType: "user", assigneeId: "other1" }, tok.admin1)) === "FAILED_PRECONDITION");
check("default assignee to a suspended user rejected", code(await call("setDefaultRoutingAssignee", { assigneeType: "user", assigneeId: "hrOff" }, tok.admin1)) === "FAILED_PRECONDITION");
check("the default assignee is required: an empty value is rejected", code(await call("setDefaultRoutingAssignee", {}, tok.admin1)) === "INVALID_ARGUMENT");

// ---- submission-time routing
let s = await submit({ category: "safety" });
check("rule routes the case to its user and notifies only them", s.post?.assignedTo?.id === "admin1" && s.post.assignedTo.assignedBy === "Routing rule" && s.notified.join() === "admin1", JSON.stringify([s.post?.assignedTo, s.notified]));
check("the post records the category id and name", s.post.category === "safety" && s.post.categoryName === "Site safety");
check("a client-supplied assignee is ignored", (await submit({ category: "safety", assignedTo: { id: "hr1" }, assigneeId: "hr1", assignedToId: "hr1" })).post.assignedTo.id === "admin1");

s = await submit({ category: "pay_benefits" });
check("no rule -> company default (role hr): HR notified, case not owned, HR inbox", s.post.assignedTo === undefined && s.post.routedToRole === "hr" && s.post.hrInbox === true && s.notified.join() === "hr1,hr2", JSON.stringify([s.post, s.notified]));

await rule("management", "role", "company_admin");
s = await submit({ category: "management" });
check("role rule routes to every active member of the role, not into the HR inbox", s.post.routedToRole === "company_admin" && s.post.hrInbox === false && s.notified.join() === "admin1", JSON.stringify([s.post, s.notified]));

await rule("harassment", "user", "hr1");
await db.doc("users/hr1").update({ status: "suspended" });
s = await submit({ category: "harassment" });
check("rule whose assignee was suspended falls back to the default (remaining active HR)", s.post.routedToRole === "hr" && s.notified.join() === "hr2", JSON.stringify([s.post.routedToRole, s.notified]));
await db.doc("users/hr1").update({ status: "active" });

await rule("fraud_ethics", "user", "hr1");
s = await submit({ category: "fraud_ethics", involvesHR: true });
check("a case involving HR is never routed to HR, even by an explicit rule", s.post.assignedTo?.id === "admin1" && !s.notified.includes("hr1") && !s.notified.includes("hr2"), JSON.stringify([s.post.assignedTo, s.notified]));
s = await submit({ category: "pay_benefits", involvesHR: true });
check("involving-HR case with an HR default goes to the company admin", s.post.assignedTo?.id === "admin1" && s.notified.join() === "admin1", JSON.stringify([s.post.assignedTo, s.notified]));

await db.doc("users/hr1").update({ status: "suspended" });
await db.doc("users/hr2").update({ status: "suspended" });
s = await submit({ category: "discrimination" });
check("no active HR at all -> the company admin is the last resort", s.post.assignedTo?.id === "admin1" && s.notified.join() === "admin1", JSON.stringify([s.post.assignedTo, s.notified]));
await db.doc("users/hr1").update({ status: "active" });
await db.doc("users/hr2").update({ status: "active" });

// vendor reports route through the locked Vendor Risk category
const vendor = (extra = {}) => ({ type: "vendor", category: "fraud", vendorName: "Globex", severity: "high", ...extra });
s = await submit(vendor());
check("vendor report with no Vendor Risk rule uses the default", s.post?.status === "open" && s.post.routedToRole === "hr" && s.notified.join() === "hr1,hr2", JSON.stringify([s.res, s.post?.routedToRole, s.notified]));
await rule("vendor_risk", "user", "admin1");
s = await submit(vendor());
check("Vendor Risk can be routed like any category and is assigned", s.post.assignedTo?.id === "admin1" && s.post.assignedToId === "admin1" && s.notified.join() === "admin1", JSON.stringify([s.post.assignedTo, s.notified]));
check("rule removal reverts the category to the default", !!(await call("removeCategoryRoutingRule", { categoryId: "vendor_risk" }, tok.admin1)).result && !(await db.doc("companies/c1/routingRules/vendor_risk").get()).exists);

// the existing condition-based rules still take precedence over category routing
await db.collection("routingRules").add({ companyId: "c1", enabled: true, name: "Pay to Ada", appliesTo: ["post"], order: 0, conditions: { categories: ["pay_benefits"] }, action: { type: "user", id: "admin1", name: "Ada Admin" } });
s = await submit({ category: "pay_benefits" });
check("an admin's condition-based rule wins over the category rule/default", s.post.assignedTo?.id === "admin1" && s.post.assignedTo.assignedBy === "Routing rule", JSON.stringify(s.post.assignedTo));

// ---- deactivating the last active category is blocked
const everything = Object.entries(await cats()).filter(([, c]) => !c.isSystemDefined && c.isActive).map(([id]) => id);
let lastBlocked = null;
for (const id of everything) {
  const r = await call("updateCategory", { categoryId: id, isActive: false }, tok.admin1);
  if (r.error) lastBlocked = r;
}
check("the last active category cannot be deactivated", code(lastBlocked) === "FAILED_PRECONDITION" && (await call("getPublicReportConfig", { slug: "acme-corp-7k3m" })).result.categories.length === 1, JSON.stringify(lastBlocked));

// ---- migration
await db.doc("companies/c3").set({ name: "Legacy Ltd" });
await db.doc("users/legacyAdmin").set({ companyId: "c3", role: "company_admin", status: "active" });
check("migration is super_admin only", code(await call("migrateCategoryRouting", {}, tok.admin1)) === "PERMISSION_DENIED" && code(await call("migrateCategoryRouting", {})) === "UNAUTHENTICATED");
const dry = await call("migrateCategoryRouting", { companyId: "c3" }, tok.root);
check("migration dry run reports but writes nothing", dry.result?.dryRun === true && dry.result.results[0].categoriesSeeded === 9 && (await db.collection("companies/c3/categories").get()).empty, JSON.stringify(dry));
const applied = await call("migrateCategoryRouting", { companyId: "c3", dryRun: false }, tok.root);
const c3 = (await db.doc("companies/c3").get()).data();
check("migration seeds categories and defaults to the company admin when there is no HR", applied.result?.failed === 0 && (await db.collection("companies/c3/categories").get()).size === 9 && c3.defaultRoutingAssigneeType === "user" && c3.defaultRoutingAssigneeId === "legacyAdmin", JSON.stringify([applied, c3]));
const again = await call("migrateCategoryRouting", { companyId: "c3", dryRun: false }, tok.root);
check("migration is idempotent", again.result?.results[0].categoriesSeeded === 0 && (await db.collection("companies/c3/categories").get()).size === 9);
const all = await call("migrateCategoryRouting", { dryRun: false }, tok.root);
check("migration over all companies completes without failures", all.result?.failed === 0 && all.result.companies === 3, JSON.stringify(all));

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
