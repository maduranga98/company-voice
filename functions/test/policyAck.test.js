const test = require('node:test');
const assert = require('node:assert');
const {
  PolicyAckValidationError,
  normalizeEmployeeId,
  ackDocId,
  validateAckSubmission,
  parseRosterText,
  recordAcknowledgement,
  countDistinctAcknowledgedEmployees,
} = require('../utils/policyAck');

const valid = (overrides = {}) => ({
  slug: 'acme-corp-7k3m',
  employeeId: 'EMP-0042',
  employeeName: 'Ada Lovelace',
  response: 'acknowledged',
  policyVersion: '1.0',
  idempotencyToken: 'a'.repeat(32),
  website: '',
  elapsedMs: 5000,
  clientLang: 'fr',
  ...overrides,
});

const rejectedField = (data) => {
  try {
    validateAckSubmission(data);
  } catch (error) {
    assert.ok(error instanceof PolicyAckValidationError);
    return error.field;
  }
  return null;
};

test('normalizeEmployeeId ignores case and whitespace but not other characters', () => {
  assert.strictEqual(normalizeEmployeeId(' EMP 0042 '), 'emp0042');
  assert.strictEqual(normalizeEmployeeId('emp0042'), 'emp0042');
  assert.notStrictEqual(normalizeEmployeeId('EMP-0042'), normalizeEmployeeId('EMP0042'));
  assert.strictEqual(normalizeEmployeeId('Ｅmp１'), 'emp1', 'full-width characters fold via NFKC');
});

test('ackDocId is stable per employee + policy + version and differs otherwise', () => {
  const a = ackDocId({ policyId: 'p1', policyVersion: '1.0', employeeKey: 'emp1' });
  assert.strictEqual(a, ackDocId({ policyId: 'p1', policyVersion: '1.0', employeeKey: 'emp1' }));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(a, ackDocId({ policyId: 'p1', policyVersion: '2.0', employeeKey: 'emp1' }));
  assert.notStrictEqual(a, ackDocId({ policyId: 'p2', policyVersion: '1.0', employeeKey: 'emp1' }));
  assert.notStrictEqual(a, ackDocId({ policyId: 'p1', policyVersion: '1.0', employeeKey: 'emp2' }));
  // The separator keeps ("p1","1.0x") apart from ("p1x","1.0").
  assert.notStrictEqual(
    ackDocId({ policyId: 'p1', policyVersion: '0x', employeeKey: 'e' }),
    ackDocId({ policyId: 'p10', policyVersion: 'x', employeeKey: 'e' })
  );
});

test('validateAckSubmission accepts a valid acknowledgement and normalizes it', () => {
  const out = validateAckSubmission(valid({ employeeId: ' emp 0042 ', employeeName: '  <b>Ada</b> Lovelace ' }));
  assert.strictEqual(out.employeeKey, 'emp0042');
  assert.strictEqual(out.employeeId, 'emp 0042');
  assert.strictEqual(out.employeeName, 'Ada Lovelace');
  assert.strictEqual(out.response, 'acknowledged');
  assert.strictEqual(out.concernText, '');
  assert.strictEqual(out.clientLang, 'fr');
});

test('validateAckSubmission requires a concern text of sane length only for concerns', () => {
  assert.strictEqual(rejectedField(valid({ response: 'concern' })), 'concernText');
  assert.strictEqual(rejectedField(valid({ response: 'concern', concernText: 'too short' })), 'concernText');
  assert.strictEqual(rejectedField(valid({ response: 'concern', concernText: 'x'.repeat(2001) })), 'concernText');
  const out = validateAckSubmission(valid({ response: 'concern', concernText: 'Clause 4 is unclear to me.' }));
  assert.strictEqual(out.concernText, 'Clause 4 is unclear to me.');
  // An acknowledgement never carries a concern text through.
  assert.strictEqual(validateAckSubmission(valid({ concernText: 'ignored text here' })).concernText, '');
});

test('validateAckSubmission rejects bad ids, names, slugs, responses and bot signals', () => {
  assert.strictEqual(rejectedField(null), 'body');
  assert.strictEqual(rejectedField(valid({ slug: 'NOPE' })), 'slug');
  assert.strictEqual(rejectedField(valid({ employeeId: '' })), 'employeeId');
  assert.strictEqual(rejectedField(valid({ employeeId: 'a/b' })), 'employeeId');
  assert.strictEqual(rejectedField(valid({ employeeId: '-lead' })), 'employeeId');
  assert.strictEqual(rejectedField(valid({ employeeId: 'x'.repeat(41) })), 'employeeId');
  assert.strictEqual(rejectedField(valid({ employeeId: 42 })), 'employeeId');
  assert.strictEqual(rejectedField(valid({ employeeName: 'A' })), 'employeeName');
  assert.strictEqual(rejectedField(valid({ employeeName: 'N'.repeat(101) })), 'employeeName');
  assert.strictEqual(rejectedField(valid({ response: 'agree' })), 'response');
  assert.strictEqual(rejectedField(valid({ policyVersion: '' })), 'policyVersion');
  assert.strictEqual(rejectedField(valid({ idempotencyToken: 'short' })), 'idempotencyToken');
  assert.strictEqual(rejectedField(valid({ website: 'http://spam' })), 'honeypot');
  assert.strictEqual(rejectedField(valid({ elapsedMs: 500 })), 'elapsedMs');
  assert.strictEqual(rejectedField(valid({ elapsedMs: '5000' })), 'elapsedMs');
});

test('validateAckSubmission falls back to English for an unknown language', () => {
  assert.strictEqual(validateAckSubmission(valid({ clientLang: 'xx' })).clientLang, 'en');
});

test('parseRosterText handles separators, headers, duplicates and bad lines', () => {
  const text = [
    'Employee ID, Name',
    'EMP-1, Ada Lovelace',
    'emp-2;Grace Hopper',
    'EMP-3\tAlan Turing',
    '',
    'Emp-1, Duplicate Ada',
    'EMP-4',
    'bad/id, Nobody',
  ].join('\r\n');
  const { employees, rejected } = parseRosterText(text);
  assert.deepStrictEqual(
    employees.map((e) => [e.employeeKey, e.name]),
    [
      ['emp-1', 'Ada Lovelace'],
      ['emp-2', 'Grace Hopper'],
      ['emp-3', 'Alan Turing'],
      ['emp-4', ''],
    ]
  );
  assert.deepStrictEqual(rejected, [8]);
  assert.deepStrictEqual(parseRosterText(undefined), { employees: [], rejected: [] });
});

// In-memory transaction double over a Map keyed by ref path.
function fakeTx(store) {
  return {
    get: async (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
    set: (ref, data) => store.set(ref.path, { ...data }),
    update: (ref, data) => store.set(ref.path, { ...store.get(ref.path), ...data }),
  };
}

const refs = (policyId, version, key) => ({
  ackRef: { path: `ack/${ackDocId({ policyId, policyVersion: version, employeeKey: key })}` },
  employeeRef: { path: `employees/${key}` },
});

const submit = (store, policyId, version, key, name = 'Ada') =>
  recordAcknowledgement(fakeTx(store), {
    ...refs(policyId, version, key),
    ack: { policyId, policyVersion: version, employeeKey: key, response: 'acknowledged' },
    employee: { employeeKey: key, employeeId: key.toUpperCase(), employeeName: name, onRoster: null },
    now: 'NOW',
  });

test('recordAcknowledgement dedupes per employee and policy version', async () => {
  const store = new Map();
  assert.deepStrictEqual(await submit(store, 'p1', '1.0', 'emp1'), { created: true });
  assert.deepStrictEqual(await submit(store, 'p1', '1.0', 'emp1', 'Renamed'), { created: false });

  const ackKeys = [...store.keys()].filter((k) => k.startsWith('ack/'));
  assert.strictEqual(ackKeys.length, 1);
  const employee = store.get('employees/emp1');
  assert.strictEqual(employee.acknowledgementCount, 1, 'a duplicate must not bump the count');
  assert.strictEqual(employee.employeeName, 'Ada', 'a duplicate must not rewrite the record');
});

test('a new policy version or a new policy is a fresh acknowledgement for the same employee', async () => {
  const store = new Map();
  await submit(store, 'p1', '1.0', 'emp1');
  assert.deepStrictEqual(await submit(store, 'p1', '2.0', 'emp1', 'Ada L.'), { created: true });
  assert.deepStrictEqual(await submit(store, 'p2', '1.0', 'emp1'), { created: true });

  assert.strictEqual([...store.keys()].filter((k) => k.startsWith('ack/')).length, 3);
  const employee = store.get('employees/emp1');
  assert.strictEqual(employee.acknowledgementCount, 3);
  assert.strictEqual(employee.lastPolicyId, 'p2');
  assert.strictEqual(employee.firstAcknowledgedAt, 'NOW');
});

test('the roster holds one document per distinct employee, however many policies they acknowledge', async () => {
  const store = new Map();
  for (const key of ['emp1', 'emp2', 'emp1', 'emp3']) {
    await submit(store, 'p1', '1.0', key);
    await submit(store, 'p2', '1.0', key);
  }
  const employees = [...store.keys()].filter((k) => k.startsWith('employees/'));
  assert.strictEqual(employees.length, 3);
});

test('countDistinctAcknowledgedEmployees runs one aggregation over the roster collection', async () => {
  const calls = [];
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        collection: (sub) => {
          const q = {
            where: (field, op, value) => {
              calls.push([name, id, sub, field, op, value]);
              return q;
            },
            count: () => ({ get: async () => ({ data: () => ({ count: 7 }) }) }),
          };
          return q;
        },
      }),
    }),
  };
  assert.strictEqual(await countDistinctAcknowledgedEmployees(db, 'c1'), 7);
  assert.strictEqual(calls.length, 0);
  await countDistinctAcknowledgedEmployees(db, 'c1', { sinceMs: 1000 });
  assert.deepStrictEqual(calls[0].slice(0, 5), ['companies', 'c1', 'policyEmployees', 'lastAcknowledgedAt', '>=']);
});
