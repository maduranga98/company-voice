const test = require('node:test');
const assert = require('node:assert');
const { getCaller, assertRole, assertCompany } = require('../utils/authz');

const as = (role, companyId = null, uid = 'u1') => ({ auth: { uid, token: { role, companyId } } });
const code = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.code;
  }
  return null;
};

test('requires authentication and a staff role claim', () => {
  assert.strictEqual(code(() => getCaller({})), 'unauthenticated');
  assert.strictEqual(code(() => getCaller({ auth: { uid: 'x', token: {} } })), 'unauthenticated');
  assert.strictEqual(code(() => getCaller(as('employee'))), 'unauthenticated');
  assert.deepStrictEqual(getCaller(as('HR', 'c1')), { uid: 'u1', role: 'hr', companyId: 'c1' });
});

test('assertRole', () => {
  assert.strictEqual(code(() => assertRole(as('hr', 'c1'), ['company_admin'])), 'permission-denied');
  assert.strictEqual(assertRole(as('company_admin', 'c1'), ['company_admin', 'super_admin']).role, 'company_admin');
});

test('assertCompany scopes to the caller company; super_admin is exempt', () => {
  assert.strictEqual(code(() => assertCompany(as('company_admin', 'c1'), 'c2')), 'permission-denied');
  assert.strictEqual(code(() => assertCompany(as('company_admin', 'c1'), undefined)), 'permission-denied');
  assert.strictEqual(code(() => assertCompany(as('company_admin', null), null)), 'permission-denied');
  assert.strictEqual(assertCompany(as('company_admin', 'c1'), 'c1').companyId, 'c1');
  assert.strictEqual(assertCompany(as('super_admin'), 'c9').role, 'super_admin');
});
