/**
 * Password hashing for staff logins. scrypt via Node crypto (no dependency).
 * Credential record shape (userCredentials/{userId}):
 *   { passwordHash (base64), algo: "scrypt", salt (base64), params: {N, r, p, keyLen}, updatedAt, mustChangePassword? }
 * Legacy records ({ algo: "sha256-legacy", passwordHash: hex }) verify once and must be re-hashed.
 */

const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, keyLen: 64 };
const SALT_BYTES = 16;
// scrypt needs 128 * N * r bytes (32 MiB); the Node default limit is exactly that, so raise it.
const MAX_MEM = 64 * 1024 * 1024;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const TEMP_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZabcdefghijkmnpqrstvwxyz23456789';

function derive(password, salt, params) {
  return scrypt(password, salt, params.keyLen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: MAX_MEM,
  });
}

/** @returns {Promise<{passwordHash: string, algo: 'scrypt', salt: string, params: object}>} */
async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await derive(password, salt, SCRYPT_PARAMS);
  return {
    passwordHash: key.toString('base64'),
    algo: 'scrypt',
    salt: salt.toString('base64'),
    params: { ...SCRYPT_PARAMS },
  };
}

function safeEqual(a, b) {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * @param {string} password candidate
 * @param {object|null} credential userCredentials record (or legacy-shaped record)
 * @returns {Promise<{ok: boolean, needsRehash: boolean}>}
 */
async function verifyPassword(password, credential) {
  if (typeof password !== 'string' || !credential || typeof credential.passwordHash !== 'string') {
    return { ok: false, needsRehash: false };
  }

  if (credential.algo === 'scrypt') {
    const params = credential.params || SCRYPT_PARAMS;
    const expected = Buffer.from(credential.passwordHash, 'base64');
    const actual = await derive(password, Buffer.from(credential.salt, 'base64'), params);
    return { ok: safeEqual(actual, expected), needsRehash: false };
  }

  if (credential.algo === 'sha256-legacy') {
    const actual = Buffer.from(crypto.createHash('sha256').update(password, 'utf8').digest('hex'));
    const expected = Buffer.from(credential.passwordHash.toLowerCase());
    const ok = safeEqual(actual, expected);
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
}

/** Spends the same CPU as a real check so unknown usernames are not distinguishable by timing. */
let dummyCredential = null;
async function verifyAgainstDummy(password) {
  if (!dummyCredential) {
    dummyCredential = await hashPassword(crypto.randomBytes(16).toString('hex'));
  }
  await verifyPassword(password, dummyCredential);
  return { ok: false, needsRehash: false };
}

function validateNewPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= MIN_PASSWORD &&
    password.length <= MAX_PASSWORD
  );
}

/** 14 characters from an alphabet without look-alikes. Shown once to the caller, never stored. */
function generateTemporaryPassword() {
  const bytes = crypto.randomBytes(14);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length];
  }
  return out;
}

module.exports = {
  SCRYPT_PARAMS,
  MIN_PASSWORD,
  MAX_PASSWORD,
  hashPassword,
  verifyPassword,
  verifyAgainstDummy,
  validateNewPassword,
  generateTemporaryPassword,
};
