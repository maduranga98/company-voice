/**
 * Browser check of the claims-based client against the emulators (functions, firestore, auth, storage).
 * Start the app first:
 *   VITE_USE_EMULATORS=true VITE_FIREBASE_API_KEY=x VITE_FIREBASE_PROJECT_ID=demo-voxwel VITE_FIREBASE_APP_ID=1:1:web:x \
 *     VITE_FIREBASE_STORAGE_BUCKET=demo-voxwel.appspot.com VITE_FIREBASE_AUTH_DOMAIN=demo.firebaseapp.com npx vite --port 5173 --host 127.0.0.1
 * then, from a scratch dir with playwright and firebase-tools installed:
 *   REPO_ROOT=<repo> npx firebase emulators:exec --only functions,firestore,auth,storage --project demo-voxwel \
 *     --config <repo>/firebase.json "node client.emulator.mjs"
 */
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const root = process.env.REPO_ROOT || "/home/user/company-voice";
const require = createRequire(`${root}/functions/`);
const admin = require("firebase-admin");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
admin.initializeApp({ projectId: "demo-voxwel" });
const db = admin.firestore();
const sha = (p) => crypto.createHash("sha256").update(p, "utf8").digest("hex");

await db.doc("companies/c1").set({ name: "Acme", isActive: true });
const seed = (id, username, role, pw, extra = {}) =>
  db.doc(`users/${id}`).set({ username, role, companyId: role === "super_admin" ? null : "c1", status: "active", displayName: username, password: sha(pw), ...extra });
await seed("admin1", "alice", "company_admin", "AlicePass1!");
await seed("hr1", "hank", "hr", "HankPass1!");
await seed("hrTemp", "tina", "hr", "TinaPass1!", { mustChangePassword: true });
await db.doc("userCredentials/hrTemp").set({ algo: "sha256-legacy", passwordHash: sha("TinaPass1!"), mustChangePassword: true });
await db.doc("users/hrTemp").update({ password: admin.firestore.FieldValue.delete() });
const post = (id, title, involvesHR) => db.doc(`posts/${id}`).set({ companyId: "c1", title, content: "x", type: "problem_report", privacyLevel: "hr_only", involvesHR, status: "open", priority: "medium", isAnonymous: true, authorId: null, createdAt: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.Timestamp.now() });
await post("p1", "Visible to HR case", false);
await post("p2", "Admin only case", true);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let failures = 0;
const check = (name, ok) => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"} ${name}`); };

// The emulator needs an App Check header on enforced callables (the real SDK supplies a token).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const APP_CHECK = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "1:1:web:test", aud: ["projects/demo-voxwel"], iss: "https://firebaseappcheck.googleapis.com/1" })}.x`;

async function session() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/127\.0\.0\.1:5001/, (route) => route.continue({ headers: { ...route.request().headers(), "x-firebase-appcheck": APP_CHECK } }));
  const page = await ctx.newPage();
  const errors = [];
  // Firebase Performance cannot register an installation with the fake API key used here.
  page.on("pageerror", (e) => { if (!/Installations:/.test(String(e))) errors.push(String(e)); });
  return { ctx, page, errors };
}
const login = async (page, user, pass) => {
  await page.goto("http://127.0.0.1:5173/login");
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await page.click('button[type="submit"]');
};

// ---- wrong password
{
  const { ctx, page } = await session();
  await login(page, "alice", "wrong-password");
  await page.waitForSelector("text=Invalid username or password");
  check("wrong password shows the generic error and stays on /login", page.url().endsWith("/login"));
  await ctx.close();
}

// ---- company_admin session
{
  const { ctx, page, errors } = await session();
  await login(page, "alice", "AlicePass1!");
  await page.waitForURL(/company\/dashboard/, { timeout: 20000 });
  check("company_admin lands on the company dashboard", true);
  check("no localStorage currentUser, no anonymous sign-in leftovers", (await page.evaluate(() => localStorage.getItem("currentUser"))) === null);
  await page.goto("http://127.0.0.1:5173/hr/inbox");
  await page.waitForSelector("text=Admin only case", { timeout: 15000 });
  check("company_admin sees involvesHR cases in the inbox", (await page.locator("text=Visible to HR case").count()) > 0);
  await page.reload();
  await page.waitForSelector("text=Admin only case", { timeout: 15000 });
  check("session survives a reload (Firebase Auth persistence)", true);
  check("no uncaught page errors (company_admin)", errors.length === 0);
  if (errors.length) console.log(errors);
  await ctx.close();
}

// ---- hr session: filtered inbox
{
  const { ctx, page } = await session();
  await login(page, "hank", "HankPass1!");
  await page.waitForURL(/hr\/inbox/, { timeout: 20000 });
  await page.waitForSelector("text=Visible to HR case", { timeout: 15000 });
  check("hr sees normal cases and not involvesHR cases", (await page.locator("text=Admin only case").count()) === 0);
  await page.goto("http://127.0.0.1:5173/company/qr-code");
  await page.waitForURL(/dashboard|hr\/inbox/, { timeout: 10000 });
  check("hr cannot open the company_admin QR page", !page.url().includes("qr-code"));
  await ctx.close();
}

// ---- logout and protected routes
{
  const { ctx, page } = await session();
  await login(page, "alice", "AlicePass1!");
  await page.waitForURL(/company\/dashboard/, { timeout: 20000 });
  await page.getByRole("button", { name: /logout|sign out/i }).last().click();
  await page.waitForURL(/login/, { timeout: 10000 });
  check("Sign Out signs out of Firebase and returns to /login", true);
  await page.goto("http://127.0.0.1:5173/company/dashboard");
  await page.waitForURL(/login/, { timeout: 10000 });
  check("after sign-out protected routes redirect to /login", true);
  await ctx.close();
}

// ---- forced password change
{
  const { ctx, page } = await session();
  await login(page, "tina", "TinaPass1!");
  await page.waitForSelector("text=You must choose a new password", { timeout: 20000 });
  check("account with mustChangePassword is held on the change-password screen", true);
  await ctx.close();
}

await browser.close();
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
