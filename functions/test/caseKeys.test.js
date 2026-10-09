const test = require('node:test');
const assert = require('node:assert');
const {
  ALPHABET,
  generateCaseCode,
  generateSecretKey,
  hashSecretKey,
  verifySecretKey,
} = require('../utils/caseKeys');

test('case code has VW-XXXX-XXXX shape and only Crockford characters', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateCaseCode();
    assert.match(code, /^VW-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  }
});

test('secret key is 4 groups of 4 from the alphabet', () => {
  for (let i = 0; i < 200; i++) {
    const key = generateSecretKey();
    assert.match(key, /^([0-9A-HJKMNP-TV-Z]{4}-){3}[0-9A-HJKMNP-TV-Z]{4}$/);
  }
  assert.strictEqual(ALPHABET.length, 32);
  assert.ok(!/[ILOU]/.test(ALPHABET));
});

test('keys are not repeated across calls', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(generateSecretKey());
  assert.strictEqual(seen.size, 500);
});

test('hash is deterministic, peppered and never contains the key', () => {
  const key = generateSecretKey();
  const a = hashSecretKey(key, 'pepper-1');
  assert.strictEqual(a, hashSecretKey(key, 'pepper-1'));
  assert.notStrictEqual(a, hashSecretKey(key, 'pepper-2'));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes(key.replace(/-/g, '').toLowerCase()));
});

test('verify accepts the key in typed variants and rejects others', () => {
  const key = '7K3M-Q9XT-0B2D-HJ4N';
  const hash = hashSecretKey(key, 'pepper');
  assert.ok(verifySecretKey(key, hash, 'pepper'));
  assert.ok(verifySecretKey('7k3m q9xt 0b2d hj4n', hash, 'pepper'));
  assert.ok(verifySecretKey('7K3M-Q9XT-OB2D-HJ4N', hash, 'pepper'));
  assert.ok(!verifySecretKey('7K3M-Q9XT-0B2D-HJ4P', hash, 'pepper'));
  assert.ok(!verifySecretKey(key, hash, 'other-pepper'));
  assert.ok(!verifySecretKey(key, '', 'pepper'));
  assert.ok(!verifySecretKey(key, 'not-hex', 'pepper'));
});

test('hashing without a pepper throws', () => {
  assert.throws(() => hashSecretKey('abc', ''));
});
