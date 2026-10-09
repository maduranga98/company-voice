const test = require('node:test');
const assert = require('node:assert');
const { consumeRateLimit, claimToken, hashKey } = require('../utils/rateLimit');

// Minimal in-memory Firestore double: serial transactions over a Map.
function fakeDb() {
  const store = new Map();
  const ts = (d) => ({ toMillis: () => d.getTime() });
  const refFor = (id) => ({ id });
  return {
    store,
    collection: () => ({
      doc: (id) => ({
        ...refFor(id),
        delete: async () => store.delete(id),
      }),
    }),
    runTransaction: async (fn) => {
      const tx = {
        get: async (ref) => {
          const data = store.get(ref.id);
          return { exists: !!data, data: () => data };
        },
        set: (ref, data) => {
          store.set(ref.id, { ...data, expiresAt: ts(data.expiresAt) });
        },
        update: (ref, data) => {
          store.set(ref.id, { ...store.get(ref.id), ...data });
        },
      };
      return fn(tx);
    },
  };
}

test('allows up to the limit then blocks (6th of 5/hour is rejected)', async () => {
  const db = fakeDb();
  const hashedKey = hashKey('203.0.113.7', 'salt');
  const results = [];
  for (let i = 0; i < 6; i++) {
    results.push(await consumeRateLimit(db, { hashedKey, limit: 5, windowMs: 3600000, now: 1000 + i }));
  }
  assert.deepStrictEqual(results, [true, true, true, true, true, false]);
});

test('window resets after it elapses', async () => {
  const db = fakeDb();
  const opts = { hashedKey: 'k', limit: 1, windowMs: 1000 };
  assert.ok(await consumeRateLimit(db, { ...opts, now: 0 }));
  assert.ok(!(await consumeRateLimit(db, { ...opts, now: 500 })));
  assert.ok(await consumeRateLimit(db, { ...opts, now: 1500 }));
});

test('different keys are independent and the stored key is a hash, not the IP', async () => {
  const db = fakeDb();
  const a = hashKey('198.51.100.1', 'salt');
  const b = hashKey('198.51.100.2', 'salt');
  assert.ok(await consumeRateLimit(db, { hashedKey: a, limit: 1, windowMs: 1000, now: 0 }));
  assert.ok(await consumeRateLimit(db, { hashedKey: b, limit: 1, windowMs: 1000, now: 0 }));
  for (const id of db.store.keys()) assert.ok(!id.includes('198.51.100'));
});

test('claimToken is single-use until it expires', async () => {
  const db = fakeDb();
  assert.ok(await claimToken(db, { hashedKey: 't', ttlMs: 1000, now: 0 }));
  assert.ok(!(await claimToken(db, { hashedKey: 't', ttlMs: 1000, now: 10 })));
  assert.ok(await claimToken(db, { hashedKey: 't', ttlMs: 1000, now: 2000 }));
});

test('hashKey requires a salt', () => {
  assert.throws(() => hashKey('x', ''));
});
