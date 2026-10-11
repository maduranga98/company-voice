/**
 * Routing against the Firestore emulator using the real service code (Admin SDK).
 *
 *   firebase emulators:exec --only firestore --project demo-routing "node functions/test/emulator/caseRouting.emulator.mjs"
 *   (run from the repo root, with the emulator on 127.0.0.1:8080 or FIRESTORE_EMULATOR_HOST set)
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { routeCase } = require("../../services/caseRouting");

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
admin.initializeApp({ projectId: "demo-routing" });
const db = admin.firestore();

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log(cond ? "ok  " : "FAIL", name, cond ? "" : extra); };
const rule = (id, order, conditions, action, extra = {}) =>
  db.doc(`companies/c1/routingRules/${id}`).set({ name: id, enabled: true, order, conditions, action, ...extra });
const user = (id, extra = {}) =>
  db.doc(`users/${id}`).set({ companyId: "c1", status: "active", role: "hr", displayName: id, ...extra });
const mk = async (col, id, data) => { await db.doc(`${col}/${id}`).set({ companyId: "c1", assignedTo: null, ...data }); return (await db.doc(`${col}/${id}`).get()).data(); };
const assignee = async (col, id) => (await db.doc(`${col}/${id}`).get()).data().assignedTo;

await user("alice"); await user("bob"); await user("carol", { role: "company_admin" });
await user("gone", { status: "inactive" }); await user("other", { companyId: "c2" });
await user("t1", { userTagId: "tagA" }); await user("t2", { userTagId: "tagA" }); await user("t3", { userTagId: "tagA", role: "hr" });
await db.doc("departments/legal").set({ companyId: "c1", name: "Legal" });

// no rules
let data = await mk("posts", "p0", { priority: "high" });
check("no rules -> not routed", (await routeCase(db, "post", "p0", data)).reason === "no-rules" && !(await assignee("posts", "p0")));

await rule("r1-critical-admin", 1, { priorities: ["critical"] }, { type: "user", id: "carol", name: "Carol" });
await rule("r2-safety-legal", 2, { categories: ["safety"], caseTypes: ["post"] }, { type: "department", id: "legal", name: "Legal" });
await rule("r3-vendor-bob", 3, { caseTypes: ["vendor"] }, { type: "user", id: "bob", name: "Bob" });
await rule("r4-tag", 4, { sources: ["public_link"] }, { type: "userTag", id: "tagA", name: "Tag A" });
await rule("r5-off", 0, {}, { type: "user", id: "alice" }, { enabled: false });

data = await mk("posts", "p1", { priority: "critical", category: "safety" });
let res = await routeCase(db, "post", "p1", data);
let a = await assignee("posts", "p1");
check("first matching rule wins (critical -> carol, not legal)", res.routed && a.id === "carol" && a.type === "user" && a.routedByRule === "r1-critical-admin", JSON.stringify(a));
check("disabled rule ignored", a.id !== "alice");
check("assignment shape valid (assignedBy string, dueDate untouched)", typeof a.assignedBy === "string" && a.assignedById === null && (await db.doc("posts/p1").get()).data().dueDate === undefined);
const acts = await db.collection("postActivities").where("postId", "==", "p1").get();
check("postActivities entry written (type assigned, adminName)", acts.size === 1 && acts.docs[0].data().type === "assigned" && /Routing rule/.test(acts.docs[0].data().metadata.adminName));
check("assignee notified", (await db.collection("notifications").where("userId", "==", "carol").get()).size === 1);

data = await mk("posts", "p2", { priority: "low", category: "safety" });
await routeCase(db, "post", "p2", data); a = await assignee("posts", "p2");
check("department rule assigns department, no notification", a.type === "department" && a.id === "legal" && (await db.collection("notifications").where("userId", "==", "legal").get()).size === 0);

data = await mk("vendorReports", "v1", { severity: "high", priority: "high" });
res = await routeCase(db, "vendor", "v1", data); a = await assignee("vendorReports", "v1");
check("vendor rule -> bob; caseActivities logged", res.routed && a.id === "bob" && (await db.collection("caseActivities").where("caseId", "==", "v1").get()).size === 1);

data = await mk("contentReports", "m1", { priority: "medium", reason: "spam" });
check("moderation with no matching rule stays unassigned", (await routeCase(db, "moderation", "m1", data)).reason === "no-match" && !(await assignee("contentReports", "m1")));

// round robin over tag members (t1, t2; t3 is hr)
const got = [];
for (const id of ["q1", "q2", "q3", "q4"]) { data = await mk("posts", id, { priority: "low", source: "public_link", involvesHR: false }); await routeCase(db, "post", id, data); got.push((await assignee("posts", id)).id); }
check("userTag rotates through tag members", got.join() === "t1,t2,t3,t1", got.join());
got.length = 0;
for (const id of ["h1", "h2", "h3"]) { data = await mk("posts", id, { priority: "low", source: "public_link", involvesHR: true }); await routeCase(db, "post", id, data); got.push((await assignee("posts", id))?.id); }
check("involvesHR cases never go to an hr-role user (tag has only hr -> unassigned)", got.every((x) => x === undefined), got.join());
await user("t4", { userTagId: "tagA", role: "company_admin" });
data = await mk("posts", "h4", { priority: "low", source: "public_link", involvesHR: true }); await routeCase(db, "post", "h4", data);
check("involvesHR case with an admin in the tag goes to the admin", (await assignee("posts", "h4"))?.id === "t4");

// unresolvable targets fall through to the next rule
await rule("r0-inactive-first", 0, { priorities: ["urgentx"] }, { type: "user", id: "gone" });
await rule("r0b-other-company", 0, { priorities: ["fallthru"] }, { type: "user", id: "other" });
await rule("r9-fallback", 9, { priorities: ["fallthru"] }, { type: "user", id: "alice" });
data = await mk("posts", "f1", { priority: "fallthru" });
await routeCase(db, "post", "f1", data);
check("target in another company is skipped, next matching rule used", (await assignee("posts", "f1"))?.id === "alice");
await rule("rx", 0, { priorities: ["inact"] }, { type: "user", id: "gone" });
data = await mk("posts", "f2", { priority: "inact" });
check("inactive user target -> no assignment", !(await routeCase(db, "post", "f2", data)).routed);

// manual assignment wins / idempotence
data = await mk("posts", "m2", { priority: "critical" });
await db.doc("posts/m2").update({ assignedTo: { type: "user", id: "bob", name: "bob" } });
check("already assigned (stale snapshot) -> left alone", (await routeCase(db, "post", "m2", data)).reason === "already-assigned" && (await assignee("posts", "m2")).id === "bob");
const again = await routeCase(db, "post", "p1", (await db.doc("posts/p1").get()).data());
check("re-delivery is a no-op", !again.routed && (await db.collection("postActivities").where("postId", "==", "p1").get()).size === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
