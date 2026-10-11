const test = require('node:test');
const assert = require('node:assert');
const { isCaseProgressCheckAllowed, buildSettingsUpdate } = require('../utils/companySettings');

test('case progress check defaults to on for companies without settings', () => {
  assert.strictEqual(isCaseProgressCheckAllowed(undefined), true);
  assert.strictEqual(isCaseProgressCheckAllowed({}), true);
  assert.strictEqual(isCaseProgressCheckAllowed({ settings: {} }), true);
  assert.strictEqual(isCaseProgressCheckAllowed({ settings: { allowCaseProgressCheck: true } }), true);
});

test('case progress check is off only when explicitly false', () => {
  assert.strictEqual(isCaseProgressCheckAllowed({ settings: { allowCaseProgressCheck: false } }), false);
  assert.strictEqual(isCaseProgressCheckAllowed({ settings: { allowCaseProgressCheck: null } }), true);
  assert.strictEqual(isCaseProgressCheckAllowed({ settings: { allowCaseProgressCheck: 0 } }), true);
});

test('buildSettingsUpdate returns dot-path updates for known boolean settings', () => {
  assert.deepStrictEqual(buildSettingsUpdate({ allowCaseProgressCheck: false }), {
    'settings.allowCaseProgressCheck': false,
  });
});

test('buildSettingsUpdate rejects bad payloads', () => {
  assert.throws(() => buildSettingsUpdate(null), TypeError);
  assert.throws(() => buildSettingsUpdate([]), TypeError);
  assert.throws(() => buildSettingsUpdate({}), TypeError);
  assert.throws(() => buildSettingsUpdate({ allowCaseProgressCheck: 'no' }), TypeError);
  assert.throws(() => buildSettingsUpdate({ isActive: false }), TypeError);
  assert.throws(() => buildSettingsUpdate({ __proto__: null, constructor: true }), TypeError);
});
