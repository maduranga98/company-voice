/**
 * Authorization from server-minted custom claims ({ role, companyId }).
 * Works with v2 requests (request.auth) and v1 contexts (context.auth).
 * The uid of every staff Firebase Auth user is the users/{id} document id.
 */

const { HttpsError } = require('firebase-functions/v2/https');

const STAFF_ROLES = ['super_admin', 'company_admin', 'hr'];

const norm = (value) => (typeof value === 'string' ? value.toLowerCase() : null);

/** @returns {{uid: string, role: string, companyId: string|null}} */
function getCaller(requestOrContext) {
  const auth = requestOrContext && requestOrContext.auth;
  const role = auth && auth.token ? norm(auth.token.role) : null;
  if (!auth || !auth.uid || !STAFF_ROLES.includes(role)) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  return { uid: auth.uid, role, companyId: auth.token.companyId || null };
}

/** Throws unless the caller holds one of `roles`. Returns the caller. */
function assertRole(requestOrContext, roles) {
  const caller = getCaller(requestOrContext);
  if (!roles.map(norm).includes(caller.role)) {
    throw new HttpsError('permission-denied', 'Not allowed.');
  }
  return caller;
}

/** Throws unless the caller is super_admin or belongs to `companyId`. */
function assertCompany(requestOrContext, companyId) {
  const caller = getCaller(requestOrContext);
  if (caller.role !== 'super_admin' && (!companyId || caller.companyId !== companyId)) {
    throw new HttpsError('permission-denied', 'Not allowed.');
  }
  return caller;
}

module.exports = { STAFF_ROLES, getCaller, assertRole, assertCompany };
