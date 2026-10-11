/**
 * Check My Case API
 * No-login case status and private replies, authenticated by case code + secret key
 * (never by Firebase Auth). The case code is not treated as secret (it identifies the
 * case the way a ticket number would); the secret key is the actual credential.
 *
 * Privacy rules for this file (same as publicReportApi.js):
 * - Never store or log the raw IP, secret key, case code or message content.
 * - Errors are logged by code only.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const CryptoJS = require('crypto-js');
const { db, FieldValue, serverTimestamp } = require('../config/firebase');
const { verifySecretKey } = require('../utils/caseKeys');
const { hashKey, consumeRateLimit } = require('../utils/rateLimit');
const { sanitizeText } = require('../utils/publicReportValidation');
const { isCaseProgressCheckAllowed } = require('../utils/companySettings');
const { computeCaseTimers } = require('../utils/caseTimers');
const { BASE_OPTIONS, clientIp } = require('../config/callableOptions');
const { ANONYMOUS_SECRET, CASE_KEY_PEPPER, IP_HASH_SALT } = require('../config/secrets');

const CASE_CODE_PATTERN = /^VW-[0-9A-Z]{4}-[0-9A-Z]{4}$/;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;
const VERIFY_LIMITS = { perIpPerHour: 20, hourMs: 60 * 60 * 1000 };
const REPLY_LIMITS = { perCasePerDay: 20, dayMs: 24 * 60 * 60 * 1000 };
const MAX_MESSAGE_LENGTH = 5000;

// One response for every failure so case codes and keys can't be enumerated or timed apart.
const invalidCredentials = () => new HttpsError('invalid-argument', 'Invalid case code or secret key.');
// Only ever thrown after the code + key have both been verified, so it tells nobody
// anything beyond what the holder of a valid pair already knows.
const featureDisabled = () =>
  new HttpsError('failed-precondition', 'Case status checking is turned off for this company.');
const locked = () => new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');
const rateLimited = () => new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');

function toIso(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
  return null;
}

/**
 * Verifies the case code + secret key against caseAccess/{caseCode}, applying the
 * per-case lockout (5 wrong attempts -> 30 min lock) and a per-IP attempt limit.
 * On success, clears the lockout counters and returns { caseRef, caseData, postRef, postData }.
 */
async function verifyCaseCredentials(request, { caseCode, secretKey }) {
  if (typeof caseCode !== 'string' || !CASE_CODE_PATTERN.test(caseCode)) throw invalidCredentials();
  if (typeof secretKey !== 'string' || secretKey.replace(/[^0-9A-Za-z]/g, '').length < 10) {
    throw invalidCredentials();
  }

  const salt = IP_HASH_SALT.value();
  const ipAllowed = await consumeRateLimit(db, {
    hashedKey: hashKey(`case-verify-ip:${clientIp(request)}`, salt),
    limit: VERIFY_LIMITS.perIpPerHour,
    windowMs: VERIFY_LIMITS.hourMs,
  });
  if (!ipAllowed) throw rateLimited();

  const caseRef = db.collection('caseAccess').doc(caseCode);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) throw invalidCredentials();
  const caseData = caseSnap.data();

  const now = Date.now();
  const lockedUntilMs = caseData.lockedUntil && caseData.lockedUntil.toMillis ? caseData.lockedUntil.toMillis() : null;
  if (lockedUntilMs && lockedUntilMs > now) throw locked();

  const ok = verifySecretKey(secretKey, caseData.keyHash, CASE_KEY_PEPPER.value());
  if (!ok) {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(caseRef);
      if (!snap.exists) return;
      const data = snap.data();
      const attempts = (data.failedAttempts || 0) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        tx.update(caseRef, { failedAttempts: 0, lockedUntil: new Date(now + LOCKOUT_MS) });
      } else {
        tx.update(caseRef, { failedAttempts: attempts });
      }
    });
    throw invalidCredentials();
  }

  if (caseData.failedAttempts || caseData.lockedUntil) {
    await caseRef.update({ failedAttempts: 0, lockedUntil: null }).catch(() => {});
  }

  // The case's companyId is already on the caseAccess doc, so the company is fetched in
  // parallel with the post (field-masked to `settings`): no extra sequential round trip.
  const postRef = db.collection('posts').doc(caseData.postId);
  const companyRef = caseData.companyId ? db.collection('companies').doc(caseData.companyId) : null;
  const [postSnap, companySnap] = await Promise.all([
    postRef.get(),
    companyRef ? db.getAll(companyRef, { fieldMask: ['settings'] }).then(([snap]) => snap) : null,
  ]);
  if (!postSnap.exists) throw invalidCredentials();

  let company = companySnap && companySnap.exists ? companySnap.data() : null;
  if (!companySnap && postSnap.data().companyId) {
    // Older caseAccess docs without a companyId.
    const [snap] = await db.getAll(db.collection('companies').doc(postSnap.data().companyId), {
      fieldMask: ['settings'],
    });
    company = snap.exists ? snap.data() : null;
  }
  if (!isCaseProgressCheckAllowed(company)) throw featureDisabled();

  return { caseRef, caseData, postRef, postData: postSnap.data() };
}

// ============================================
// A. getCaseStatus
// ============================================

const getCaseStatus = onCall(
  { ...BASE_OPTIONS, secrets: [CASE_KEY_PEPPER, IP_HASH_SALT] },
  async (request) => {
    const { caseCode, secretKey } = request.data || {};
    try {
      const { postData, postRef } = await verifyCaseCredentials(request, { caseCode, secretKey });

      const threadSnap = await db.collection('anonymousThreads').doc(postRef.id).get();
      const threadData = threadSnap.exists ? threadSnap.data() : null;

      return {
        status: postData.status || 'open',
        priority: postData.priority || 'medium',
        category: postData.category || 'other',
        type: postData.type || 'problem_report',
        involvesHR: postData.involvesHR === true,
        description: postData.description || '',
        createdAt: toIso(postData.createdAt),
        timers: computeCaseTimers(
          { status: postData.status, createdAtMs: postData.createdAt && postData.createdAt.toMillis ? postData.createdAt.toMillis() : Date.now() },
          threadData
        ),
        messages: threadData
          ? (threadData.messages || []).map((m) => ({
              id: m.id,
              sender: m.sender,
              encryptedContent: m.encryptedContent,
              timestamp: m.timestamp,
            }))
          : [],
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('getCaseStatus: failed', { name: error && error.name, code: error && error.code });
      throw new HttpsError('internal', 'Could not load the case.');
    }
  }
);

// ============================================
// B. submitCaseReply
// ============================================

async function notifyReplyStaff(companyId, postId, involvesHR) {
  try {
    const roles = involvesHR ? ['company_admin'] : ['company_admin', 'hr'];
    const users = await db
      .collection('users')
      .where('companyId', '==', companyId)
      .where('role', 'in', roles)
      .get();

    const batch = db.batch();
    users.docs
      .filter((u) => u.data().status === undefined || u.data().status === 'active')
      .forEach((u) => {
        batch.set(db.collection('notifications').doc(), {
          userId: u.id,
          type: 'case_reply',
          title: 'New reply on a case',
          message: 'The reporter replied on a case.',
          companyId,
          metadata: { postId },
          read: false,
          createdAt: serverTimestamp(),
        });
      });
    await batch.commit();
  } catch {
    logger.warn('submitCaseReply: staff notification failed');
  }
}

const submitCaseReply = onCall(
  { ...BASE_OPTIONS, secrets: [ANONYMOUS_SECRET, CASE_KEY_PEPPER, IP_HASH_SALT], memory: '256MiB' },
  async (request) => {
    const { caseCode, secretKey, message } = request.data || {};

    let text;
    try {
      text = sanitizeText(message, { multiline: true });
    } catch {
      throw new HttpsError('invalid-argument', 'Invalid message.');
    }
    if (!text || text.length > MAX_MESSAGE_LENGTH) {
      throw new HttpsError('invalid-argument', 'Invalid message.');
    }

    try {
      const { postRef, postData } = await verifyCaseCredentials(request, { caseCode, secretKey });

      const salt = IP_HASH_SALT.value();
      const allowed = await consumeRateLimit(db, {
        hashedKey: hashKey(`case-reply:${caseCode}`, salt),
        limit: REPLY_LIMITS.perCasePerDay,
        windowMs: REPLY_LIMITS.dayMs,
      });
      if (!allowed) throw rateLimited();

      const threadRef = db.collection('anonymousThreads').doc(postRef.id);
      const encryptedContent = CryptoJS.AES.encrypt(text, ANONYMOUS_SECRET.value()).toString();
      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        sender: 'reporter',
        encryptedContent,
        timestamp: new Date().toISOString(),
        read: false,
      };

      const threadSnap = await threadRef.get();
      if (threadSnap.exists) {
        await threadRef.update({
          messages: FieldValue.arrayUnion(entry),
          lastReporterActivity: serverTimestamp(),
        });
      } else {
        await threadRef.set({
          postId: postRef.id,
          companyId: postData.companyId,
          messages: [entry],
          lastReporterActivity: serverTimestamp(),
          lastInvestigatorActivity: null,
          lastReadBy: {},
          createdAt: serverTimestamp(),
        });
      }

      await notifyReplyStaff(postData.companyId, postRef.id, postData.involvesHR === true);

      return { success: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('submitCaseReply: failed', { name: error && error.name, code: error && error.code });
      throw new HttpsError('internal', 'Could not send the reply.');
    }
  }
);

module.exports = { getCaseStatus, submitCaseReply };
