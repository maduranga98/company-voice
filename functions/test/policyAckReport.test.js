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
