const test = require('node:test');
const assert = require('node:assert');
const { slugifyName, buildSlug, SLUG_PATTERN } = require('../utils/reportSlugs');

test('slugifyName strips accents, symbols and caps the length', () => {
  assert.strictEqual(slugifyName('Café Müller & Söhne GmbH'), 'cafe-muller-sohne-gmbh');
  assert.strictEqual(slugifyName('   '), 'company');
  assert.strictEqual(slugifyName('සමාගම'), 'company');
  assert.ok(slugifyName('A'.repeat(100)).length <= 30);
});

test('buildSlug matches the allowed pattern and is not just the name', () => {
  const slug = buildSlug('Acme Corp');
  assert.match(slug, SLUG_PATTERN);
  assert.match(slug, /^acme-corp-[0-9a-hjkmnp-tv-z]{4}$/);
});
