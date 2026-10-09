const test = require('node:test');
const assert = require('node:assert');
const { isLocked, recordFailure, clearFailures, MAX_FAILURES, LOCK_MS } = require('../utils/loginLimiter');

function fakeDb() {
  const store = new Map();
  const ts = (d) => ({ toMillis: () => d.getTime() });
  const col = {
    doc: (id) => ({
      id,
      get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
      delete: async () => store.delete(id),
    }),
  };
  return {
    store,
    collection: () => col,
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ({ exists: store.has(ref.id), data: () => store.get(ref.id) }),
        set: (ref, data) => store.set(ref.id, { ...data, expiresAt: ts(data.expiresAt) }),
      }),
  };
}

test('locks on the 10th failure for 15 minutes, not before', async () => {
  const db = fakeDb();
  for (let i = 1; i < MAX_FAILURES; i++) {
    const r = await recordFailure(db, 'k', 1000 + i);
    assert.strictEqual(r.locked, false);
    assert.strictEqual(await isLocked(db, 'k', 1000 + i), false);
  }
  const last = await recordFailure(db, 'k', 5000);
  assert.deepStrictEqual(last, { failures: MAX_FAILURES, locked: true });
  assert.strictEqual(await isLocked(db, 'k', 5001), true);
  assert.strictEqual(await isLocked(db, 'k', 5000 + LOCK_MS - 1), true);
  assert.strictEqual(await isLocked(db, 'k', 5000 + LOCK_MS + 1), false);
});

test('failures reset after the window and on success; keys are independent', async () => {
  const db = fakeDb();
  await recordFailure(db, 'a', 0);
  await recordFailure(db, 'a', 10);
  assert.strictEqual((await recordFailure(db, 'a', LOCK_MS + 1000)).failures, 1);
  await clearFailures(db, 'a');
  assert.strictEqual(await isLocked(db, 'a', 0), false);
  assert.strictEqual((await recordFailure(db, 'b', 0)).failures, 1);
});
