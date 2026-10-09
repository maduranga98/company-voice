/**
 * Security-rules checks for the public-report work (run against the emulators; nothing is deployed).
 *
 *   mkdir /tmp/rules-check && cd /tmp/rules-check && npm i firebase-tools @firebase/rules-unit-testing firebase
 *   cp <repo>/functions/test/emulator/rules.emulator.mjs .
 *   npx firebase emulators:exec --only firestore,storage --project demo-voxwel "node rules.emulator.mjs"
 *
 * Known emulator gap: "anon cannot overwrite pending" reports FAIL because the Storage
 * emulator does not treat a re-upload as an update. Confirm against the real bucket.
 * Rule file paths below assume the repo is checked out at /home/user/company-voice.
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc, getDocs, setDoc, collection, query, where, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";

const env = await initializeTestEnvironment({
  projectId: "demo-voxwel",
  firestore: { rules: readFileSync("/home/user/company-voice/firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  storage: { rules: readFileSync("/home/user/company-voice/storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const [uid, role, userId] of [["uHR","hr","hr1"],["uAdmin","company_admin","adm1"],["uEmp","employee","emp1"],["uOther","hr","hr2"]]) {
    await setDoc(doc(db, "authSessions", uid), { role, userId, companyId: uid==="uOther" ? "c2" : "c1" });
  }
  await setDoc(doc(db, "posts", "pPublicHR"), { companyId: "c1", involvesHR: true, privacyLevel: "hr_only" });
  await setDoc(doc(db, "posts", "pPublicOK"), { companyId: "c1", involvesHR: false, privacyLevel: "hr_only" });
  await setDoc(doc(db, "posts", "pLegacy"), { companyId: "c1", privacyLevel: "hr_only" });
  await setDoc(doc(db, "caseAccess", "VW-AAAA-BBBB"), { postId: "x", keyHash: "h" });
  await setDoc(doc(db, "reportSlugs", "acme-1234"), { companyId: "c1" });
  await setDoc(doc(db, "rateLimits", "h"), { count: 1 });
});
const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = env.unauthenticatedContext().firestore();
let fails = 0;
const check = async (name, p) => { try { await p; console.log("PASS", name); } catch (e) { fails++; console.log("FAIL", name, e.message.slice(0,120)); } };

await check("hr cannot read involvesHR post", assertFails(getDoc(doc(as("uHR"), "posts", "pPublicHR"))));
await check("company_admin reads involvesHR post", assertSucceeds(getDoc(doc(as("uAdmin"), "posts", "pPublicHR"))));
await check("hr reads normal post", assertSucceeds(getDoc(doc(as("uHR"), "posts", "pPublicOK"))));
await check("hr cannot read legacy post (no field) until backfilled", assertFails(getDoc(doc(as("uHR"), "posts", "pLegacy"))));
await check("hr unfiltered company query is rejected", assertFails(getDocs(query(collection(as("uHR"), "posts"), where("companyId","==","c1")))));
await check("hr query with involvesHR==false succeeds", assertSucceeds(getDocs(query(collection(as("uHR"), "posts"), where("companyId","==","c1"), where("privacyLevel","==","hr_only"), where("involvesHR","==",false)))));
await check("admin unfiltered company query succeeds", assertSucceeds(getDocs(query(collection(as("uAdmin"), "posts"), where("companyId","==","c1")))));
await check("employee cannot read posts", assertFails(getDoc(doc(as("uEmp"), "posts", "pPublicOK"))));
await check("other-company hr cannot read", assertFails(getDoc(doc(as("uOther"), "posts", "pPublicOK"))));
await check("hr cannot update involvesHR post", assertFails(updateDoc(doc(as("uHR"), "posts", "pPublicHR"), { status: "closed" })));
await check("admin can update involvesHR post", assertSucceeds(updateDoc(doc(as("uAdmin"), "posts", "pPublicHR"), { status: "closed" })));
await check("hr can update normal post", assertSucceeds(updateDoc(doc(as("uHR"), "posts", "pPublicOK"), { status: "closed" })));
for (const c of ["caseAccess/VW-AAAA-BBBB","reportSlugs/acme-1234","rateLimits/h","posts/pPublicOK"]) {
  const [col,id]=c.split("/");
  await check(`unauthenticated cannot read ${c}`, assertFails(getDoc(doc(anon, col, id))));
}
for (const u of ["uAdmin","uHR"]) for (const c of ["caseAccess/VW-AAAA-BBBB","reportSlugs/acme-1234","rateLimits/h"]) {
  const [col,id]=c.split("/");
  await check(`${u} cannot read ${c}`, assertFails(getDoc(doc(as(u), col, id))));
  await check(`${u} cannot write ${c}`, assertFails(setDoc(doc(as(u), col, id), { a: 1 })));
}
await check("company_admin cannot set reportSlug", assertFails(updateDoc(doc(as("uAdmin"), "companies", "c1"), { reportSlug: "x" })));

// storage
const st = env.unauthenticatedContext().storage();
const bytes = new Uint8Array([1,2,3]);
const up = (path, type, data=bytes) => uploadBytes(ref(st, path), data, { contentType: type });
await check("anon upload pdf to pending", assertSucceeds(up("public-reports/pending/abcdefghijklmnop/a.pdf","application/pdf")));
await check("anon upload disallowed mime", assertFails(up("public-reports/pending/abcdefghijklmnop/a.exe","application/x-msdownload")));
await check("anon upload oversize", assertFails(up("public-reports/pending/abcdefghijklmnop/b.png","image/png", new Uint8Array(10*1024*1024+1))));
await check("anon upload bad uploadId", assertFails(up("public-reports/pending/short/a.pdf","application/pdf")));
await check("anon cannot read pending", assertFails(getBytes(ref(st,"public-reports/pending/abcdefghijklmnop/a.pdf"))));
await check("anon cannot overwrite pending", assertFails(up("public-reports/pending/abcdefghijklmnop/a.pdf","application/pdf")));
await check("anon cannot write case folder", assertFails(up("companies/c1/cases/p1/x.pdf","application/pdf")));
await check("anon cannot read case folder", assertFails(getBytes(ref(st,"companies/c1/cases/p1/x.pdf"))));
await env.cleanup();
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
