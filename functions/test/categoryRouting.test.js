const test = require('node:test');
const assert = require('node:assert');
const {
  validateCategoryName,
  validateCategoryDescription,
  validateAssigneeShape,
  resolveCategoryRouting,
  getActiveCategories,
  getSubmittableCategory,
  CategoryValidationError,
} = require('../utils/categoryRouting');
const { seedCompany } = require('../utils/categorySeed');
const { createFakeDb } = require('./helpers/fakeFirestore');

const fails = (fn, field, reason) =>
  assert.throws(fn, (e) => e instanceof CategoryValidationError && e.field === field && e.reason === reason);

test('category name: trimmed, whitespace collapsed, canonical key is case-insensitive', () => {
  assert.deepStrictEqual(validateCategoryName('  Pay   &  Benefits '), { name: 'Pay & Benefits', nameKey: 'pay & benefits' });
  assert.strictEqual(validateCategoryName('SAFETY').nameKey, validateCategoryName('safety').nameKey);
});

test('category name: empty, markup-only and over-long names are rejected', () => {
  fails(() => validateCategoryName(''), 'name', 'required');
  fails(() => validateCategoryName('   '), 'name', 'required');
  fails(() => validateCategoryName('<b></b>'), 'name', 'required');
  fails(() => validateCategoryName(undefined), 'name', 'required');
  fails(() => validateCategoryName(42), 'name', 'required');
  assert.strictEqual(validateCategoryName('a'.repeat(60)).name.length, 60);
  fails(() => validateCategoryName('a'.repeat(61)), 'name', 'too_long');
});

test('category name: HTML is stripped, not stored', () => {
  assert.strictEqual(validateCategoryName('Safety <script>x</script>').name, 'Safety x');
});

test('category description is optional and capped', () => {
  assert.strictEqual(validateCategoryDescription(undefined), '');
  assert.strictEqual(validateCategoryDescription(null), '');
  fails(() => validateCategoryDescription(5), 'description', 'invalid');
  fails(() => validateCategoryDescription('x'.repeat(201)), 'description', 'too_long');
});

test('assignee shape: only user or role, roles limited to hr / company_admin', () => {
  validateAssigneeShape('user', 'u1');
  validateAssigneeShape('role', 'hr');
  validateAssigneeShape('role', 'company_admin');
  fails(() => validateAssigneeShape('team', 'x'), 'assigneeType', 'invalid');
  fails(() => validateAssigneeShape('role', 'super_admin'), 'assigneeId', 'invalid_role');
  fails(() => validateAssigneeShape('user', ''), 'assigneeId', 'invalid');
  fails(() => validateAssigneeShape('user', 'a/b'), 'assigneeId', 'invalid');
  fails(() => validateAssigneeShape('user', undefined), 'assigneeId', 'invalid');
});

function company(extra = {}) {
  return {
    'companies/c1': { name: 'Acme', defaultRoutingAssigneeType: 'role', defaultRoutingAssigneeId: 'hr', ...extra },
    'users/admin1': { companyId: 'c1', role: 'company_admin', status: 'active', displayName: 'Ada Admin' },
    'users/hr1': { companyId: 'c1', role: 'hr', status: 'active', displayName: 'Hal HR' },
    'users/hr2': { companyId: 'c1', role: 'hr', status: 'suspended', displayName: 'Sue Suspended' },
    'users/otherHr': { companyId: 'c2', role: 'hr', status: 'active', displayName: 'Other Co HR' },
  };
}
const withRule = (categoryId, rule) => ({ [`companies/c1/routingRules/${categoryId}`]: { categoryId, isActive: true, ...rule } });
const resolve = (db, extra = {}) => resolveCategoryRouting(db, 'c1', { categoryId: 'safety', categoryName: 'Safety', ...extra });

test('routing: a category rule to an active user wins', async () => {
  const db = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'user', assigneeId: 'admin1' }) });
  const r = await resolve(db);
  assert.strictEqual(r.source, 'rule');
  assert.deepStrictEqual(r.assignment, { type: 'user', id: 'admin1', name: 'Ada Admin' });
  assert.strictEqual(r.roleAssignment, null);
});

test('routing: a role rule resolves to the active members only', async () => {
  const db = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'role', assigneeId: 'hr' }) });
  const r = await resolve(db);
  assert.strictEqual(r.source, 'rule');
  assert.strictEqual(r.assignment, null);
  assert.deepStrictEqual(r.roleAssignment, { role: 'hr', userIds: ['hr1'] });
});

test('routing: no rule for the category uses the company default', async () => {
  const r = await resolve(createFakeDb(company()));
  assert.strictEqual(r.source, 'default');
  assert.deepStrictEqual(r.roleAssignment, { role: 'hr', userIds: ['hr1'] });
});

test('routing: inactive rule is ignored', async () => {
  const db = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'user', assigneeId: 'admin1', isActive: false }) });
  assert.strictEqual((await resolve(db)).source, 'default');
});

test('routing: a rule whose assignee is suspended falls back to the default', async () => {
  const db = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'user', assigneeId: 'hr2' }) });
  assert.strictEqual((await resolve(db)).source, 'default');
});

test('routing: a rule whose assignee no longer exists falls back to the default', async () => {
  const db = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'user', assigneeId: 'gone' }) });
  assert.strictEqual((await resolve(db)).source, 'default');
});

test('routing: an assignee from another company is never used', async () => {
  const db = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'user', assigneeId: 'otherHr' }) });
  const r = await resolve(db);
  assert.strictEqual(r.source, 'default');
  assert.ok(!JSON.stringify(r).includes('otherHr'));
});

test('routing: a role with no active members falls back to the default', async () => {
  const data = company();
  delete data['users/hr1'];
  const db = createFakeDb({ ...data, ...withRule('safety', { assigneeType: 'role', assigneeId: 'hr' }) });
  const r = await resolve(db);
  // default is also role hr -> unresolvable, so the company admin is the last resort
  assert.strictEqual(r.source, 'admin_fallback');
  assert.strictEqual(r.assignment.id, 'admin1');
});

test('routing: unset default falls back to the first active company admin', async () => {
  const db = createFakeDb(company({ defaultRoutingAssigneeType: null, defaultRoutingAssigneeId: null }));
  const r = await resolve(db);
  assert.strictEqual(r.source, 'admin_fallback');
  assert.strictEqual(r.assignment.id, 'admin1');
});

test('routing: nothing resolvable returns null instead of throwing', async () => {
  const data = company({ defaultRoutingAssigneeType: null, defaultRoutingAssigneeId: null });
  delete data['users/admin1'];
  assert.strictEqual(await resolve(createFakeDb(data)), null);
});

test('routing: a case involving HR is never routed to HR, even via an explicit rule', async () => {
  const toUser = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'user', assigneeId: 'hr1' }) });
  const a = await resolve(toUser, { involvesHR: true });
  assert.strictEqual(a.source, 'admin_fallback');
  assert.strictEqual(a.assignment.id, 'admin1');

  const toRole = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'role', assigneeId: 'hr' }) });
  const b = await resolve(toRole, { involvesHR: true });
  assert.strictEqual(b.assignment.id, 'admin1');
  assert.strictEqual(b.roleAssignment, null);
});

test('routing: involving-HR cases can still go to a company admin by rule', async () => {
  const db = createFakeDb({ ...company(), ...withRule('safety', { assigneeType: 'role', assigneeId: 'company_admin' }) });
  const r = await resolve(db, { involvesHR: true });
  assert.strictEqual(r.source, 'rule');
  assert.deepStrictEqual(r.roleAssignment, { role: 'company_admin', userIds: ['admin1'] });
});

test('routing: a hostile category id cannot escape the rules collection', async () => {
  const db = createFakeDb(company());
  const r = await resolveCategoryRouting(db, 'c1', { categoryId: '../../users/admin1' });
  assert.strictEqual(r.source, 'default');
});

test('routing: a lookup failure returns null, never throws', async () => {
  const broken = { collection() { throw new Error('boom'); } };
  const original = console.error;
  console.error = () => {};
  try {
    assert.strictEqual(await resolveCategoryRouting(broken, 'c1', { categoryId: 'safety' }), null);
  } finally {
    console.error = original;
  }
});

test('form categories: only active, non-system ones, in order', async () => {
  const db = createFakeDb({
    ...company(),
    'companies/c1/categories/b': { name: 'Bravo', isActive: true, isSystemDefined: false, order: 1, i18nKey: 'safety' },
    'companies/c1/categories/a': { name: 'Alpha', isActive: true, isSystemDefined: false, order: 0 },
    'companies/c1/categories/off': { name: 'Off', isActive: false, isSystemDefined: false, order: 2 },
    'companies/c1/categories/vendor_risk': { name: 'Vendor Risk', isActive: true, isSystemDefined: true, order: 1000000 },
  });
  assert.deepStrictEqual(await getActiveCategories(db, 'c1'), [
    { id: 'a', name: 'Alpha', i18nKey: null },
    { id: 'b', name: 'Bravo', i18nKey: 'safety' },
  ]);
});

test('submission accepts only an active, non-system category of that company', async () => {
  const db = createFakeDb({
    ...company(),
    'companies/c1/categories/a': { name: 'Alpha', isActive: true, isSystemDefined: false },
    'companies/c1/categories/off': { name: 'Off', isActive: false, isSystemDefined: false },
    'companies/c1/categories/vendor_risk': { name: 'Vendor Risk', isActive: true, isSystemDefined: true },
    'companies/c2/categories/theirs': { name: 'Theirs', isActive: true, isSystemDefined: false },
  });
  assert.deepStrictEqual(await getSubmittableCategory(db, 'c1', 'a'), { id: 'a', name: 'Alpha' });
  assert.strictEqual(await getSubmittableCategory(db, 'c1', 'off'), null);
  assert.strictEqual(await getSubmittableCategory(db, 'c1', 'vendor_risk'), null);
  assert.strictEqual(await getSubmittableCategory(db, 'c1', 'theirs'), null);
  assert.strictEqual(await getSubmittableCategory(db, 'c1', 'missing'), null);
  assert.strictEqual(await getSubmittableCategory(db, 'c1', 'a/b'), null);
  assert.strictEqual(await getSubmittableCategory(db, 'c1', undefined), null);
});

test('seed: creates the default categories, locked Vendor Risk and an HR role default', async () => {
  const db = createFakeDb({ 'companies/c1': { name: 'Acme' }, ...pick(company(), ['users/admin1', 'users/hr1']) });
  const res = await seedCompany(db, 'c1', { now: 'NOW' });
  assert.strictEqual(res.categoriesSeeded, 9);
  assert.deepStrictEqual(res.defaultAssignee, { type: 'role', id: 'hr' });

  const cats = db.dump('companies/c1/categories');
  assert.strictEqual(Object.keys(cats).length, 9);
  assert.strictEqual(cats.harassment.i18nKey, 'harassment');
  assert.strictEqual(cats.harassment.isSystemDefined, false);
  assert.strictEqual(cats.vendor_risk.isSystemDefined, true);
  assert.strictEqual(cats.vendor_risk.i18nKey, undefined);
  const c = db.dump('companies')['c1'];
  assert.strictEqual(c.defaultRoutingAssigneeType, 'role');
  assert.strictEqual(c.categoriesSeededAt, 'NOW');
});

test('seed: no HR -> the company admin becomes the default', async () => {
  const db = createFakeDb({ 'companies/c1': { name: 'Acme' }, ...pick(company(), ['users/admin1', 'users/hr2']) });
  const res = await seedCompany(db, 'c1', { now: 'NOW' });
  assert.deepStrictEqual(res.defaultAssignee, { type: 'user', id: 'admin1' });
});

test('seed: idempotent, and never overwrites an admin edit or an existing default', async () => {
  const db = createFakeDb({ 'companies/c1': { name: 'Acme' }, ...pick(company(), ['users/admin1', 'users/hr1']) });
  await seedCompany(db, 'c1', { now: 'NOW' });
  db.patch('companies/c1/categories/safety', { name: 'Site safety', isActive: false });
  db.patch('companies/c1', { defaultRoutingAssigneeType: 'user', defaultRoutingAssigneeId: 'admin1' });

  const again = await seedCompany(db, 'c1', { now: 'LATER' });
  assert.strictEqual(again.categoriesSeeded, 0);
  assert.strictEqual(db.dump('companies/c1/categories').safety.name, 'Site safety');
  assert.strictEqual(db.dump('companies/c1/categories').safety.isActive, false);
  assert.strictEqual(db.dump('companies')['c1'].defaultRoutingAssigneeId, 'admin1');
  assert.strictEqual(db.dump('companies')['c1'].categoriesSeededAt, 'NOW');
});

test('seed: dry run writes nothing', async () => {
  const db = createFakeDb({ 'companies/c1': { name: 'Acme' }, ...pick(company(), ['users/hr1']) });
  const res = await seedCompany(db, 'c1', { now: 'NOW', dryRun: true });
  assert.strictEqual(res.categoriesSeeded, 9);
  assert.deepStrictEqual(db.dump('companies/c1/categories'), {});
  assert.strictEqual(db.dump('companies')['c1'].categoriesSeededAt, undefined);
});

test('seed: unknown company is skipped', async () => {
  const res = await seedCompany(createFakeDb({}), 'nope', { now: 'NOW' });
  assert.strictEqual(res.skipped, 'company_not_found');
});

function pick(obj, keys) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}
