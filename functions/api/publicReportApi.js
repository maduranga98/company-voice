/**
 * Public Report API
 * No-login report submission, plus the company-admin callables that manage the report link.
 *
 * Privacy rules for this file:
 * - Never store or log the raw IP, user agent, report text, contact details, case codes or keys.
 * - Errors are logged by code only.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const { admin, db, serverTimestamp } = require('../config/firebase');
const {
  REPORT_TYPES,
  VENDOR_REPORT_TYPE,
  VENDOR_CATEGORIES,
  VENDOR_SEVERITIES,
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
const { resolveRoutingAssignment } = require('../utils/routingRules');
const { SYSTEM_CATEGORY_ID } = require('../config/categoryRouting');
const {
  getActiveCategories,
  getSubmittableCategory,
  resolveCategoryRouting,
} = require('../utils/categoryRouting');
const { ensureSeeded } = require('../utils/categorySeed');
const { SLUG_PATTERN, issueReportSlug } = require('../utils/reportSlugs');
const { assertRole, assertCompany } = require('../utils/authz');
const { isCaseProgressCheckAllowed, isVendorRiskAllowed, buildSettingsUpdate } = require('../utils/companySettings');
const { BASE_OPTIONS, clientIp } = require('../config/callableOptions');

const { ANONYMOUS_SECRET, CASE_KEY_PEPPER, IP_HASH_SALT } = require('../config/secrets');

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

// ============================================
// A. getPublicReportConfig
// ============================================

const getPublicReportConfig = onCall(BASE_OPTIONS, async (request) => {
  const resolved = await resolveActiveCompany(request.data && request.data.slug);
  if (!resolved) throw notFound();

  const { companyId, company } = resolved;
  // Companies created after the category migration are seeded on first use.
  await ensureSeeded(db, companyId, company, serverTimestamp()).catch(() => {
    logger.warn('getPublicReportConfig: category seeding failed');
  });
  return {
    companyName: company.name || '',
    defaultLanguage: ['en', 'es', 'fr', 'it', 'si'].includes(company.defaultLanguage)
      ? company.defaultLanguage
      : 'en',
    categories: await getActiveCategories(db, companyId),
    vendorCategories: VENDOR_CATEGORIES,
    vendorSeverities: VENDOR_SEVERITIES,
    allowCaseProgressCheck: isCaseProgressCheckAllowed(company),
    allowVendorRisk: isVendorRiskAllowed(company),
    limits: {
      maxFiles: LIMITS.maxFiles,
      maxFileMB: LIMITS.maxFileMB,
      allowedMimeTypes: Object.keys(MIME_EXTENSIONS),
    },
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

// Vendor reports show evidence through plain download URLs (the same shape the in-app
// vendor form stores), so each moved file gets a Firebase download token.
async function addDownloadUrls(bucket, attachments) {
  return Promise.all(
    attachments.map(async (a) => {
      const token = crypto.randomUUID();
      await bucket.file(a.path).setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
      return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(a.path)}?alt=media&token=${token}`;
    })
  );
}

// Reference code shown to staff and used for corroboration: VXW-YYYY-NNNN, same format as
// the in-app form. The count is a best-effort sequence; uniqueness is not relied on.
async function nextVendorReferenceCode(companyId) {
  const countSnap = await db.collection('vendorReports').where('companyId', '==', companyId).count().get();
  const next = countSnap.data().count + 1;
  return `VXW-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
}

async function createCase({ postRef, postData, caseData, activityData, activityCollection = 'postActivities' }) {
  for (let attempt = 0; attempt < MAX_CASE_CODE_ATTEMPTS; attempt++) {
    const caseCode = generateCaseCode();
    const caseRef = db.collection('caseAccess').doc(caseCode);
    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(caseRef);
        if (existing.exists) throw COLLISION;
        tx.set(postRef, { ...postData, caseCode });
        tx.set(caseRef, caseData);
        tx.set(db.collection(activityCollection).doc(), activityData);
      });
      return caseCode;
    } catch (error) {
      if (error !== COLLISION) throw error;
    }
  }
  throw new HttpsError('internal', 'Could not complete submission.');
}

// routingMatch: the result of resolveRoutingAssignment(), or null. When a rule matched,
// only the assignee is notified (so a routed company doesn't also broadcast to everyone);
// otherwise every eligible company_admin/hr user is notified, as before.
async function notifyStaff(companyId, postId, involvesHR, routingMatch, isVendor = false) {
  try {
    if (routingMatch && routingMatch.roleAssignment) {
      // Routed to a role: every active member of it is told (resolved server-side).
      const batch = db.batch();
      routingMatch.roleAssignment.userIds.forEach((userId) => {
        batch.set(db.collection('notifications').doc(), {
          userId,
          type: 'new_case',
          title: 'New report for your team',
          message: 'A new report was routed to your team.',
          companyId,
          metadata: { postId, ruleId: routingMatch.ruleId, ...(isVendor ? { caseType: 'vendor' } : {}) },
          read: false,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      return;
    }

    if (routingMatch && routingMatch.assignment) {
      await db.collection('notifications').add({
        userId: routingMatch.assignment.id,
        type: 'assigned',
        title: 'New case assigned to you',
        message: 'A new report was automatically assigned to you.',
        companyId,
        metadata: { postId, ruleId: routingMatch.ruleId, ...(isVendor ? { caseType: 'vendor' } : {}) },
        read: false,
        createdAt: serverTimestamp(),
      });
      return;
    }

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
          metadata: { postId, ...(isVendor ? { caseType: 'vendor' } : {}) },
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
    secrets: [ANONYMOUS_SECRET, CASE_KEY_PEPPER, IP_HASH_SALT],
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

    const resolved = await resolveActiveCompany(input.slug);
    if (!resolved) throw notFound();
    const { companyId, company } = resolved;
    if (input.type === VENDOR_REPORT_TYPE && !isVendorRiskAllowed(company)) {
      throw new HttpsError('invalid-argument', 'Invalid submission.');
    }

    // The category list is per company and editable, so the id is checked against the
    // company's active categories here, not against a fixed list.
    let category = null;
    if (input.type !== VENDOR_REPORT_TYPE) {
      await ensureSeeded(db, companyId, company, serverTimestamp()).catch(() => {});
      category = await getSubmittableCategory(db, companyId, input.category);
      if (!category) throw new HttpsError('invalid-argument', 'Invalid submission.');
    }

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

      const isVendor = input.type === VENDOR_REPORT_TYPE;
      const postRef = db.collection(isVendor ? 'vendorReports' : 'posts').doc();
      const attachments = await moveToCase(bucket, companyId, postRef.id, checkedFiles);

      const secretKey = generateSecretKey();
      const keyHash = hashSecretKey(secretKey, CASE_KEY_PEPPER.value());

      const postData = isVendor
        ? {
            companyId,
            referenceCode: await nextVendorReferenceCode(companyId),
            vendorName: input.vendor.vendorName,
            riskCategory: input.category,
            severity: input.vendor.severity,
            status: 'open',
            priority: input.vendor.severity,
            // The reporter says if HR is involved; that restricts the report to company admins.
            visibility: input.involvesHR ? 'restricted' : 'standard',
            assignedTo: null,
            dueDate: null,
            description: input.description,
            attachmentUrls: await addDownloadUrls(bucket, attachments),
            source: 'public_link',
            authorId: null,
            isAnonymous: true,
            corroborationCount: 0,
            autoEscalated: false,
            submittedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            reviewedBy: null,
            reviewNotes: null,
            resolvedAt: null,
          }
        : {
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
            // Denormalised so the case still reads correctly after the category is renamed
            // or deactivated; the id stays the stable reference.
            categoryName: category.name,
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

      // Auto-routing: a matching rule assigns the case immediately, so staff see it
      // already owned instead of everyone getting a broadcast notification for it.
      // Precedence: an admin's condition-based rule (Case Queue -> Routing Rules) wins, then
      // the category's own rule, then the company default, then the first company admin.
      // The assignee is always resolved here from Firestore; nothing from the client is trusted.
      const advancedMatch = await resolveRoutingAssignment(
        db,
        companyId,
        isVendor ? 'vendor' : 'post',
        isVendor ? { riskCategory: postData.riskCategory, severity: postData.severity } : postData
      );
      const routingMatch =
        advancedMatch ||
        (await resolveCategoryRouting(db, companyId, {
          categoryId: isVendor ? SYSTEM_CATEGORY_ID : input.category,
          categoryName: isVendor ? 'Vendor Risk' : category.name,
          involvesHR: input.involvesHR,
        }));
      if (routingMatch && routingMatch.assignment) {
        postData.assignedTo = {
          type: routingMatch.assignment.type,
          id: routingMatch.assignment.id,
          name: routingMatch.assignment.name,
          assignedAt: serverTimestamp(),
          assignedBy: 'Routing rule',
          assignedById: null,
        };
        if (isVendor) {
          postData.assignedToId = routingMatch.assignment.id;
          postData.assignedToName = routingMatch.assignment.name;
        }
      }
      if (routingMatch && routingMatch.roleAssignment) {
        // Routed to a whole role (e.g. all HR): nobody owns it yet, the role's members share it.
        postData.routedToRole = routingMatch.roleAssignment.role;
      }
      if (!isVendor) {
        // The HR inbox only lists cases that are for HR: nothing matched a routing rule,
        // or the rule assigned it to HR (a user with the hr role, or the whole hr role).
        // Anything routed to someone else lives in that person's "Assigned to Me" and the
        // case queue instead.
        postData.hrInbox = true;
        if (routingMatch && routingMatch.roleAssignment) {
          postData.hrInbox = routingMatch.roleAssignment.role === 'hr';
        } else if (routingMatch) {
          const assignee = await db.collection('users').doc(routingMatch.assignment.id).get();
          postData.hrInbox = assignee.exists && assignee.data().role === 'hr';
        }
      }

      let caseCode;
      try {
        caseCode = await createCase({
          postRef,
          postData,
          activityCollection: isVendor ? 'caseActivities' : 'postActivities',
          caseData: {
            postId: postRef.id,
            ...(isVendor ? { caseType: 'vendor' } : {}),
            companyId,
            keyHash,
            failedAttempts: 0,
            lockedUntil: null,
            createdAt: serverTimestamp(),
          },
          activityData: {
            ...(isVendor ? { caseType: 'vendor', caseId: postRef.id } : { postId: postRef.id }),
            companyId,
            type: 'created',
            actor: 'public_reporter',
            metadata: routingMatch
              ? {
                  source: 'public_link',
                  actor: 'public_reporter',
                  autoAssigned: true,
                  ruleId: routingMatch.ruleId,
                  ruleName: routingMatch.ruleName,
                  ...(routingMatch.assignment
                    ? { assignedToName: routingMatch.assignment.name }
                    : { routedToRole: routingMatch.roleAssignment.role }),
                }
              : { source: 'public_link', actor: 'public_reporter' },
            createdAt: serverTimestamp(),
          },
        });
      } catch (error) {
        await Promise.allSettled(attachments.map((a) => bucket.file(a.path).delete()));
        throw error;
      }

      await notifyStaff(companyId, postRef.id, input.involvesHR, routingMatch, isVendor);

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

function requireCompanyAdmin(request, companyId) {
  assertRole(request, ['company_admin', 'super_admin']);
  assertCompany(request, typeof companyId === 'string' ? companyId : null);
}

const ensureReportSlug = onCall(BASE_OPTIONS, async (request) => {
  const { companyId, rotate } = request.data || {};
  requireCompanyAdmin(request, companyId);

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
  requireCompanyAdmin(request, companyId);
  if (typeof enabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'enabled must be a boolean.');
  }

  const companyRef = db.collection('companies').doc(companyId);
  if (!(await companyRef.get()).exists) throw new HttpsError('not-found', 'Company not found.');
  await companyRef.update({ reportingEnabled: enabled });
  return { enabled };
});

const updateCompanySettings = onCall(BASE_OPTIONS, async (request) => {
  const { companyId, settings } = request.data || {};
  requireCompanyAdmin(request, companyId);

  let updates;
  try {
    updates = buildSettingsUpdate(settings);
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid settings.');
  }

  const companyRef = db.collection('companies').doc(companyId);
  try {
    await companyRef.update(updates);
  } catch (error) {
    if (error && (error.code === 5 || error.code === 'not-found')) {
      throw new HttpsError('not-found', 'Company not found.');
    }
    logger.error('updateCompanySettings: failed', { code: error && error.code });
    throw new HttpsError('internal', 'Could not update settings.');
  }
  return { settings };
});

module.exports = {
  getPublicReportConfig,
  submitPublicReport,
  ensureReportSlug,
  setReportingEnabled,
  updateCompanySettings,
};
