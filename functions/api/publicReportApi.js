/**
 * Public Report API
 * No-login report submission, plus the company-admin callables that manage the report link.
 *
 * Privacy rules for this file:
 * - Never store or log the raw IP, user agent, report text, contact details, case codes or keys.
 * - Errors are logged by code only.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const CryptoJS = require('crypto-js');
const { admin, db, serverTimestamp } = require('../config/firebase');
const {
  REPORT_TYPES,
  CATEGORIES,
  LIMITS,
  MIME_EXTENSIONS,
  SUBMISSION_LIMITS,
} = require('../config/publicReports');
const {
  ValidationError,
  validateSubmission,
  deriveTitle,
  sniffMime,
  isAllowedMime,
} = require('../utils/publicReportValidation');
const {
  generateCaseCode,
  generateSecretKey,
  hashSecretKey,
  randomChars,
} = require('../utils/caseKeys');
const { hashKey, consumeRateLimit, claimToken, releaseToken } = require('../utils/rateLimit');
const { SLUG_PATTERN, issueReportSlug } = require('../utils/reportSlugs');
const { verifyTurnstile } = require('../utils/turnstile');
const { isSuperAdmin, isCompanyAdmin } = require('../utils/helpers');

const ANONYMOUS_SECRET = defineSecret('ANONYMOUS_SECRET');
const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET');
const CASE_KEY_PEPPER = defineSecret('CASE_KEY_PEPPER');
const IP_HASH_SALT = defineSecret('IP_HASH_SALT');

const PORTAL_ORIGINS = [
  'https://portal.voxwel.com',
  'https://voxwel.com',
  ...(process.env.GCLOUD_PROJECT
    ? [`https://${process.env.GCLOUD_PROJECT}.web.app`, `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`]
    : []),
];

const BASE_OPTIONS = {
  cors: process.env.FUNCTIONS_EMULATOR === 'true' ? true : PORTAL_ORIGINS,
  enforceAppCheck: true,
};

const MAX_CASE_CODE_ATTEMPTS = 5;
const COLLISION = Symbol('case-code-collision');

// One response for every "no such link" case so slugs can't be enumerated.
const notFound = () => new HttpsError('not-found', 'This reporting link is not active.');

/**
 * Resolve a slug to its company. Returns null for missing, inactive or disabled links.
 */
async function resolveActiveCompany(slug) {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) return null;

  const slugSnap = await db.collection('reportSlugs').doc(slug).get();
  if (!slugSnap.exists || slugSnap.data().active !== true) return null;

  const companyId = slugSnap.data().companyId;
  const companySnap = await db.collection('companies').doc(companyId).get();
  if (!companySnap.exists) return null;

  const company = companySnap.data();
  if (company.reportingEnabled === false || company.reportSlug !== slug) return null;

  return { companyId, company };
}

function clientIp(request) {
  const raw = request.rawRequest;
  if (!raw) return 'unknown';
  return raw.ip || (raw.headers && String(raw.headers['x-forwarded-for'] || '').split(',')[0].trim()) || 'unknown';
}

// ============================================
// A. getPublicReportConfig
// ============================================

const getPublicReportConfig = onCall(BASE_OPTIONS, async (request) => {
  const resolved = await resolveActiveCompany(request.data && request.data.slug);
  if (!resolved) throw notFound();

  const { company } = resolved;
  return {
    companyName: company.name || '',
    defaultLanguage: ['en', 'es', 'fr', 'it', 'si'].includes(company.defaultLanguage)
      ? company.defaultLanguage
      : 'en',
    categories: CATEGORIES,
    limits: {
      maxFiles: LIMITS.maxFiles,
      maxFileMB: LIMITS.maxFileMB,
      allowedMimeTypes: Object.keys(MIME_EXTENSIONS),
    },
    turnstileRequired: true,
  };
});

// ============================================
// B. submitPublicReport
// ============================================

async function verifyPendingFiles(bucket, paths) {
  const checked = [];
  for (const path of paths) {
    const file = bucket.file(path);
    let metadata;
    try {
      [metadata] = await file.getMetadata();
    } catch {
      throw new HttpsError('failed-precondition', 'Attachment missing.');
    }

    const size = Number(metadata.size);
    if (!Number.isFinite(size) || size <= 0 || size > LIMITS.maxFileMB * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'Invalid attachment.');
    }
    if (!isAllowedMime(metadata.contentType)) {
      throw new HttpsError('invalid-argument', 'Invalid attachment.');
    }

    const head = await new Promise((resolve, reject) => {
      const chunks = [];
      file
        .createReadStream({ start: 0, end: 15 })
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject);
    });
    // The upload rules trust the client-declared type; the real bytes must agree.
    if (sniffMime(head) !== metadata.contentType) {
      throw new HttpsError('invalid-argument', 'Invalid attachment.');
    }

    checked.push({ path, size, type: metadata.contentType });
  }
  return checked;
}

async function moveToCase(bucket, companyId, postId, checked) {
  const moved = [];
  try {
    for (let i = 0; i < checked.length; i++) {
      const { path, size, type } = checked[i];
      const ext = MIME_EXTENSIONS[type];
      // File names are replaced: originals can carry names or other identifying text.
      const destination = `companies/${companyId}/cases/${postId}/${i + 1}-${randomChars(6).toLowerCase()}.${ext}`;
      await bucket.file(path).move(destination);
      moved.push({ path: destination, name: `evidence-${i + 1}.${ext}`, type, size });
    }
  } catch (error) {
    await Promise.allSettled(moved.map((m) => bucket.file(m.path).delete()));
    throw error;
  }
  return moved;
}

async function createCase({ postRef, postData, caseData, activityData }) {
  for (let attempt = 0; attempt < MAX_CASE_CODE_ATTEMPTS; attempt++) {
    const caseCode = generateCaseCode();
    const caseRef = db.collection('caseAccess').doc(caseCode);
    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(caseRef);
        if (existing.exists) throw COLLISION;
        tx.set(postRef, { ...postData, caseCode });
        tx.set(caseRef, caseData);
        tx.set(db.collection('postActivities').doc(), activityData);
      });
      return caseCode;
    } catch (error) {
      if (error !== COLLISION) throw error;
    }
  }
  throw new HttpsError('internal', 'Could not complete submission.');
}

async function notifyStaff(companyId, postId, involvesHR) {
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
          type: 'new_case',
          title: 'New anonymous report',
          message: 'A new report was submitted through your reporting link.',
          companyId,
          metadata: { postId },
          read: false,
          createdAt: serverTimestamp(),
        });
      });
    await batch.commit();
  } catch {
    // The case is already saved; notifications are best effort.
    logger.warn('submitPublicReport: staff notification failed');
  }
}

const submitPublicReport = onCall(
  {
    ...BASE_OPTIONS,
    secrets: [ANONYMOUS_SECRET, TURNSTILE_SECRET, CASE_KEY_PEPPER, IP_HASH_SALT],
    memory: '512MiB',
    timeoutSeconds: 90,
  },
  async (request) => {
    let input;
    try {
      input = validateSubmission(request.data);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.info('submitPublicReport: rejected', { field: error.field });
        throw new HttpsError('invalid-argument', 'Invalid submission.');
      }
      throw error;
    }

    if (!(await verifyTurnstile(input.turnstileToken, TURNSTILE_SECRET.value()))) {
      throw new HttpsError('failed-precondition', 'Verification failed.');
    }

    const resolved = await resolveActiveCompany(input.slug);
    if (!resolved) throw notFound();
    const { companyId } = resolved;

    const bucket = admin.storage().bucket();
    const checkedFiles = await verifyPendingFiles(bucket, input.attachmentPaths);

    const salt = IP_HASH_SALT.value();
    const idempotencyKey = hashKey(`idem:${input.idempotencyToken}`, salt);
    if (!(await claimToken(db, { hashedKey: idempotencyKey, ttlMs: SUBMISSION_LIMITS.idempotencyTtlMs }))) {
      throw new HttpsError('already-exists', 'Submission already received.');
    }

    try {
      const ipAllowed = await consumeRateLimit(db, {
        hashedKey: hashKey(`ip:${clientIp(request)}`, salt),
        limit: SUBMISSION_LIMITS.perIpPerHour,
        windowMs: SUBMISSION_LIMITS.hourMs,
      });
      const companyAllowed =
        ipAllowed &&
        (await consumeRateLimit(db, {
          hashedKey: hashKey(`company:${companyId}`, salt),
          limit: SUBMISSION_LIMITS.perCompanyPerDay,
          windowMs: SUBMISSION_LIMITS.dayMs,
        }));
      if (!ipAllowed || !companyAllowed) {
        throw new HttpsError('resource-exhausted', 'Too many submissions. Please try again later.');
      }

      const postRef = db.collection('posts').doc();
      const attachments = await moveToCase(bucket, companyId, postRef.id, checkedFiles);

      const secretKey = generateSecretKey();
      const keyHash = hashSecretKey(secretKey, CASE_KEY_PEPPER.value());

      const postData = {
        companyId,
        type: REPORT_TYPES[input.type],
        source: 'public_link',
        isAnonymous: true,
        authorId: null,
        creatorId: null,
        authorName: 'Anonymous',
        authorEmail: '',
        status: 'open',
        priority: 'medium',
        privacyLevel: 'hr_only',
        involvesHR: input.involvesHR,
        category: input.category,
        title: deriveTitle(input.description),
        description: input.description,
        content: input.description,
        attachments,
        reportLang: input.clientLang,
        tags: [],
        likes: [],
        comments: 0,
        views: 0,
        departmentId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.contact) {
        postData.reporterContactEncrypted = CryptoJS.AES.encrypt(
          JSON.stringify(input.contact),
          ANONYMOUS_SECRET.value()
        ).toString();
      }

      let caseCode;
      try {
        caseCode = await createCase({
          postRef,
          postData,
          caseData: {
            postId: postRef.id,
            companyId,
            keyHash,
            failedAttempts: 0,
            lockedUntil: null,
            createdAt: serverTimestamp(),
          },
          activityData: {
            postId: postRef.id,
            companyId,
            type: 'created',
            actor: 'public_reporter',
            metadata: { source: 'public_link', actor: 'public_reporter' },
            createdAt: serverTimestamp(),
          },
        });
      } catch (error) {
        await Promise.allSettled(attachments.map((a) => bucket.file(a.path).delete()));
        throw error;
      }

      await notifyStaff(companyId, postRef.id, input.involvesHR);

      return { caseCode, secretKey };
    } catch (error) {
      // Let the reporter retry with the same token if nothing was saved.
      await releaseToken(db, idempotencyKey).catch(() => {});
      if (error instanceof HttpsError) throw error;
      logger.error('submitPublicReport: failed', { name: error && error.name, code: error && error.code });
      throw new HttpsError('internal', 'Could not complete submission.');
    }
  }
);

// ============================================
// C. ensureReportSlug / setReportingEnabled
// ============================================

async function requireCompanyAdmin(request, companyId) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (typeof companyId !== 'string' || !companyId) {
    throw new HttpsError('invalid-argument', 'companyId is required.');
  }
  const allowed =
    (await isSuperAdmin(request.auth.uid)) || (await isCompanyAdmin(request.auth.uid, companyId));
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed.');
}

const ensureReportSlug = onCall(BASE_OPTIONS, async (request) => {
  const { companyId, rotate } = request.data || {};
  await requireCompanyAdmin(request, companyId);

  try {
    const { slug } = await issueReportSlug(db, serverTimestamp, { companyId, rotate: rotate === true });
    return { slug };
  } catch (error) {
    if (error.code === 'company-not-found') throw new HttpsError('not-found', 'Company not found.');
    logger.error('ensureReportSlug: failed', { code: error && error.code });
    throw new HttpsError('internal', 'Could not update the report link.');
  }
});

const setReportingEnabled = onCall(BASE_OPTIONS, async (request) => {
  const { companyId, enabled } = request.data || {};
  await requireCompanyAdmin(request, companyId);
  if (typeof enabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'enabled must be a boolean.');
  }

  const companyRef = db.collection('companies').doc(companyId);
  if (!(await companyRef.get()).exists) throw new HttpsError('not-found', 'Company not found.');
  await companyRef.update({ reportingEnabled: enabled });
  return { enabled };
});

module.exports = {
  getPublicReportConfig,
  submitPublicReport,
  ensureReportSlug,
  setReportingEnabled,
};
