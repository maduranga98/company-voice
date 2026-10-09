/**
 * One-off, idempotent: move password hashes out of users/{id}.password into the
 * server-only userCredentials/{id} collection (algo "sha256-legacy"), then delete the
 * password field from the users document. Logging in re-hashes legacy records to scrypt.
 *
 * Dry run (default):  GOOGLE_CLOUD_PROJECT=<id> node scripts/migrateCredentials.js --dry-run
 * Apply:              GOOGLE_CLOUD_PROJECT=<id> node scripts/migrateCredentials.js
 *
 * Uses Application Default Credentials, or FIRESTORE_EMULATOR_HOST for the emulator.
 * Never prints hashes or usernames.
 */

import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/", import.meta.url));
const admin = require("firebase-admin");

const dryRun = process.argv.includes("--dry-run");
const BATCH_SIZE = 200;

admin.initializeApp();
const db = admin.firestore();
const { FieldValue } = require("firebase-admin/firestore");

let scanned = 0;
let withPassword = 0;
let copied = 0;
let alreadyPresent = 0;
let removedFromUsers = 0;
let batch = db.batch();
let pending = 0;

const flush = async () => {
  if (pending === 0) return;
  if (!dryRun) await batch.commit();
  batch = db.batch();
  pending = 0;
};

for await (const doc of db.collection("users").stream()) {
  scanned++;
  const password = doc.data().password;
  if (typeof password !== "string" || password.length === 0) continue;
  withPassword++;

  const credRef = db.collection("userCredentials").doc(doc.id);
  const existing = await credRef.get();

  if (existing.exists) {
    // Never overwrite a credential that may already be scrypt (re-run, or logged in meanwhile).
    alreadyPresent++;
  } else {
    batch.set(credRef, {
      passwordHash: password,
      algo: "sha256-legacy",
      updatedAt: FieldValue.serverTimestamp(),
    });
    copied++;
    pending++;
  }
  batch.update(doc.ref, { password: FieldValue.delete() });
  removedFromUsers++;
  pending++;

  if (pending >= BATCH_SIZE) await flush();
}
await flush();

console.log(
  `${dryRun ? "[dry-run] " : ""}Scanned ${scanned} users. ` +
    `${withPassword} had a password field: ${copied} credentials ${dryRun ? "would be " : ""}created, ` +
    `${alreadyPresent} already had one, password field ${dryRun ? "would be " : ""}removed from ${removedFromUsers}.`
);
