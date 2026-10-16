/**
 * One-off: give every existing company editable category documents (the categories the
 * public form used to hard-code, plus the locked Vendor Risk entry) and a default routing
 * assignee (its HR staff, or its company admin when it has none).
 *
 * Idempotent: a company already seeded keeps its categories untouched; its default assignee
 * is only filled in when missing. Safe to re-run.
 *
 * Dry run (default):  GOOGLE_CLOUD_PROJECT=<id> node scripts/seedCategoriesRouting.js
 * Apply:              GOOGLE_CLOUD_PROJECT=<id> node scripts/seedCategoriesRouting.js --apply
 * One company:        ... node scripts/seedCategoriesRouting.js --company=<companyId> [--apply]
 *
 * Uses Application Default Credentials (gcloud auth application-default login)
 * or FIRESTORE_EMULATOR_HOST for the emulator. The same logic is available to a
 * super_admin as the `migrateCategoryRouting` callable.
 */

import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/", import.meta.url));
const admin = require("firebase-admin");
const { seedCompany } = require("./utils/categorySeed");

const apply = process.argv.includes("--apply");
const only = process.argv.find((a) => a.startsWith("--company="))?.slice("--company=".length);

admin.initializeApp();
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const ids = only ? [only] : (await db.collection("companies").select().get()).docs.map((d) => d.id);
let seeded = 0;
let failed = 0;

for (const companyId of ids) {
  try {
    const result = await seedCompany(db, companyId, { now, dryRun: !apply });
    if (result.skipped) {
      console.log(`skip ${companyId}: ${result.skipped}`);
      continue;
    }
    const assignee = result.defaultAssignee ? `${result.defaultAssignee.type}:${result.defaultAssignee.id}` : "-";
    console.log(
      `${apply ? "seeded" : "[dry-run] would seed"} ${companyId}: ${result.categoriesSeeded} categories, default assignee ${assignee}`
    );
    if (result.categoriesSeeded > 0 || result.defaultAssignee) seeded++;
  } catch (error) {
    failed++;
    console.error(`FAILED ${companyId}: ${error.message}`);
  }
}

console.log(
  apply
    ? `Done. ${seeded} of ${ids.length} companies updated, ${failed} failed.`
    : `Dry run. ${seeded} of ${ids.length} companies need seeding. Re-run with --apply.`
);
process.exitCode = failed > 0 ? 1 : 0;
