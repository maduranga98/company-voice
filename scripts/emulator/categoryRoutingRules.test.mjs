// Firestore rules checks for companies/{id}/categories, companies/{id}/routingRules and the
// company routing fields. Run (firebase-tools, @firebase/rules-unit-testing, firebase installed):
//   firebase emulators:exec --only firestore --project demo-test "node scripts/emulator/categoryRoutingRules.test.mjs"
// with the Firestore emulator on 127.0.0.1:8085.
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { setDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, collection } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8085 },
});
let pass = 0, fail = 0;
const t = async (name, p) => { try { await p; pass++; console.log("ok  ", name); } catch (e) { fail++; console.log("FAIL", name, "-", e.message.split("\n")[0]); } };

const admin = env.authenticatedContext("a1", { role: "company_admin", companyId: "c1" }).firestore();
const hr = env.authenticatedContext("h1", { role: "hr", companyId: "c1" }).firestore();
const hrOther = env.authenticatedContext("h2", { role: "hr", companyId: "c2" }).firestore();
const adminOther = env.authenticatedContext("a2", { role: "company_admin", companyId: "c2" }).firestore();
const superAdmin = env.authenticatedContext("s1", { role: "super_admin" }).firestore();
// A Firebase user with no staff role (e.g. anonymous auth): must never read category data.
const roleless = env.authenticatedContext("e1", { companyId: "c1" }).firestore();
const anon = env.unauthenticatedContext().firestore();

await env.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, "companies/c1"), { name: "Acme", defaultRoutingAssigneeType: "role", defaultRoutingAssigneeId: "hr", tagline: "x" });
  await setDoc(doc(d, "companies/c1/categories/safety"), { name: "Safety", isActive: true, isSystemDefined: false });
  await setDoc(doc(d, "companies/c1/categories/vendor_risk"), { name: "Vendor Risk", isActive: true, isSystemDefined: true });
  await setDoc(doc(d, "companies/c1/routingRules/safety"), { categoryId: "safety", assigneeType: "user", assigneeId: "u1", isActive: true });
});

for (const col of ["categories/safety", "routingRules/safety"]) {
  const path = (c) => `companies/c1/${col}`;
  await t(`${col}: admin of company reads`, assertSucceeds(getDoc(doc(admin, path()))));
  await t(`${col}: hr of company reads`, assertSucceeds(getDoc(doc(hr, path()))));
  await t(`${col}: super_admin reads any company`, assertSucceeds(getDoc(doc(superAdmin, path()))));
  await t(`${col}: other company's admin cannot read`, assertFails(getDoc(doc(adminOther, path()))));
  await t(`${col}: other company's hr cannot read`, assertFails(getDoc(doc(hrOther, path()))));
  await t(`${col}: role-less signed-in user cannot read`, assertFails(getDoc(doc(roleless, path()))));
  await t(`${col}: anonymous cannot read`, assertFails(getDoc(doc(anon, path()))));
  // Writes are callable-only, for every role including the company's own admin and hr.
  for (const [who, db] of [["admin", admin], ["hr", hr], ["super_admin", superAdmin], ["other admin", adminOther], ["anon", anon]]) {
    await t(`${col}: ${who} cannot update`, assertFails(updateDoc(doc(db, path()), { name: "Hacked", assigneeId: "evil" })));
    await t(`${col}: ${who} cannot delete`, assertFails(deleteDoc(doc(db, path()))));
    await t(`${col}: ${who} cannot create`, assertFails(setDoc(doc(db, path().replace("safety", "new1")), { name: "New", isActive: true })));
  }
}

await t("categories: list query by hr of company ok", assertSucceeds(getDocs(collection(hr, "companies/c1/categories"))));
await t("routingRules: list query by role-less user denied", assertFails(getDocs(collection(roleless, "companies/c1/routingRules"))));
await t("categories: list query by other company denied", assertFails(getDocs(collection(hrOther, "companies/c1/categories"))));

// The default assignee and seeding marker are server-managed.
for (const field of ["defaultRoutingAssigneeId", "defaultRoutingAssigneeType", "defaultRoutingUpdatedAt", "defaultRoutingUpdatedBy", "categoriesSeededAt"]) {
  await t(`company.${field}: admin cannot write directly`, assertFails(updateDoc(doc(admin, "companies/c1"), { [field]: "x" })));
}
await t("company: admin can still edit other fields", assertSucceeds(updateDoc(doc(admin, "companies/c1"), { tagline: "ok" })));
await t("company: hr cannot update", assertFails(updateDoc(doc(hr, "companies/c1"), { tagline: "no" })));
await t("company: members can read the default assignee", assertSucceeds(getDoc(doc(hr, "companies/c1"))));

await env.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
