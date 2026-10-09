/**
 * Bootstrap or reset a super_admin credential from the Admin SDK.
 * The password is read from a hidden prompt (or the CREATE_SUPER_ADMIN_PASSWORD
 * environment variable for non-interactive use), never from argv, so it does not
 * land in shell history, and it is never written to a file or printed.
 *
 *   GOOGLE_CLOUD_PROJECT=<id> node scripts/createSuperAdmin.js <username> [--display-name "Name"]
 *
 * Creates users/{id} (role super_admin, companyId null, status active) when the username
 * is new, or resets the password of the existing super_admin with that username.
 */

import { createRequire } from "node:module";
import readline from "node:readline";

const require = createRequire(new URL("../functions/", import.meta.url));
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { hashPassword, validateNewPassword } = require("./utils/passwords");

const args = process.argv.slice(2);
const username = (args.find((a) => !a.startsWith("--")) || "").toLowerCase().trim();
const nameFlag = args.indexOf("--display-name");
const displayName = nameFlag >= 0 ? args[nameFlag + 1] : "Super Admin";

if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
  console.error("Usage: node scripts/createSuperAdmin.js <username> [--display-name \"Name\"]");
  process.exit(1);
}

const prompt = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) rl.output.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      rl.output.write("\n");
      resolve(answer);
    });
  });

const password = process.env.CREATE_SUPER_ADMIN_PASSWORD || (await prompt("Password: "));
if (!process.env.CREATE_SUPER_ADMIN_PASSWORD) {
  const confirmation = await prompt("Repeat password: ");
  if (confirmation !== password) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
}
if (!validateNewPassword(password)) {
  console.error("Password must be 8 to 128 characters.");
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

const matches = await db.collection("users").where("username", "==", username).get();
const existing = matches.docs.find((d) => d.data().role === "super_admin");
if (matches.size > 0 && !existing) {
  console.error("That username belongs to a non-super_admin account. Choose another.");
  process.exit(1);
}

const userRef = existing ? existing.ref : db.collection("users").doc();
const credential = await hashPassword(password);

const batch = db.batch();
if (!existing) {
  batch.set(userRef, {
    username,
    displayName,
    role: "super_admin",
    companyId: null,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
batch.set(db.collection("userCredentials").doc(userRef.id), {
  ...credential,
  mustChangePassword: false,
  updatedAt: FieldValue.serverTimestamp(),
});
await batch.commit();

// Invalidate sessions that may exist for a reset account.
await admin.auth().revokeRefreshTokens(userRef.id).catch(() => {});

console.log(existing ? "Password reset for the existing super_admin." : "super_admin created.");
