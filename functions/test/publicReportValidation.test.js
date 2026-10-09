const test = require('node:test');
const assert = require('node:assert');
const {
  ValidationError,
  sanitizeText,
  validateSubmission,
  deriveTitle,
  sniffMime,
} = require('../utils/publicReportValidation');

const UPLOAD = 'abcdefghijklmnop';
const valid = () => ({
  slug: 'acme-corp-7k3m',
  type: 'concern',
  category: 'safety',
  description: 'The loading dock has no guard rail and someone will fall.',
  involvesHR: false,
  idempotencyToken: 'tok_abcdefghijklmnop',
  turnstileToken: 'cf-token',
  clientLang: 'fr',
});

const rejects = (patch, field) =>
  assert.throws(
    () => validateSubmission({ ...valid(), ...patch }),
    (err) => err instanceof ValidationError && (!field || err.field === field)
  );

test('accepts a valid submission and normalizes it', () => {
  const out = validateSubmission(valid());
  assert.strictEqual(out.involvesHR, false);
  assert.strictEqual(out.clientLang, 'fr');
  assert.deepStrictEqual(out.attachmentPaths, []);
  assert.strictEqual(out.contact, null);
});

test('rejects bad enums, short and long descriptions', () => {
  rejects({ type: 'complaint' }, 'type');
  rejects({ type: '__proto__' }, 'type');
  rejects({ category: 'nope' }, 'category');
  rejects({ description: 'too short' }, 'description');
  rejects({ description: 'x'.repeat(5001) }, 'description');
  rejects({ description: '<b>   </b>' + ' '.repeat(30) }, 'description');
  rejects({ slug: 'Bad Slug!' }, 'slug');
  rejects({ involvesHR: 'yes' }, 'involvesHR');
  rejects({ idempotencyToken: 'short' }, 'idempotencyToken');
});

test('strips HTML tags and control characters but keeps comparisons', () => {
  assert.strictEqual(sanitizeText('<script>alert(1)</script>hi'), 'alert(1)hi');
  assert.strictEqual(sanitizeText('a < b and c > d'), 'a < b and c > d');
  assert.strictEqual(sanitizeText('a\u0000b‮c'), 'abc');
  assert.strictEqual(sanitizeText('a\nb', { multiline: true }), 'a\nb');
  assert.strictEqual(sanitizeText('a\nb'), 'a b');
});

test('attachments: max 5, must live under the upload folder', () => {
  const p = (n) => ({ path: `public-reports/pending/${UPLOAD}/${n}.png` });
  const ok = validateSubmission({ ...valid(), uploadId: UPLOAD, attachments: [p(1), p(2)] });
  assert.strictEqual(ok.attachmentPaths.length, 2);

  rejects({ uploadId: UPLOAD, attachments: [1, 2, 3, 4, 5, 6].map(p) }, 'attachments');
  rejects({ uploadId: UPLOAD, attachments: [{ path: 'companies/other/cases/x/a.png' }] }, 'attachments');
  rejects({ uploadId: UPLOAD, attachments: [{ path: `public-reports/pending/otheruploadid1234/a.png` }] }, 'attachments');
  rejects({ uploadId: UPLOAD, attachments: [{ path: `public-reports/pending/${UPLOAD}/../x.png` }] }, 'attachments');
  rejects({ uploadId: UPLOAD, attachments: [p(1), p(1)] }, 'attachments');
  rejects({ attachments: [p(1)] }, 'uploadId');
});

test('contact fields are capped and email is checked', () => {
  const ok = validateSubmission({ ...valid(), contact: { name: 'A', email: 'a@b.co', phone: '' } });
  assert.deepStrictEqual(ok.contact, { name: 'A', email: 'a@b.co', phone: '' });
  assert.strictEqual(validateSubmission({ ...valid(), contact: { name: ' ', email: '', phone: '' } }).contact, null);
  rejects({ contact: { name: 'x'.repeat(101) } }, 'contact');
  rejects({ contact: { email: 'not-an-email' } }, 'contact');
  rejects({ contact: { phone: '1'.repeat(41) } }, 'contact');
});

test('deriveTitle cuts long text at a word boundary', () => {
  assert.strictEqual(deriveTitle('Short report'), 'Short report');
  const title = deriveTitle('word '.repeat(40));
  assert.ok(title.length <= 81 && title.endsWith('…'));
});

test('sniffMime recognises allowed signatures and rejects others', () => {
  const pad = (...b) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
  assert.strictEqual(sniffMime(pad(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.strictEqual(sniffMime(pad(0x89, 0x50, 0x4e, 0x47)), 'image/png');
  assert.strictEqual(sniffMime(Buffer.from('%PDF-1.7 .......')), 'application/pdf');
  assert.strictEqual(sniffMime(Buffer.from('RIFF....WEBPVP8 ')), 'image/webp');
  assert.strictEqual(sniffMime(pad(0x1a, 0x45, 0xdf, 0xa3)), 'audio/webm');
  assert.strictEqual(sniffMime(Buffer.from('....ftypM4A ....')), 'audio/mp4');
  assert.strictEqual(sniffMime(Buffer.from('MZ\x90\x00 not allowed....')), null);
});
