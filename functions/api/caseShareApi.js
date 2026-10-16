/**
 * Case sharing with outside counsel.
 *
 * Staff finalize a case into a frozen snapshot and send a lawyer a private link. The lawyer
 * opens a read-only page without an account (token in the URL fragment, never sent to a
 * server as part of a page load) and can download a PDF from it.
 *
 * Storage:
 * - caseShares/{id}          metadata staff can list (no snapshot, no token hash)
 * - caseShareSnapshots/{id}  snapshot + token HMAC (Admin SDK only)
 *
 * Privacy rules for this file:
 * - Snapshots are built from an allow-list (see utils/caseShare.js): no reporter identity.
 * - Never log tokens, links, snapshot content or recipient addresses; errors by code only.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { admin, db, serverTimestamp, FieldValue } = require('../config/firebase');
const { assertRole, assertCompany } = require('../utils/authz');
const { hashKey, consumeRateLimit } = require('../utils/rateLimit');
const {
  SHARE_ID_PATTERN,
  ShareValidationError,
  validateShareInput,
  generateToken,
  hashToken,
  verifyToken,
  addDays,
  shareState,
  buildSnapshot,
  buildShareEmail,
} = require('../utils/caseShare');
const { BASE_OPTIONS, clientIp } = require('../config/callableOptions');
const { CASE_KEY_PEPPER, IP_HASH_SALT } = require('../config/secrets');

const APP_URL = () => (process.env.PUBLIC_APP_URL || 'https://portal.voxwel.com').replace(/\/+$/, '');
const VIEW_LIMITS = { perIpPerHour: 60, hourMs: 60 * 60 * 1000 };
const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

// One response for every "can't open this" case so links can't be probed.
const unavailable = () => new HttpsError('not-found', 'This link is not available.');

const STAFF = ['company_admin', 'hr'];

const collectionFor = (caseType) => (caseType === 'vendor' ? 'vendorReports' : 'posts');

/** Loads the case and enforces company + HR visibility, mirroring firestore.rules. */
async function loadAuthorizedCase(caller, caseType, caseId) {
  const snap = await db.collection(collectionFor(caseType)).doc(caseId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Case not found.');
  const data = snap.data();
  if (caller.role !== 'super_admin' && data.companyId !== caller.companyId) {
    throw new HttpsError('permission-denied', 'Not allowed.');
  }
  if (caller.role === 'hr') {
    const hidden = caseType === 'vendor' ? data.visibility === 'restricted' : data.involvesHR !== false;
    if (hidden) throw new HttpsError('permission-denied', 'Not allowed.');
  }
  return data;
}

async function loadExtras(caseType, caseId, companyId, include) {
  const extras = {};
  if (include.notes) {
    if (caseType === 'vendor') {
      const notes = await db
        .collection('caseNotes')
        .where('companyId', '==', companyId)
        .where('caseId', '==', caseId)
        .get();
      extras.notes = notes.docs.map((d) => d.data()).filter((n) => n.caseType === 'vendor');
    } else {
      const notes = await db
        .collection('comments')
        .where('companyId', '==', companyId)
        .where('postId', '==', caseId)
        .get();
      extras.notes = notes.docs.map((d) => d.data()).filter((n) => n.isAdminComment === true);
    }
    extras.notes.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  }
  if (include.conversation) {
    const thread = await db.collection('anonymousThreads').doc(caseId).get();
    extras.thread = thread.exists ? thread.data() : null;
  }
  if (caseType === 'vendor') {
    const corr = await db.collection('vendorReports').doc(caseId).collection('corroborations').get();
    extras.corroborations = corr.docs.map((d) => d.data());
  }
  return extras;
}

// ============================================
// A. createCaseShare
// ============================================

const createCaseShare = onCall({ ...BASE_OPTIONS, secrets: [CASE_KEY_PEPPER] }, async (request) => {
  const caller = assertRole(request, STAFF);

  let input;
  try {
    input = validateShareInput(request.data);
  } catch (error) {
    if (error instanceof ShareValidationError) throw new HttpsError('invalid-argument', 'Invalid request.');
    throw error;
  }

  try {
    const caseData = await loadAuthorizedCase(caller, input.caseType, input.caseId);
    const companyId = caseData.companyId;
    assertCompany(request, companyId);

    const [extras, companySnap, userSnap] = await Promise.all([
      loadExtras(input.caseType, input.caseId, companyId, input.include),
      db.collection('companies').doc(companyId).get(),
      db.collection('users').doc(caller.uid).get(),
    ]);
    const companyName = companySnap.exists ? companySnap.data().name || '' : '';
    const senderName = userSnap.exists ? userSnap.data().displayName || '' : '';

    const snapshot = buildSnapshot(input.caseType, caseData, extras, input.include);
    const token = generateToken();
    const shareRef = db.collection('caseShares').doc();
    const expiresAt = addDays(Date.now(), input.expiresInDays);
    const link = `${APP_URL()}/shared/${shareRef.id}#${token}`;

    const batch = db.batch();
    batch.set(shareRef, {
      companyId,
      caseType: input.caseType,
      caseId: input.caseId,
      caseTitle: snapshot.title,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      includes: input.include,
      expiresAt,
      revoked: false,
      viewCount: 0,
      lastViewedAt: null,
      createdBy: caller.uid,
      createdByName: senderName,
      createdAt: serverTimestamp(),
    });
    batch.set(db.collection('caseShareSnapshots').doc(shareRef.id), {
      companyId,
      tokenHash: hashToken(token, CASE_KEY_PEPPER.value()),
      companyName,
      sharedByName: senderName,
      recipientName: input.recipientName,
      note: input.message,
      snapshot,
      expiresAt,
      createdAt: serverTimestamp(),
    });

    const mail = buildShareEmail({
      companyName,
      recipientName: input.recipientName,
      senderName,
      message: input.message,
      link,
      expiresAt,
      title: snapshot.title,
    });
    // Delivered by the email sender that processes emailQueue (same queue as the digests).
    batch.set(db.collection('emailQueue').doc(), {
      to: input.recipientEmail,
      subject: mail.subject,
      html: mail.html,
      status: 'pending',
      type: 'case_share',
      companyId,
      createdAt: serverTimestamp(),
    });

    // Audit trail on the case itself (staff-only collections).
    const activity = {
      companyId,
      type: 'shared_externally',
      actor: caller.uid,
      metadata: { shareId: shareRef.id, expiresAt: expiresAt.toISOString(), sharedWithOutsideCounsel: true },
      createdAt: serverTimestamp(),
    };
    if (input.caseType === 'vendor') {
      batch.set(db.collection('caseActivities').doc(), { ...activity, caseType: 'vendor', caseId: input.caseId });
    } else {
      batch.set(db.collection('postActivities').doc(), { ...activity, postId: input.caseId });
    }
    await batch.commit();

    return { shareId: shareRef.id, link, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('createCaseShare: failed', { name: error && error.name, code: error && error.code });
    throw new HttpsError('internal', 'Could not share the case.');
  }
});

// ============================================
// B. revokeCaseShare
// ============================================

const revokeCaseShare = onCall(BASE_OPTIONS, async (request) => {
  const caller = assertRole(request, STAFF);
  const shareId = request.data && request.data.shareId;
  if (typeof shareId !== 'string' || !SHARE_ID_PATTERN.test(shareId)) {
    throw new HttpsError('invalid-argument', 'Invalid request.');
  }
  const ref = db.collection('caseShares').doc(shareId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Share not found.');
  assertCompany(request, snap.data().companyId);
  if (caller.role === 'hr' && snap.data().createdBy !== caller.uid) {
    throw new HttpsError('permission-denied', 'Not allowed.');
  }
  await ref.update({ revoked: true, revokedAt: serverTimestamp(), revokedBy: caller.uid });
  return { revoked: true };
});

// ============================================
// C. getSharedCase (public, no login)
// ============================================

async function withFreshEvidenceLinks(attachments) {
  if (!attachments.length) return [];
  const bucket = admin.storage().bucket();
  return Promise.all(
    attachments.map(async (a) => {
      if (a.url) return { name: a.name, url: a.url, type: a.type || '' };
      try {
        const [url] = await bucket.file(a.path).getSignedUrl({
          action: 'read',
          expires: Date.now() + SIGNED_URL_TTL_MS,
        });
        return { name: a.name, url, type: a.type || '' };
      } catch {
        return { name: a.name, url: null, type: a.type || '' };
      }
    })
  );
}

const getSharedCase = onCall({ ...BASE_OPTIONS, secrets: [CASE_KEY_PEPPER, IP_HASH_SALT] }, async (request) => {
  const { shareId, token } = request.data || {};
  if (typeof shareId !== 'string' || !SHARE_ID_PATTERN.test(shareId)) throw unavailable();

  try {
    const allowed = await consumeRateLimit(db, {
      hashedKey: hashKey(`share-view-ip:${clientIp(request)}`, IP_HASH_SALT.value()),
      limit: VIEW_LIMITS.perIpPerHour,
      windowMs: VIEW_LIMITS.hourMs,
    });
    if (!allowed) throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');

    const [metaSnap, bodySnap] = await Promise.all([
      db.collection('caseShares').doc(shareId).get(),
      db.collection('caseShareSnapshots').doc(shareId).get(),
    ]);
    if (!metaSnap.exists || !bodySnap.exists) throw unavailable();
    const body = bodySnap.data();
    if (!verifyToken(token, body.tokenHash, CASE_KEY_PEPPER.value())) throw unavailable();
    if (shareState(metaSnap.data()) !== 'active') throw unavailable();

    await metaSnap.ref.update({ viewCount: FieldValue.increment(1), lastViewedAt: serverTimestamp() });

    const snapshot = body.snapshot;
    return {
      companyName: body.companyName || '',
      sharedByName: body.sharedByName || '',
      recipientName: body.recipientName || '',
      note: body.note || '',
      expiresAt: body.expiresAt.toDate().toISOString(),
      case: { ...snapshot, attachments: await withFreshEvidenceLinks(snapshot.attachments || []) },
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('getSharedCase: failed', { name: error && error.name, code: error && error.code });
    throw new HttpsError('internal', 'Could not load the case.');
  }
});

module.exports = { createCaseShare, revokeCaseShare, getSharedCase };
