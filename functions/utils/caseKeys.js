/**
 * Case code and secret key helpers for public reports.
 * The secret key is shown to the reporter once; only its keyed hash is stored.
 */

const crypto = require('crypto');

// Crockford base32: no I, L, O, U.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomChars(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    // 256 is a multiple of 32, so masking keeps the distribution uniform.
    out += ALPHABET[bytes[i] & 31];
  }
  return out;
}

/** @returns {string} e.g. VW-7K3M-Q9XT */
function generateCaseCode() {
  const raw = randomChars(8);
  return `VW-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** @returns {string} 16 chars in 4 groups of 4, e.g. 7K3M-Q9XT-0B2D-HJ4N */
function generateSecretKey() {
  const raw = randomChars(16);
  return [0, 4, 8, 12].map((i) => raw.slice(i, i + 4)).join('-');
}

/**
 * Normalize user-typed input the way Crockford base32 allows:
 * case-insensitive, separators ignored, O->0 and I/L->1.
 */
function normalizeSecretKey(secretKey) {
  return String(secretKey || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** HMAC-SHA256 with the pepper as the key, so the hash is useless without the pepper. */
function hashSecretKey(secretKey, pepper) {
  if (!pepper) {
    throw new Error('CASE_KEY_PEPPER is required');
  }
  return crypto
    .createHmac('sha256', pepper)
    .update(normalizeSecretKey(secretKey))
    .digest('hex');
}

/** Constant-time comparison of a candidate key against a stored hash. */
function verifySecretKey(secretKey, storedHash, pepper) {
  if (typeof storedHash !== 'string' || storedHash.length === 0) {
    return false;
  }
  const candidate = Buffer.from(hashSecretKey(secretKey, pepper), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidate, stored);
}

module.exports = {
  ALPHABET,
  randomChars,
  generateCaseCode,
  generateSecretKey,
  normalizeSecretKey,
  hashSecretKey,
  verifySecretKey,
};
