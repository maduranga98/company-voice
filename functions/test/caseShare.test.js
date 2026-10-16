const test = require('node:test');
const assert = require('node:assert');
const {
  ShareValidationError,
  validateShareInput,
  generateToken,
  hashToken,
  verifyToken,
  shareState,
  buildSnapshot,
  buildShareEmail,
} = require('../utils/caseShare');

const valid = () => ({ caseType: 'post', caseId: 'abc123', recipientEmail: ' Lawyer@Firm.COM ', expiresInDays: 7 });
const rejects = (patch, field) =>
  assert.throws(
    () => validateShareInput({ ...valid(), ...patch }),
    (e) => e instanceof ShareValidationError && e.field === field
  );

test('normalizes a valid share request and applies defaults', () => {
  const out = validateShareInput(valid());
  assert.strictEqual(out.recipientEmail, 'lawyer@firm.com');
  assert.deepStrictEqual(out.include, { notes: false, conversation: false, attachments: true });
  assert.strictEqual(validateShareInput({ ...valid(), expiresInDays: undefined }).expiresInDays, 14);
});

test('rejects bad inputs', () => {
  rejects({ caseType: 'other' }, 'caseType');
  rejects({ caseId: 'a/b' }, 'caseId');
  rejects({ recipientEmail: 'nope' }, 'recipientEmail');
  rejects({ expiresInDays: 0 }, 'expiresInDays');
  rejects({ expiresInDays: 31 }, 'expiresInDays');
  rejects({ expiresInDays: 1.5 }, 'expiresInDays');
});

test('tokens verify only against their own hash and pepper', () => {
  const token = generateToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const hash = hashToken(token, 'pepper');
  assert.ok(verifyToken(token, hash, 'pepper'));
  assert.ok(!verifyToken(token, hash, 'other'));
  assert.ok(!verifyToken(generateToken(), hash, 'pepper'));
  assert.ok(!verifyToken('short', hash, 'pepper'));
  assert.ok(!verifyToken(token, undefined, 'pepper'));
});

test('share state reflects expiry and revocation', () => {
  const now = 1_000_000;
  assert.strictEqual(shareState({ revoked: false, expiresAt: now + 1 }, now), 'active');
  assert.strictEqual(shareState({ revoked: false, expiresAt: now }, now), 'expired');
  assert.strictEqual(shareState({ revoked: true, expiresAt: now + 1000 }, now), 'revoked');
  assert.strictEqual(shareState(null, now), 'revoked');
});

test('post snapshot never carries reporter identity and honours include flags', () => {
  const post = {
    title: 'Dock',
    description: 'No guard rail',
    category: 'safety',
    type: 'problem_report',
    involvesHR: false,
    authorId: 'secret-author',
    authorName: 'Jane',
    authorEmail: 'jane@x.com',
    reporterContactEncrypted: 'ciphertext',
    attachments: [{ path: 'companies/c/cases/p/1-a.jpg', name: 'evidence-1.jpg', type: 'image/jpeg' }, { bad: true }],
  };
  const extras = { notes: [{ authorName: 'HR', text: 'checked', createdAt: null }], thread: { messages: [{ sender: 'reporter', content: 'hi', timestamp: 't' }] } };
  const off = buildSnapshot('post', post, extras, { notes: false, conversation: false, attachments: false });
  assert.deepStrictEqual([off.notes, off.conversation, off.attachments], [[], [], []]);
  const on = buildSnapshot('post', post, extras, { notes: true, conversation: true, attachments: true });
  assert.strictEqual(on.notes.length, 1);
  assert.strictEqual(on.conversation[0].sender, 'Reporter (anonymous)');
  assert.strictEqual(on.attachments.length, 1);
  const json = JSON.stringify(on);
  for (const leak of ['secret-author', 'Jane', 'jane@x.com', 'ciphertext']) assert.ok(!json.includes(leak), leak);
});

test('vendor snapshot keeps only https evidence links', () => {
  const snap = buildSnapshot(
    'vendor',
    { vendorName: 'ABC', referenceCode: 'VXW-2026-0001', riskCategory: 'labor', severity: 'high', description: 'x', authorId: 'AUTHOR-X1', attachmentUrls: ['https://f/1', 'javascript:alert(1)'] },
    { corroborations: [{ relationship: 'witness', account: 'saw it', authorId: 'AUTHOR-X2' }] },
    { notes: false, conversation: false, attachments: true }
  );
  assert.strictEqual(snap.reference, 'VXW-2026-0001');
  assert.strictEqual(snap.attachments.length, 1);
  assert.ok(!JSON.stringify(snap).includes('AUTHOR-X'));
});

test('email escapes user text', () => {
  const { html } = buildShareEmail({
    companyName: 'A<b>', recipientName: '<script>x</script>', senderName: 'S', message: '<img src=x>', link: 'https://x/shared/1#t', expiresAt: new Date('2026-12-01'), title: 'T',
  });
  assert.ok(!html.includes('<script>') && !html.includes('<img'));
  assert.ok(html.includes('2026-12-01'));
});
