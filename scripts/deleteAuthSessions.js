/**
 * One-off: delete the legacy authSessions collection after the claims-based rules and
 * client are live. Dry run by default.
 *
 * Dry run:  GOOGLE_CLOUD_PROJECT=<id> node scripts/deleteAuthSessions.js
 * Apply:    GOOGLE_CLOUD_PROJECT=<id> node scripts/deleteAuthSessions.js --apply
 */

import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/", import.meta.url));
const admin = require("firebase-admin");

const apply = process.argv.includes("--apply");

admin.initializeApp();
const db = admin.firestore();

const sessions = await db.collection("authSessions").get();
if (apply && !sessions.empty) {
  const writer = db.bulkWriter();
  sessions.docs.forEach((doc) => writer.delete(doc.ref));
  await writer.close();
}

console.log(
  apply
    ? `Deleted ${sessions.size} authSessions documents.`
    : `Dry run. ${sessions.size} authSessions documents would be deleted. Re-run with --apply.`
);
