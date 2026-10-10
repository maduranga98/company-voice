/**
 * User management API (staff accounts).
 * Every callable verifies the caller from custom claims, re-checks the caller's users/{uid}
 * document (so a stale token cannot outlive a suspension or role change), and enforces company
 * scoping server-side. Clients can no longer write privileged user fields (role, status,
 * companyId, username, credentials); they go through these functions.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { Timestamp } = require('firebase-admin/firestore');
const { admin, db, FieldValue } = require('../config/firebase');
const { BASE_OPTIONS } = require('../config/callableOptions');
const { STAFF_ROLES, getCaller } = require('../utils/authz');
const {
  hashPassword,
  validateNewPassword,
  generateTemporaryPassword,
} = require('../utils/passwords');
const { sanitizeText } = require('../utils/publicReportValidation');

const OPTIONS = { ...BASE_OPTIONS, memory: '512MiB', concurrency: 8, timeoutSeconds: 60 };

const USERNAME_PATTERN = /^[a-z0-9._-]{3,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SETTABLE_STATUSES = ['active', 'suspended', 'deactivated', 'removed', 'rejected'];
const MAX_DELETE_BATCH = 100;

const invalid = (message = 'Invalid request.') => new HttpsError('invalid-argument', message);
const denied = () => new HttpsError('permission-denied', 'Not allowed.');

/** Caller from claims, confirmed against the live users document. */
async function loadCaller(request, allowedRoles) {
  const caller = getCaller(request);
  if (!allowedRoles.includes(caller.role)) throw denied();

  const snap = await db.collection('users').doc(caller.uid).get();
  const user = snap.exists ? snap.data() : null;
  if (!user || user.status !== 'active' || user.role !== caller.role || (user.companyId || null) !== caller.companyId) {
    throw denied();
  }
  return caller;
}

async function loadTarget(userId) {
  if (typeof userId !== 'string' || !userId || userId.includes('/')) throw invalid();
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'User not found.');
  return { id: snap.id, ref: snap.ref, ...snap.data() };
}

/**
 * Whether `caller` may manage `target`. Never self, never a super_admin, company-scoped.
 * company_admin manages hr users and, for role changes, other company admins.
 */
function assertCanManage(caller, target, { allowAdmins = false } = {}) {
  if (target.id === caller.uid || target.role === 'super_admin') throw denied();
  if (caller.role === 'super_admin') return;
  if (caller.role !== 'company_admin' || !caller.companyId || target.companyId !== caller.companyId) {
    throw denied();
  }
  if (target.role === 'company_admin' && !allowAdmins) throw denied();
}

async function revokeSessions(uid) {
  try {
    await admin.auth().revokeRefreshTokens(uid);
  } catch (error) {
    // A user who never signed in has no Auth record, so there is nothing to revoke.
    if (!error || error.code !== 'auth/user-not-found') throw error;
  }
}

async function setClaims(uid, claims) {
  try {
    await admin.auth().setCustomUserClaims(uid, claims);
  } catch (error) {
    if (!error || error.code !== 'auth/user-not-found') throw error;
  }
}

async function deleteAuthUser(uid) {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    if (!error || error.code !== 'auth/user-not-found') throw error;
  }
}

function parseNewUser(data) {
  const username = typeof data.username === 'string' ? data.username.trim().toLowerCase() : '';
  const displayName = sanitizeText(data.displayName);
  const email = sanitizeText(data.email);
  if (!USERNAME_PATTERN.test(username)) throw invalid('Username must be 3 to 64 letters, numbers, dots, dashes or underscores.');
  if (!displayName || displayName.length > 100) throw invalid('A display name is required.');
  if (email && (email.length > 200 || !EMAIL_PATTERN.test(email))) throw invalid('Invalid email address.');
  return { username, displayName, email };
}

/** Creates the user and credential atomically; fails when the username is taken. */
async function createUserWithCredential({ fields, password, mustChangePassword, extra = [] }) {
  const credential = await hashPassword(password);
  const userRef = db.collection('users').doc();

  await db.runTransaction(async (tx) => {
    const taken = await tx.get(db.collection('users').where('username', '==', fields.username).limit(1));
    if (!taken.empty) throw new HttpsError('already-exists', 'That username is already taken.');

    tx.set(userRef, {
      ...fields,
      status: 'active',
      mustChangePassword,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection('userCredentials').doc(userRef.id), {
      ...credential,
      mustChangePassword,
      updatedAt: FieldValue.serverTimestamp(),
    });
    extra.forEach(([ref, data]) => tx.set(ref, data));
  });
  return userRef.id;
}

function resolvePassword(supplied) {
  if (supplied === undefined || supplied === null || supplied === '') {
    return { password: generateTemporaryPassword(), generated: true };
  }
  if (!validateNewPassword(supplied)) throw invalid('Password must be 8 to 128 characters.');
  return { password: supplied, generated: false };
}

// ============================================
// createStaffUser
// ============================================

const createStaffUser = onCall(OPTIONS, async (request) => {
  const caller = await loadCaller(request, ['super_admin', 'company_admin']);
  const data = request.data || {};
  const { username, displayName, email } = parseNewUser(data);

  let role;
  let companyId;
  if (caller.role === 'company_admin') {
    role = 'hr';
    companyId = caller.companyId;
    if (data.role !== undefined && data.role !== 'hr') throw denied();
  } else {
    role = data.role;
    companyId = data.companyId;
    if (!['company_admin', 'hr'].includes(role)) throw denied();
    if (typeof companyId !== 'string' || !companyId) throw invalid();
    if (!(await db.collection('companies').doc(companyId).get()).exists) {
      throw new HttpsError('not-found', 'Company not found.');
    }
  }

  const { password, generated } = resolvePassword(data.password);
  const userId = await createUserWithCredential({
    fields: { username, displayName, email, role, companyId, createdBy: caller.uid },
    password,
    mustChangePassword: generated,
  });

  return { userId, username, ...(generated ? { temporaryPassword: password } : {}) };
});

// ============================================
// createCompanyWithAdmin (super admin onboarding)
// ============================================

const createCompanyWithAdmin = onCall(OPTIONS, async (request) => {
  const caller = await loadCaller(request, ['super_admin']);
  const data = request.data || {};
  const { username, displayName, email } = parseNewUser({
    username: data.username,
    displayName: data.adminName,
    email: data.adminEmail,
  });
  const companyName = sanitizeText(data.companyName);
  const industry = sanitizeText(data.industry);
  if (!companyName || companyName.length > 150 || industry.length > 100) throw invalid();
  const { password, generated } = resolvePassword(data.password);

  const companyRef = db.collection('companies').doc();
  const userId = await createUserWithCredential({
    fields: { username, displayName, email, role: 'company_admin', companyId: companyRef.id, createdBy: caller.uid },
    password,
    mustChangePassword: generated,
    extra: [
      [
        companyRef,
        {
          name: companyName,
          industry,
          isActive: true,
          subscriptionStatus: 'trial',
          employeeCount: 1,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
      ],
    ],
  });

  return { companyId: companyRef.id, userId, ...(generated ? { temporaryPassword: password } : {}) };
});

// ============================================
// setUserStatus
// ============================================

const setUserStatus = onCall(OPTIONS, async (request) => {
  const caller = await loadCaller(request, ['super_admin', 'company_admin', 'hr']);
  const { userId, status, reason, suspendedUntil, hadPosts } = request.data || {};
  if (!SETTABLE_STATUSES.includes(status)) throw invalid();

  const target = await loadTarget(userId);
  if (caller.role === 'hr') {
    // Moderation: HR may suspend company members who are not admins (legacy employee accounts).
    if (status !== 'suspended' || target.companyId !== caller.companyId || target.id === caller.uid
      || ['super_admin', 'company_admin', 'hr'].includes(target.role)) {
      throw denied();
    }
  } else {
    assertCanManage(caller, target);
  }

  const update = { status, updatedAt: FieldValue.serverTimestamp() };
  const cleanReason = sanitizeText(reason).slice(0, 500);

  if (status === 'suspended') {
    const until = new Date(suspendedUntil);
    if (!suspendedUntil || Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      throw invalid('A future suspension end date is required.');
    }
    Object.assign(update, {
      suspendedAt: FieldValue.serverTimestamp(),
      suspendedUntil: Timestamp.fromDate(until),
      suspensionReason: cleanReason || 'Policy violation',
      suspendedBy: caller.uid,
    });
  } else if (status === 'active') {
    Object.assign(update, {
      suspendedAt: FieldValue.delete(),
      suspendedUntil: FieldValue.delete(),
      suspensionReason: FieldValue.delete(),
      suspendedBy: FieldValue.delete(),
    });
  } else {
    update.statusReason = cleanReason || null;
    if (status === 'removed') {
      update.removedAt = FieldValue.serverTimestamp();
      update.hadPosts = hadPosts === true;
    }
  }

  await target.ref.update(update);
  if (status !== 'active') await revokeSessions(target.id);
  return { userId: target.id, status };
});

// ============================================
// changeUserRole
// ============================================

const changeUserRole = onCall(OPTIONS, async (request) => {
  const caller = await loadCaller(request, ['super_admin', 'company_admin']);
  const { userId, role } = request.data || {};
  if (!['company_admin', 'hr'].includes(role)) throw denied();

  const target = await loadTarget(userId);
  assertCanManage(caller, target, { allowAdmins: true });
  if (!STAFF_ROLES.includes(target.role)) throw denied();
  if (target.role === role) return { userId: target.id, role };

  await target.ref.update({ role, updatedAt: FieldValue.serverTimestamp() });
  await setClaims(target.id, { role, companyId: target.companyId || null });
  await revokeSessions(target.id);
  return { userId: target.id, role };
});

// ============================================
// resetStaffPassword
// ============================================

const resetStaffPassword = onCall(OPTIONS, async (request) => {
  const caller = await loadCaller(request, ['super_admin', 'company_admin']);
  const target = await loadTarget((request.data || {}).userId);
  assertCanManage(caller, target, { allowAdmins: caller.role === 'super_admin' });

  const temporaryPassword = generateTemporaryPassword();
  const batch = db.batch();
  batch.set(db.collection('userCredentials').doc(target.id), {
    ...(await hashPassword(temporaryPassword)),
    mustChangePassword: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(target.ref, { mustChangePassword: true, password: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();

  await revokeSessions(target.id);
  return { userId: target.id, temporaryPassword };
});

// ============================================
// deleteRemovedUsers / deleteCompany
// ============================================

async function purgeUsers(refs) {
  const writer = db.bulkWriter();
  refs.forEach((ref) => {
    writer.delete(ref);
    writer.delete(db.collection('userCredentials').doc(ref.id));
  });
  await writer.close();
  await Promise.all(refs.map((ref) => deleteAuthUser(ref.id)));
}

const deleteRemovedUsers = onCall(OPTIONS, async (request) => {
  const caller = await loadCaller(request, ['super_admin', 'company_admin']);
  const { userIds } = request.data || {};
  if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > MAX_DELETE_BATCH) throw invalid();

  const targets = [];
  for (const id of userIds) {
    const target = await loadTarget(id);
    assertCanManage(caller, target);
    if (target.status !== 'removed') throw invalid('Only removed members can be deleted.');
    targets.push(target);
  }
  await purgeUsers(targets.map((t) => t.ref));
  return { deleted: targets.length };
});

const deleteCompany = onCall(OPTIONS, async (request) => {
  await loadCaller(request, ['super_admin']);
  const { companyId } = request.data || {};
  if (typeof companyId !== 'string' || !companyId || companyId.includes('/')) throw invalid();

  const companyRef = db.collection('companies').doc(companyId);
  if (!(await companyRef.get()).exists) throw new HttpsError('not-found', 'Company not found.');

  const users = await db.collection('users').where('companyId', '==', companyId).get();
  const slugs = await db.collection('reportSlugs').where('companyId', '==', companyId).get();
  await purgeUsers(users.docs.map((d) => d.ref));
  await Promise.all(slugs.docs.map((d) => d.ref.delete()));
  await companyRef.delete();

  logger.info('deleteCompany: done', { users: users.size });
  return { deletedUsers: users.size };
});

module.exports = {
  createStaffUser,
  createCompanyWithAdmin,
  setUserStatus,
  changeUserRole,
  resetStaffPassword,
  deleteRemovedUsers,
  deleteCompany,
};
