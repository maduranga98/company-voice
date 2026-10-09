/**
 * Firestore-transaction rate limiting for the public report endpoints.
 * Counters live in rateLimits/{hashedKey}; the key is an HMAC, so no IP is stored.
 * Docs carry `expiresAt` for a Firestore TTL policy and the cleanup job.
 */

const crypto = require('crypto');

const COLLECTION = 'rateLimits';

function hashKey(value, salt) {
  if (!salt) {
    throw new Error('IP_HASH_SALT is required');
  }
  return crypto.createHmac('sha256', salt).update(value).digest('hex');
}

/**
 * Count one hit against `hashedKey`. Resolves true when allowed, false when over the limit.
 * @param {FirebaseFirestore.Firestore} db
 * @param {{hashedKey: string, limit: number, windowMs: number, now?: number}} opts
 */
async function consumeRateLimit(db, { hashedKey, limit, windowMs, now = Date.now() }) {
  const ref = db.collection(COLLECTION).doc(hashedKey);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;

    if (!data || now >= data.windowStart + windowMs) {
      tx.set(ref, { count: 1, windowStart: now, expiresAt: new Date(now + windowMs) });
      return true;
    }
    if (data.count >= limit) {
      return false;
    }
    tx.update(ref, { count: data.count + 1 });
    return true;
  });
}

/**
 * Claim a one-shot token (idempotency). Resolves false when it was already claimed.
 */
async function claimToken(db, { hashedKey, ttlMs, now = Date.now() }) {
  const ref = db.collection(COLLECTION).doc(hashedKey);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data().expiresAt.toMillis() > now) {
      return false;
    }
    tx.set(ref, { count: 1, windowStart: now, expiresAt: new Date(now + ttlMs) });
    return true;
  });
}

async function releaseToken(db, hashedKey) {
  await db.collection(COLLECTION).doc(hashedKey).delete();
}

module.exports = { COLLECTION, hashKey, consumeRateLimit, claimToken, releaseToken };
