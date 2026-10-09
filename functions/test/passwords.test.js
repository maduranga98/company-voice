const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const {
  hashPassword,
  verifyPassword,
  verifyAgainstDummy,
  validateNewPassword,
  generateTemporaryPassword,
  SCRYPT_PARAMS,
} = require('../utils/passwords');

test('scrypt hash uses N=2^15, r=8, p=1, 16-byte salt, 64-byte key', async () => {
  const cred = await hashPassword('correct horse');
  assert.strictEqual(cred.algo, 'scrypt');
  assert.deepStrictEqual(cred.params, { N: 32768, r: 8, p: 1, keyLen: 64 });
  assert.strictEqual(Buffer.from(cred.salt, 'base64').length, 16);
  assert.strictEqual(Buffer.from(cred.passwordHash, 'base64').length, 64);
  assert.deepStrictEqual(SCRYPT_PARAMS, cred.params);
});

test('same password hashes differently (random salt) and verifies only when correct', async () => {
  const a = await hashPassword('hunter2hunter2');
  const b = await hashPassword('hunter2hunter2');
  assert.notStrictEqual(a.passwordHash, b.passwordHash);
  assert.notStrictEqual(a.salt, b.salt);
  assert.deepStrictEqual(await verifyPassword('hunter2hunter2', a), { ok: true, needsRehash: false });
  assert.strictEqual((await verifyPassword('hunter2hunter3', a)).ok, false);
  assert.strictEqual((await verifyPassword('', a)).ok, false);
});

test('legacy unsalted sha256 verifies once and asks for a re-hash', async () => {
  const legacy = {
    algo: 'sha256-legacy',
    passwordHash: crypto.createHash('sha256').update('old-password', 'utf8').digest('hex'),
  };
  assert.deepStrictEqual(await verifyPassword('old-password', legacy), { ok: true, needsRehash: true });
  assert.deepStrictEqual(await verifyPassword('wrong', legacy), { ok: false, needsRehash: false });
  const upper = { ...legacy, passwordHash: legacy.passwordHash.toUpperCase() };
  assert.strictEqual((await verifyPassword('old-password', upper)).ok, true);
});

test('malformed or missing credentials never verify', async () => {
  assert.strictEqual((await verifyPassword('x', null)).ok, false);
  assert.strictEqual((await verifyPassword('x', {})).ok, false);
  assert.strictEqual((await verifyPassword('x', { algo: 'md5', passwordHash: 'abc' })).ok, false);
  assert.strictEqual((await verifyPassword(undefined, { algo: 'sha256-legacy', passwordHash: 'a' })).ok, false);
  assert.strictEqual((await verifyAgainstDummy('anything')).ok, false);
});

test('password policy and temporary passwords', () => {
  assert.ok(validateNewPassword('12345678'));
  assert.ok(!validateNewPassword('1234567'));
  assert.ok(!validateNewPassword('x'.repeat(129)));
  assert.ok(!validateNewPassword(undefined));
  const temp = generateTemporaryPassword();
  assert.match(temp, /^[A-HJKMNP-TV-Za-hjkmnp-tv-z2-9]{14}$/);
  assert.notStrictEqual(temp, generateTemporaryPassword());
});
