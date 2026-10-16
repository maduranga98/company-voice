const test = require('node:test');
const assert = require('node:assert');

// The report helpers are browser ESM with no imports, so load them dynamically.
const load = () => import('../../src/utils/policyAckReport.js');

const roster = [
  { employeeKey: 'e1', employeeId: 'E1', name: 'Ada' },
  { employeeKey: 'e2', employeeId: 'E2', name: 'Grace' },
  { employeeKey: 'e10', employeeId: 'E10', name: 'Alan' },
];
const ack = (key, version, ms, extra = {}) => ({
  employeeKey: key, employeeId: key.toUpperCase(), employeeName: key, policyVersion: version,
  response: 'acknowledged', createdAt: ms, ...extra,
});
const concern = (key, version, ms, postId) => ({
  employeeKey: key, employeeId: key.toUpperCase(), employeeName: key, policyVersion: version,
  response: 'concern', createdAt: ms, postId,
});

test('roster members start pending and become acknowledged for the chosen version only', async () => {
  const { buildAckReport } = await load();
  const { rows, summary } = buildAckReport({
    roster,
    responses: [ack('e1', '1.0', 100), ack('e2', '0.9', 50)],
    version: '1.0',
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.employeeKey, r.status]));
  assert.deepStrictEqual(byKey, { e1: 'acknowledged', e2: 'pending', e10: 'pending' });
  assert.deepStrictEqual(summary, { rosterTotal: 3, acknowledged: 1, pending: 2, concerns: 0, offRoster: 0 });
});

test('pending rows come first, numerically ordered; acknowledged rows newest first', async () => {
  const { buildAckReport } = await load();
  const { rows } = buildAckReport({
    roster,
    responses: [ack('e1', '1.0', 100), ack('e2', '1.0', 200)],
    version: '1.0',
  });
  assert.deepStrictEqual(rows.map((r) => r.employeeKey), ['e10', 'e2', 'e1']);
});

test('a concern marks a pending employee, and is still counted when they also acknowledge', async () => {
  const { buildAckReport } = await load();
  const { rows, summary } = buildAckReport({
    roster,
    responses: [concern('e1', '1.0', 10, 'p1'), concern('e2', '1.0', 11, 'p2'), ack('e2', '1.0', 12)],
    version: '1.0',
  });
  const e1 = rows.find((r) => r.employeeKey === 'e1');
  const e2 = rows.find((r) => r.employeeKey === 'e2');
  assert.strictEqual(e1.status, 'concern');
  assert.deepStrictEqual(e1.postIds, ['p1']);
  assert.strictEqual(e2.status, 'acknowledged');
  assert.strictEqual(e2.concerns, 1);
  assert.strictEqual(summary.concerns, 2);
});

test('without a roster only responders appear; with one, outsiders are flagged', async () => {
  const { buildAckReport } = await load();
  const open = buildAckReport({ roster: [], responses: [ack('x', '1.0', 1)], version: '1.0' });
  assert.strictEqual(open.rows.length, 1);
  assert.strictEqual(open.summary.offRoster, 0);

  const closed = buildAckReport({ roster, responses: [ack('stranger', '1.0', 1)], version: '1.0' });
  assert.strictEqual(closed.rows.find((r) => r.employeeKey === 'stranger').onRoster, false);
  assert.strictEqual(closed.summary.offRoster, 1);
});

test('a typed name overrides the roster name; Firestore-style timestamps are understood', async () => {
  const { buildAckReport } = await load();
  const ts = { toMillis: () => 4242 };
  const { rows } = buildAckReport({
    roster: [{ employeeKey: 'e1', employeeId: 'E1', name: 'Roster Name' }],
    responses: [ack('e1', '1.0', ts, { employeeName: 'Typed Name' })],
    version: '1.0',
  });
  assert.strictEqual(rows[0].name, 'Typed Name');
  assert.strictEqual(rows[0].acknowledgedAt, 4242);
});

test('listVersions puts the current version first, then the most recent others', async () => {
  const { listVersions } = await load();
  const responses = [ack('a', '1.0', 100), ack('b', '2.0', 300), ack('c', '1.5', 200)];
  assert.deepStrictEqual(listVersions(responses, '3.0'), ['3.0', '2.0', '1.5', '1.0']);
  assert.deepStrictEqual(listVersions(responses, '1.0'), ['1.0', '2.0', '1.5']);
  assert.deepStrictEqual(listVersions([], '1.0'), ['1.0']);
});

const bundle = [
  { id: 'p1', version: '1.0' },
  { id: 'p2', version: '2.0' },
];
const bAck = (key, policyId, version, ms) => ({ ...ack(key, version, ms), policyId });
const bConcern = (key, policyId, version, ms, postId) => ({ ...concern(key, version, ms, postId), policyId });

test('bundle report: complete, partial, concern-only and pending employees', async () => {
  const { buildBundleReport } = await load();
  const { rows, summary, perPolicy } = buildBundleReport({
    roster,
    policies: bundle,
    responses: [
      bAck('e1', 'p1', '1.0', 100),
      bAck('e1', 'p2', '2.0', 200),
      bAck('e2', 'p1', '1.0', 150),
      bConcern('e10', 'p2', '2.0', 160, 'post1'),
    ],
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.employeeKey, r]));
  assert.strictEqual(byKey.e1.status, 'acknowledged');
  assert.strictEqual(byKey.e1.acknowledgedAt, 200);
  assert.strictEqual(byKey.e2.status, 'partial');
  assert.deepStrictEqual(byKey.e2.missing, ['p2']);
  assert.strictEqual(byKey.e10.status, 'concern');
  assert.deepStrictEqual(byKey.e10.postIds, ['post1']);
  assert.deepStrictEqual(summary, {
    rosterTotal: 3, acknowledged: 1, partial: 1, pending: 0, concerns: 1, offRoster: 0,
  });
  assert.deepStrictEqual(perPolicy, [{ id: 'p1', acknowledged: 2 }, { id: 'p2', acknowledged: 1 }]);
});

test('bundle report ignores old versions and unrelated policies, and flags off-roster employees', async () => {
  const { buildBundleReport } = await load();
  const { rows, summary } = buildBundleReport({
    roster,
    policies: bundle,
    responses: [
      bAck('e1', 'p1', '0.9', 100), // outdated version
      bAck('e1', 'p3', '1.0', 100), // not in this bundle
      bAck('zz', 'p1', '1.0', 100),
      bAck('zz', 'p2', '2.0', 100),
    ],
  });
  assert.strictEqual(rows.find((r) => r.employeeKey === 'e1').status, 'pending');
  const outsider = rows.find((r) => r.employeeKey === 'zz');
  assert.strictEqual(outsider.status, 'acknowledged');
  assert.strictEqual(outsider.onRoster, false);
  assert.strictEqual(summary.offRoster, 1);
});
