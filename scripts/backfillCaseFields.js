/**
 * One-off: give existing vendorReports and contentReports the shared case-handling
 * fields the posts model already has (priority, assignedTo, dueDate), so cross-type
 * queries and the case panel see a consistent shape.
 *
 * - vendorReports: priority = severity (low/medium/high map 1:1 onto the shared scale)
 * - contentReports: priority already set at creation; only missing fields are added
 * - assignedTo / dueDate default to null. Existing values are never overwritten.
 *
 * The app does not depend on this (readers fall back to severity / "medium"), it just
 * makes the stored data uniform.
 *
 * Dry run (default):  GOOGLE_CLOUD_PROJECT=<id> node scripts/backfillCaseFields.js
 * Apply:              GOOGLE_CLOUD_PROJECT=<id> node scripts/backfillCaseFields.js --apply
 */

import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/", import.meta.url));
const admin = require("firebase-admin");

const apply = process.argv.includes("--apply");
const BATCH_SIZE = 400;

admin.initializeApp();
const db = admin.firestore();

const VALID_PRIORITIES = ["critical", "high", "medium", "low"];

const patchFor = (collectionName, data) => {
  const patch = {};
  if (!VALID_PRIORITIES.includes(data.priority)) {
    const fromSeverity = collectionName === "vendorReports" && VALID_PRIORITIES.includes(data.severity);
    patch.priority = fromSeverity ? data.severity : "medium";
  }
  if (data.assignedTo === undefined) patch.assignedTo = null;
  if (data.dueDate === undefined) patch.dueDate = null;
  return Object.keys(patch).length ? patch : null;
};

for (const collectionName of ["vendorReports", "contentReports"]) {
  let scanned = 0;
  let pending = 0;
  let updated = 0;
  let batch = db.batch();
  let inBatch = 0;

  for await (const doc of db.collection(collectionName).stream()) {
    scanned++;
    const patch = patchFor(collectionName, doc.data());
    if (!patch) continue;
    pending++;
    if (!apply) continue;
    batch.update(doc.ref, patch);
    if (++inBatch >= BATCH_SIZE) {
      await batch.commit();
      updated += inBatch;
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (apply && inBatch > 0) {
    await batch.commit();
    updated += inBatch;
  }

  console.log(
    `${collectionName}: scanned ${scanned}, ${apply ? `updated ${updated}` : `would update ${pending}`}`
  );
}

if (!apply) console.log("Dry run only. Re-run with --apply to write.");
