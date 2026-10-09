/**
 * One-off: create a report link slug for every company that lacks one.
 *
 * Dry run (default):  GOOGLE_CLOUD_PROJECT=<id> node scripts/backfillReportSlugs.js
 * Apply:              GOOGLE_CLOUD_PROJECT=<id> node scripts/backfillReportSlugs.js --apply
 *
 * Uses Application Default Credentials (gcloud auth application-default login)
 * or FIRESTORE_EMULATOR_HOST for the emulator.
 */

import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/", import.meta.url));
const admin = require("firebase-admin");
const { issueReportSlug } = require("./utils/reportSlugs");

const apply = process.argv.includes("--apply");

admin.initializeApp();
const db = admin.firestore();
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const companies = await db.collection("companies").get();
let missing = 0;
let issued = 0;

for (const company of companies.docs) {
  if (company.data().reportSlug) continue;
  missing++;
  if (!apply) {
    console.log(`[dry-run] would issue a slug for company ${company.id}`);
    continue;
  }
  const { slug } = await issueReportSlug(db, serverTimestamp, { companyId: company.id });
  issued++;
  console.log(`Issued ${slug} for company ${company.id}`);
}

console.log(
  apply
    ? `Done. ${issued} of ${missing} companies without a slug were updated.`
    : `Dry run. ${missing} of ${companies.size} companies need a slug. Re-run with --apply.`
);
