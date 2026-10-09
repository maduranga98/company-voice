/**
 * One-off: set involvesHR=false on existing posts that lack the field.
 *
 * Firestore rules now require HR queries to filter where("involvesHR", "==", false),
 * and an equality filter never matches a missing field. Run this BEFORE deploying
 * the new firestore.rules, otherwise HR users stop seeing pre-existing posts.
 *
 * Dry run (default):  GOOGLE_CLOUD_PROJECT=<id> node scripts/backfillInvolvesHR.js
 * Apply:              GOOGLE_CLOUD_PROJECT=<id> node scripts/backfillInvolvesHR.js --apply
 */

import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/", import.meta.url));
const admin = require("firebase-admin");

const apply = process.argv.includes("--apply");
const BATCH_SIZE = 400;

admin.initializeApp();
const db = admin.firestore();

let scanned = 0;
let toUpdate = [];
let updated = 0;

const flush = async () => {
  if (!apply || toUpdate.length === 0) return;
  const batch = db.batch();
  toUpdate.forEach((ref) => batch.update(ref, { involvesHR: false }));
  await batch.commit();
  updated += toUpdate.length;
  toUpdate = [];
};

let pending = 0;
for await (const doc of db.collection("posts").stream()) {
  scanned++;
  if (doc.data().involvesHR !== undefined) continue;
  pending++;
  toUpdate.push(doc.ref);
  if (toUpdate.length >= BATCH_SIZE) await flush();
}
await flush();

console.log(
  apply
    ? `Done. Scanned ${scanned} posts, set involvesHR=false on ${updated}.`
    : `Dry run. Scanned ${scanned} posts, ${pending} lack involvesHR. Re-run with --apply.`
);
