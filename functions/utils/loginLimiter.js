/**
 * Login throttling in Firestore transactions. Keys are HMACs (see rateLimit.hashKey),
 * so neither usernames nor IP addresses are stored.
 *  - per username: 10 failures, then a 15 minute lockout (counted whether or not the account exists)
 *  - per IP: 30 attempts per hour (via consumeRateLimit)
 */

const { COLLECTION } = require('./rateLimit');

const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

/** @returns {Promise<boolean>} true when the username is currently locked out */
async function isLocked(db, hashedKey, now = Date.now()) {
  const snap = await db.collection(COLLECTION).doc(hashedKey).get();
  if (!snap.exists) return false;
  const lockedUntil = snap.data().lockedUntil;
  return typeof lockedUntil === 'number' && lockedUntil > now;
}

/** Records a failed attempt; the failure that reaches the limit starts the lockout. */
async function recordFailure(db, hashedKey, now = Date.now()) {
  const ref = db.collection(COLLECTION).doc(hashedKey);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    const stale = !data || now >= data.expiresAt.toMillis();
    const failures = (stale ? 0 : data.failures) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_MS : null;

    tx.set(ref, {
      failures,
      lockedUntil,
      count: failures,
      windowStart: stale ? now : data.windowStart,
      expiresAt: new Date(now + LOCK_MS),
    });
    return { failures, locked: lockedUntil !== null };
  });
}

async function clearFailures(db, hashedKey) {
  await db.collection(COLLECTION).doc(hashedKey).delete();
}

module.exports = { MAX_FAILURES, LOCK_MS, isLocked, recordFailure, clearFailures };
