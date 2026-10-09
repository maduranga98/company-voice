/**
 * Authentication API
 * Server-side credential checking. Staff sign in with `login`, receive a Firebase custom token
 * whose uid is the users/{id} document id and whose claims are { role, companyId }; Firestore
 * and Storage rules authorize from those claims only.
 *
 * Never log usernames, passwords, hashes or IP addresses here.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { admin, db, FieldValue } = require('../config/firebase');
const { BASE_OPTIONS, clientIp } = require('../config/callableOptions');
const { IP_HASH_SALT } = require('../config/secrets');
const {
  hashPassword,
  verifyPassword,
  verifyAgainstDummy,
  validateNewPassword,
  MAX_PASSWORD,
} = require('../utils/passwords');
const { hashKey, consumeRateLimit } = require('../utils/rateLimit');
const { isLocked, recordFailure, clearFailures } = require('../utils/loginLimiter');
const { STAFF_ROLES, getCaller } = require('../utils/authz');

const IP_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 };
const MAX_USERNAME = 128;
const MAX_CANDIDATES = 5;

const invalidCredentials = () => new HttpsError('unauthenticated', 'Invalid username or password');
const tooManyAttempts = () =>
  new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return new Date(value).getTime() || 0;
};

/** Credential record for a user, falling back to a not-yet-migrated users.password hash. */
async function loadCredential(userDoc) {
  const credSnap = await db.collection('userCredentials').doc(userDoc.id).get();
  if (credSnap.exists) return credSnap.data();

  const legacy = userDoc.data().password;
  if (typeof legacy === 'string' && legacy) {
    return { algo: 'sha256-legacy', passwordHash: legacy, fromUserDoc: true };
  }
  return null;
}

/** Account-state checks. Only called after the password verified, so state is never leaked to guessers. */
async function accountStateError(user) {
  if (user.status === 'suspended') {
    const until = toMillis(user.suspendedUntil);
    if (until > Date.now()) {
      const days = Math.ceil((until - Date.now()) / (24 * 60 * 60 * 1000));
      const date = new Date(until).toISOString().slice(0, 10);
      return `Your account is suspended until ${date}. ${days} day(s) remaining. Reason: ${user.suspensionReason || 'Policy violation'}`;
    }
    // An expired suspension no longer blocks the login.
  } else if (user.status === 'invited') {
    return 'Your account is pending activation. Please check your email for the invitation link.';
  } else if (user.status !== 'active') {
    return 'Your account has been deactivated. Please contact your company administrator or support.';
  }

  if (!STAFF_ROLES.includes(user.role)) {
    return 'Your account has been deactivated. Please contact your company administrator or support.';
  }

  if (user.role !== 'super_admin') {
    if (!user.companyId) return 'Company not found. Please contact support.';
    const companySnap = await db.collection('companies').doc(user.companyId).get();
    if (!companySnap.exists) return 'Company not found. Please contact support.';
    if (companySnap.data().isActive !== true) {
      return 'Your company account is deactivated. Please contact support.';
    }
  }
  return null;
}

const login = onCall(
  {
    ...BASE_OPTIONS,
    secrets: [IP_HASH_SALT],
    // scrypt needs ~32 MiB per verification; cap concurrency to stay inside the instance.
    memory: '512MiB',
    concurrency: 8,
    timeoutSeconds: 30,
  },
  async (request) => {
    const { username, password } = request.data || {};
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      username.length > MAX_USERNAME ||
      !password ||
      password.length > MAX_PASSWORD * 2
    ) {
      throw invalidCredentials();
    }
    const normalized = username.trim().toLowerCase();
    const salt = IP_HASH_SALT.value();

    if (!(await consumeRateLimit(db, { hashedKey: hashKey(`login-ip:${clientIp(request)}`, salt), ...IP_LIMIT }))) {
      throw tooManyAttempts();
    }
    const userKey = hashKey(`login-user:${normalized}`, salt);
    if (await isLocked(db, userKey)) throw tooManyAttempts();

    try {
      const candidates = await db
        .collection('users')
        .where('username', '==', normalized)
        .limit(MAX_CANDIDATES)
        .get();

      let matched = null;
      let credential = null;
      let rehash = false;
      if (candidates.empty) {
        await verifyAgainstDummy(password);
      }
      for (const doc of candidates.docs) {
        const cred = await loadCredential(doc);
        if (!cred) {
          await verifyAgainstDummy(password);
          continue;
        }
        const result = await verifyPassword(password, cred);
        if (result.ok) {
          matched = doc;
          credential = cred;
          rehash = result.needsRehash;
          break;
        }
      }

      if (!matched) {
        await recordFailure(db, userKey);
        throw invalidCredentials();
      }

      const user = { id: matched.id, ...matched.data() };
      const stateError = await accountStateError(user);
      if (stateError) throw new HttpsError('failed-precondition', stateError);

      if (rehash) {
        const upgraded = await hashPassword(password);
        const batch = db.batch();
        batch.set(db.collection('userCredentials').doc(user.id), {
          ...upgraded,
          mustChangePassword: credential.mustChangePassword === true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (credential.fromUserDoc) {
          batch.update(matched.ref, { password: FieldValue.delete() });
        }
        await batch.commit();
      }

      const companyId = user.role === 'super_admin' ? null : user.companyId;
      const customToken = await admin.auth().createCustomToken(user.id, { role: user.role, companyId });

      await clearFailures(db, userKey);
      const update = { lastLogin: FieldValue.serverTimestamp() };
      if (user.status === 'suspended') update.status = 'active';
      await matched.ref.update(update);

      return {
        customToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName || null,
          email: user.email || null,
          role: user.role,
          companyId,
          mustChangePassword: credential.mustChangePassword === true || user.mustChangePassword === true,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('login: failed', { name: error && error.name, code: error && error.code });
      throw new HttpsError('internal', 'Could not sign in. Please try again.');
    }
  }
);

/**
 * Change the signed-in user's own password. Verifies the current password (throttled like login)
 * and signs the user out everywhere so existing sessions stop working.
 */
const changeOwnPassword = onCall(
  { ...BASE_OPTIONS, secrets: [IP_HASH_SALT], memory: '512MiB', concurrency: 8 },
  async (request) => {
    const { uid } = getCaller(request);
    const { currentPassword, newPassword } = request.data || {};
    if (typeof currentPassword !== 'string' || !validateNewPassword(newPassword)) {
      throw new HttpsError('invalid-argument', 'Invalid password.');
    }

    const key = hashKey(`password-user:${uid}`, IP_HASH_SALT.value());
    if (await isLocked(db, key)) throw tooManyAttempts();

    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists || userSnap.data().status !== 'active') {
      throw new HttpsError('permission-denied', 'Not allowed.');
    }
    const credential = await loadCredential(userSnap);
    const result = credential
      ? await verifyPassword(currentPassword, credential)
      : await verifyAgainstDummy(currentPassword);
    if (!result.ok) {
      await recordFailure(db, key);
      throw new HttpsError('permission-denied', 'The current password is incorrect.');
    }

    const batch = db.batch();
    batch.set(db.collection('userCredentials').doc(uid), {
      ...(await hashPassword(newPassword)),
      mustChangePassword: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(userSnap.ref, { mustChangePassword: false, password: FieldValue.delete() });
    await batch.commit();

    await clearFailures(db, key);
    await admin.auth().revokeRefreshTokens(uid);
    return { reloginRequired: true };
  }
);

module.exports = { login, changeOwnPassword };
