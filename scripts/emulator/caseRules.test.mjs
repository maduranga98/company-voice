// Firestore rules checks for the unified case-management data model (phases A/B).
// Run (needs firebase-tools, @firebase/rules-unit-testing, firebase installed somewhere):
//   firebase emulators:exec --only firestore --project demo-test "node scripts/emulator/caseRules.test.mjs"
// with the Firestore emulator on 127.0.0.1:8085. Writes use the exact payload shapes caseService.js sends.
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { setDoc, doc, updateDoc, addDoc, collection, getDocs, query, where, Timestamp, getDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8085 },
});
let pass = 0, fail = 0;
const t = async (name, p) => { try { await p; pass++; console.log("ok  ", name); } catch (e) { fail++; console.log("FAIL", name, "-", e.message.split("\n")[0]); } };

const hr = env.authenticatedContext("hr1", { role: "hr", companyId: "c1" }).firestore();
const hrOther = env.authenticatedContext("hr2", { role: "hr", companyId: "c2" }).firestore();
const anon = env.unauthenticatedContext().firestore();

await env.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, "vendorReports/v1"), { companyId: "c1", status: "open", severity: "high", title: "V" });
  await setDoc(doc(d, "vendorReports/vLegacy"), { companyId: "c1", status: "open", severity: "high" });
  await setDoc(doc(d, "contentReports/m1"), { companyId: "c1", status: "pending", priority: "medium", reportedBy: "u9" });
  await setDoc(doc(d, "posts/p1"), { companyId: "c1", privacyLevel: "hr_only", involvesHR: false, status: "open", assignedTo: null });
  await setDoc(doc(d, "posts/p2"), { companyId: "c1", privacyLevel: "hr_only", involvesHR: true, status: "open", assignedTo: { type: "user", id: "u1", name: "A" } });
  await setDoc(doc(d, "anonymousThreads/p1"), { companyId: "c1", lastInvestigatorActivity: null });
  await setDoc(doc(d, "moderationActivities/ma1"), { companyId: "c1", reportId: "m1", activityType: "report_reviewed", metadata: { moderatorName: "X" }, createdAt: Timestamp.now() });
});

// --- validCaseFields on vendorReports / contentReports, using exact payloads caseService writes
const stamp = { updatedAt: Timestamp.now(), lastUpdatedBy: "HR", lastUpdatedById: "hr1" };
const assignment = { type: "user", id: "u1", name: "Ann", assignedAt: Timestamp.now(), assignedBy: "HR", assignedById: "hr1" };
for (const col of ["vendorReports/v1", "contentReports/m1"]) {
  await t(`${col} priority update ok`, assertSucceeds(updateDoc(doc(hr, col), { priority: "high", ...stamp })));
  await t(`${col} invalid priority rejected`, assertFails(updateDoc(doc(hr, col), { priority: "urgent" })));
  await t(`${col} assign (service payload) ok`, assertSucceeds(updateDoc(doc(hr, col), { assignedTo: assignment, dueDate: Timestamp.now(), ...stamp })));
  await t(`${col} assign dept ok`, assertSucceeds(updateDoc(doc(hr, col), { assignedTo: { ...assignment, type: "department" } })));
  await t(`${col} bad assignee type rejected`, assertFails(updateDoc(doc(hr, col), { assignedTo: { ...assignment, type: "robot" } })));
  await t(`${col} assignee missing name rejected`, assertFails(updateDoc(doc(hr, col), { assignedTo: { type: "user", id: "u1" } })));
  await t(`${col} unassign null ok`, assertSucceeds(updateDoc(doc(hr, col), { assignedTo: null, dueDate: null, ...stamp })));
  await t(`${col} dueDate string rejected`, assertFails(updateDoc(doc(hr, col), { dueDate: "tomorrow" })));
  await t(`${col} other company cannot write`, assertFails(updateDoc(doc(hrOther, col), { priority: "low" })));
  await t(`${col} anon cannot write`, assertFails(updateDoc(doc(anon, col), { priority: "low" })));
}
// legacy vendor doc (no priority/assignedTo/dueDate) can be updated without them (e.g. status only)
await t("legacy vendor doc status update ok", assertSucceeds(updateDoc(doc(hr, "vendorReports/vLegacy"), { status: "investigating", ...stamp })));
// create new vendor report shape
await t("vendor create w/ priority+nulls ok", assertSucceeds(setDoc(doc(hr, "vendorReports/new1"), { companyId: "c1", priority: "high", severity: "high", assignedTo: null, dueDate: null, status: "open" })));

// --- caseActivities / caseNotes
const act = { caseType: "vendor", caseId: "v1", type: "status_changed", companyId: "c1", metadata: { adminName: "HR" }, createdAt: Timestamp.now() };
await t("caseActivities create ok", assertSucceeds(addDoc(collection(hr, "caseActivities"), act)));
await t("caseActivities create type=post rejected", assertFails(addDoc(collection(hr, "caseActivities"), { ...act, caseType: "post" })));
await t("caseActivities create other company rejected", assertFails(addDoc(collection(hrOther, "caseActivities"), act)));
await t("caseActivities anon rejected", assertFails(addDoc(collection(anon, "caseActivities"), act)));
const note = { caseType: "moderation", caseId: "m1", companyId: "c1", text: "n", authorId: "hr1", authorName: "HR", authorRole: "hr", createdAt: Timestamp.now() };
await t("caseNotes create ok", assertSucceeds(addDoc(collection(hr, "caseNotes"), note)));
await t("caseNotes spoofed author rejected", assertFails(addDoc(collection(hr, "caseNotes"), { ...note, authorId: "someoneElse" })));

// --- reads used by Phase B timeline + notes
await t("timeline: caseActivities query same company ok", assertSucceeds(getDocs(query(collection(hr, "caseActivities"), where("companyId", "==", "c1"), where("caseId", "==", "v1")))));
await t("timeline: caseActivities other company query rejected", assertFails(getDocs(query(collection(hrOther, "caseActivities"), where("companyId", "==", "c1"), where("caseId", "==", "v1")))));
await t("timeline: moderationActivities query ok", assertSucceeds(getDocs(query(collection(hr, "moderationActivities"), where("companyId", "==", "c1"), where("reportId", "==", "m1")))));
await t("notes: caseNotes query ok", assertSucceeds(getDocs(query(collection(hr, "caseNotes"), where("companyId", "==", "c1"), where("caseId", "==", "m1")))));
await t("caseActivities update rejected (append-only)", assertFails(updateDoc(doc(hr, "caseActivities/x"), { type: "y" })));

// --- phase C overview queries (exactly as caseOverviewService builds them)
const admin = env.authenticatedContext("ca1", { role: "company_admin", companyId: "c1" }).firestore();
const P = (db, ...f) => query(collection(db, "posts"), where("companyId", "==", "c1"), ...f);
const inv = where("privacyLevel", "==", "hr_only"), asg = where("assignedTo.type", "in", ["user", "department"]), noHR = where("involvesHR", "==", false);
await t("overview: HR inbox query (hr_only + involvesHR==false) ok", assertSucceeds(getDocs(P(hr, inv, noHR))));
await t("overview: HR assigned query (in + involvesHR==false) ok", assertSucceeds(getDocs(P(hr, asg, noHR))));
await t("overview: HR query WITHOUT involvesHR scope denied", assertFails(getDocs(P(hr, inv))));
await t("overview: company_admin unscoped query ok", assertSucceeds(getDocs(P(admin, inv))));
await t("overview: HR sees only non-involvesHR posts", (async () => { const r = await getDocs(P(hr, inv, noHR)); if (r.size !== 1 || r.docs[0].id !== "p1") throw new Error("got " + r.size); })());
await t("overview: vendorReports company query ok", assertSucceeds(getDocs(query(collection(hr, "vendorReports"), where("companyId", "==", "c1")))));
await t("overview: contentReports company query ok", assertSucceeds(getDocs(query(collection(hr, "contentReports"), where("companyId", "==", "c1")))));
await t("overview: anonymousThreads company query (HR) ok", assertSucceeds(getDocs(query(collection(hr, "anonymousThreads"), where("companyId", "==", "c1")))));
await t("overview: other company cannot read vendorReports", assertFails(getDocs(query(collection(hrOther, "vendorReports"), where("companyId", "==", "c1")))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
