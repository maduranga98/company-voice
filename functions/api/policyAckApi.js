/**
 * Policy Acknowledgement API
 * No-login policy acknowledgement links (/p/:slug), plus the staff callables that manage them.
 *
 * Data model:
 * - policyLinks/{slug}                       { companyId, policyId, active, requireRoster, rosterCount, ... }
 * - policyLinkRosters/{slug}                 { companyId, employees: [{employeeId, employeeKey, name}] }
 * - companies/{cid}/policyResponses/{id}     one doc per acknowledgement (deterministic id, deduped per
 *                                            employee + policy version) or per raised concern
 * - companies/{cid}/policyEmployees/{key}    one doc per distinct employee who ever acknowledged:
 *                                            the Step 5 billing quantity is this collection's count
 * - posts/{id}                               a raised concern lands in the HR inbox like any other case
 *
 * The policy itself is read live from the existing `policies/{policyId}` document, so there is
 * a single policy store.
 *
 * Privacy rules for this file (same as publicReportApi.js): never store or log the raw IP,
 * concern text or employee details in logs. Errors are logged by code only. Employee id and
 * name are stored in plain text on purpose: this line is not anonymous.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { db, serverTimestamp } = require('../config/firebase');
const { RATE_LIMITS, LIMITS } = require('../config/policyAck');
const { LANGUAGES } = require('../config/publicReports');
const { hashKey, consumeRateLimit, claimToken, releaseToken } = require('../utils/rateLimit');
const { resolveRoutingAssignment } = require('../utils/routingRules');
const { SLUG_PATTERN, buildSlug } = require('../utils/reportSlugs');
const { assertRole, assertCompany } = require('../utils/authz');
const {
  PolicyAckValidationError,
  validateAckSubmission,
  parseRosterText,
  ackDocId,
  recordAcknowledgement,
} = require('../utils/policyAck');
const { BASE_OPTIONS, clientIp } = require('../config/callableOptions');
const { IP_HASH_SALT } = require('../config/secrets');

const MAX_SLUG_ATTEMPTS = 5;
const MAX_ROSTER_TEXT = 300 * 1024;
const STAFF_POLICY_ROLES = ['company_admin', 'hr', 'super_admin'];
const STORAGE_URL_PREFIX = 'https://firebasestorage.googleapis.com/';

// One response for every "no such link" case so slugs can't be enumerated.
const notFound = () => new HttpsError('not-found', 'This policy link is not active.');
const tooMany = () => new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');

const toIso = (ts) => (ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString() : null);

/**
 * Resolve a slug to its link, company and published policy. Null for anything not live:
 * malformed or unknown slug, inactive link, missing/unpublished policy, company mismatch.
 */
async function resolveActiveLink(slug) {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) return null;

  const linkSnap = await db.collection('policyLinks').doc(slug).get();
  if (!linkSnap.exists || linkSnap.data().active !== true) return null;
  const link = linkSnap.data();

  const [policySnap, companySnap] = await Promise.all([
    db.collection('policies').doc(link.policyId).get(),
    db.collection('companies').doc(link.companyId).get(),
  ]);
  if (!policySnap.exists || !companySnap.exists) return null;
  const policy = policySnap.data();
  if (policy.companyId !== link.companyId || policy.status !== 'published') return null;

  return { slug, link, policyId: policySnap.id, policy, companyId: link.companyId, company: companySnap.data() };
}

// ============================================
// A. getPolicyForLink
// ============================================

const getPolicyForLink = onCall({ ...BASE_OPTIONS, secrets: [IP_HASH_SALT] }, async (request) => {
  const slug = request.data && request.data.slug;
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) throw notFound();

  const allowed = await consumeRateLimit(db, {
    hashedKey: hashKey(`policy-view-ip:${clientIp(request)}`, IP_HASH_SALT.value()),
    limit: RATE_LIMITS.viewPerIpPerHour,
    windowMs: RATE_LIMITS.hourMs,
  });
  if (!allowed) throw tooMany();

  const resolved = await resolveActiveLink(slug);
  if (!resolved) throw notFound();

  const { policy, company, link } = resolved;
  const effective = policy.effectiveDate;
  return {
    companyName: company.name || '',
    defaultLanguage: LANGUAGES.includes(company.defaultLanguage) ? company.defaultLanguage : 'en',
    requireRoster: link.requireRoster === true,
    policy: {
      title: policy.title || '',
      category: policy.category || 'other',
      version: String(policy.version || '1.0'),
      effectiveDate: toIso(effective),
      content: typeof policy.content === 'string' ? policy.content : '',
      fileName: policy.fileName || null,
      fileUrl:
        typeof policy.fileUrl === 'string' && policy.fileUrl.startsWith(STORAGE_URL_PREFIX)
          ? policy.fileUrl
          : null,
    },
  };
});

// ============================================
// B. submitPolicyAcknowledgement
// ============================================

async function notifyStaffOfConcern(companyId, postId, routingMatch) {
  try {
    if (routingMatch && routingMatch.assignment.type === 'user') {
      await db.collection('notifications').add({
        userId: routingMatch.assignment.id,
        type: 'assigned',
        title: 'New case assigned to you',
        message: 'A policy concern was automatically assigned to you.',
        companyId,
        metadata: { postId, ruleId: routingMatch.ruleId },
        read: false,
        createdAt: serverTimestamp(),
      });
      return;
    }

    const users = await db
      .collection('users')
      .where('companyId', '==', companyId)
      .where('role', 'in', ['company_admin', 'hr'])
      .get();

    const batch = db.batch();
    users.docs
      .filter((u) => u.data().status === undefined || u.data().status === 'active')
      .forEach((u) => {
        batch.set(db.collection('notifications').doc(), {
          userId: u.id,
          type: 'policy_concern',
          title: 'New policy concern',
          message: 'An employee raised a concern about a policy.',
          companyId,
          metadata: { postId },
          read: false,
          createdAt: serverTimestamp(),
        });
      });
    await batch.commit();
  } catch {
    // The concern is already saved; notifications are best effort.
    logger.warn('submitPolicyAcknowledgement: staff notification failed');
  }
}

function concernTitle(policyTitle) {
  const title = `Policy concern: ${policyTitle}`;
  return title.length <= 80 ? title : `${title.slice(0, 79).trimEnd()}…`;
}

async function isOnRoster(slug, link, employeeKey) {
  if (!(link.rosterCount > 0)) return null;
  const snap = await db.collection('policyLinkRosters').doc(slug).get();
  if (!snap.exists) return null;
  return (snap.data().employees || []).some((e) => e.employeeKey === employeeKey);
}

const submitPolicyAcknowledgement = onCall(
  { ...BASE_OPTIONS, secrets: [IP_HASH_SALT], timeoutSeconds: 60 },
  async (request) => {
    let input;
    try {
      input = validateAckSubmission(request.data);
    } catch (error) {
      if (error instanceof PolicyAckValidationError) {
        logger.info('submitPolicyAcknowledgement: rejected', { field: error.field });
        throw new HttpsError('invalid-argument', 'Invalid submission.');
      }
      throw error;
    }

    const resolved = await resolveActiveLink(input.slug);
    if (!resolved) throw notFound();
    const { slug, link, policyId, policy, companyId } = resolved;

    // The employee must acknowledge the version they actually read.
    if (String(policy.version || '1.0') !== input.policyVersion) {
      throw new HttpsError('failed-precondition', 'This policy was updated. Please reload the page.', {
        reason: 'policy_updated',
      });
    }

    const salt = IP_HASH_SALT.value();
    const isConcern = input.response === 'concern';
    const idempotencyKey = isConcern ? hashKey(`policy-idem:${input.idempotencyToken}`, salt) : null;
    let tokenClaimed = false;

    try {
      if (isConcern) {
        if (!(await claimToken(db, { hashedKey: idempotencyKey, ttlMs: RATE_LIMITS.idempotencyTtlMs }))) {
          throw new HttpsError('already-exists', 'Submission already received.');
        }
        tokenClaimed = true;
      }

      const ipAllowed = await consumeRateLimit(db, {
        hashedKey: hashKey(`policy-ip:${clientIp(request)}`, salt),
        limit: RATE_LIMITS.submitPerIpPerHour,
        windowMs: RATE_LIMITS.hourMs,
      });
      const linkAllowed =
        ipAllowed &&
        (await consumeRateLimit(db, {
          hashedKey: hashKey(`policy-link:${slug}`, salt),
          limit: RATE_LIMITS.submitPerLinkPerDay,
          windowMs: RATE_LIMITS.dayMs,
        }));
      const employeeAllowed =
        !isConcern ||
        (linkAllowed &&
          (await consumeRateLimit(db, {
            hashedKey: hashKey(`policy-concern:${policyId}:${input.employeeKey}`, salt),
            limit: RATE_LIMITS.concernPerEmployeePerDay,
            windowMs: RATE_LIMITS.dayMs,
          })));
      if (!ipAllowed || !linkAllowed || !employeeAllowed) throw tooMany();

      const onRoster = await isOnRoster(slug, link, input.employeeKey);
      if (link.requireRoster === true && onRoster === false) {
        throw new HttpsError('failed-precondition', 'Employee ID not recognised.', { reason: 'not_on_roster' });
      }

      const company = db.collection('companies').doc(companyId);
      const base = {
        policyId,
        policyTitle: policy.title || '',
        policyVersion: input.policyVersion,
        employeeId: input.employeeId,
        employeeKey: input.employeeKey,
        employeeName: input.employeeName,
        linkSlug: slug,
        clientLang: input.clientLang,
        createdAt: serverTimestamp(),
      };

      if (!isConcern) {
        const ackRef = company.collection('policyResponses').doc(
          ackDocId({ policyId, policyVersion: input.policyVersion, employeeKey: input.employeeKey })
        );
        const employeeRef = company.collection('policyEmployees').doc(input.employeeKey);
        const { created } = await db.runTransaction((tx) =>
          recordAcknowledgement(tx, {
            ackRef,
            employeeRef,
            ack: { ...base, response: 'acknowledged', onRoster },
            employee: {
              employeeKey: input.employeeKey,
              employeeId: input.employeeId,
              employeeName: input.employeeName,
              onRoster,
            },
            now: serverTimestamp(),
          })
        );
        return { status: created ? 'acknowledged' : 'already_acknowledged' };
      }

      // A concern goes to the HR inbox as a normal (non-anonymous) case.
      const postRef = db.collection('posts').doc();
      const routingMatch = await resolveRoutingAssignment(db, companyId, 'post', {
        type: 'problem_report',
        category: 'policy_concern',
        involvesHR: false,
      });
      const batch = db.batch();
      batch.set(postRef, {
        companyId,
        type: 'problem_report',
        source: 'policy_link',
        isAnonymous: false,
        authorId: null,
        creatorId: null,
        authorName: input.employeeName,
        authorEmail: '',
        status: 'open',
        priority: 'medium',
        privacyLevel: 'hr_only',
        involvesHR: false,
        category: 'policy_concern',
        title: concernTitle(policy.title || ''),
        description: input.concernText,
        content: input.concernText,
        attachments: [],
        policyId,
        policyVersion: input.policyVersion,
        policyTitle: policy.title || '',
        employeeId: input.employeeId,
        reportLang: input.clientLang,
        tags: [],
        likes: [],
        comments: 0,
        views: 0,
        departmentId: null,
        ...(routingMatch
          ? {
              assignedTo: {
                type: routingMatch.assignment.type,
                id: routingMatch.assignment.id,
                name: routingMatch.assignment.name,
                assignedAt: serverTimestamp(),
                assignedBy: 'Routing rule',
                assignedById: null,
              },
            }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(company.collection('policyResponses').doc(), {
        ...base,
        response: 'concern',
        postId: postRef.id,
      });
      batch.set(db.collection('postActivities').doc(), {
        postId: postRef.id,
        companyId,
        type: 'created',
        actor: 'policy_link_employee',
        metadata: routingMatch
          ? {
              source: 'policy_link',
              actor: 'policy_link_employee',
              autoAssigned: true,
              ruleId: routingMatch.ruleId,
              ruleName: routingMatch.ruleName,
              assignedToName: routingMatch.assignment.name,
            }
          : { source: 'policy_link', actor: 'policy_link_employee' },
        createdAt: serverTimestamp(),
      });
      await batch.commit();

      await notifyStaffOfConcern(companyId, postRef.id, routingMatch);
      return { status: 'concern_received' };
    } catch (error) {
      // Let the employee retry with the same token if nothing was saved.
      if (tokenClaimed) await releaseToken(db, idempotencyKey).catch(() => {});
      if (error instanceof HttpsError) throw error;
      logger.error('submitPolicyAcknowledgement: failed', { name: error && error.name, code: error && error.code });
      throw new HttpsError('internal', 'Could not complete submission.');
    }
  }
);

// ============================================
// C. Staff callables: ensurePolicyLink / setPolicyLinkActive / setPolicyLinkRoster
// ============================================

/** Create the policy's link on first use; later calls return the same one. */
const ensurePolicyLink = onCall(BASE_OPTIONS, async (request) => {
  const { policyId } = request.data || {};
  assertRole(request, STAFF_POLICY_ROLES);
  if (typeof policyId !== 'string' || !policyId || policyId.includes('/')) {
    throw new HttpsError('invalid-argument', 'policyId is required.');
  }

  try {
    const policyRef = db.collection('policies').doc(policyId);
    const result = await db.runTransaction(async (tx) => {
      const policySnap = await tx.get(policyRef);
      if (!policySnap.exists) throw new HttpsError('not-found', 'Policy not found.');
      const policy = policySnap.data();
      assertCompany(request, policy.companyId);
      if (policy.status !== 'published') {
        throw new HttpsError('failed-precondition', 'Only published policies can be shared.');
      }

      const existing = await tx.get(
        db.collection('policyLinks').where('policyId', '==', policyId).where('companyId', '==', policy.companyId).limit(1)
      );
      if (!existing.empty) return { slug: existing.docs[0].id, active: existing.docs[0].data().active === true };

      const companySnap = await tx.get(db.collection('companies').doc(policy.companyId));
      if (!companySnap.exists) throw new HttpsError('not-found', 'Company not found.');

      let slug = null;
      for (let i = 0; i < MAX_SLUG_ATTEMPTS && !slug; i++) {
        const candidate = buildSlug(companySnap.data().name);
        if (!(await tx.get(db.collection('policyLinks').doc(candidate))).exists) slug = candidate;
      }
      if (!slug) throw new HttpsError('internal', 'Could not create the link.');

      tx.set(db.collection('policyLinks').doc(slug), {
        companyId: policy.companyId,
        policyId,
        active: true,
        requireRoster: false,
        rosterCount: 0,
        createdBy: request.auth.uid,
        createdAt: serverTimestamp(),
      });
      return { slug, active: true };
    });
    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('ensurePolicyLink: failed', { code: error && error.code });
    throw new HttpsError('internal', 'Could not create the link.');
  }
});

async function loadOwnedLink(request, slug) {
  assertRole(request, STAFF_POLICY_ROLES);
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new HttpsError('invalid-argument', 'Invalid link.');
  }
  const ref = db.collection('policyLinks').doc(slug);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Link not found.');
  assertCompany(request, snap.data().companyId);
  return { ref, link: snap.data() };
}

const setPolicyLinkActive = onCall(BASE_OPTIONS, async (request) => {
  const { slug, active } = request.data || {};
  if (typeof active !== 'boolean') throw new HttpsError('invalid-argument', 'active must be a boolean.');
  const { ref } = await loadOwnedLink(request, slug);
  await ref.update(active ? { active: true, deactivatedAt: null } : { active: false, deactivatedAt: serverTimestamp() });
  return { active };
});

/**
 * Replace the expected-employee roster from pasted text ("ID, Name" per line) and/or toggle
 * `requireRoster`. The roster powers the "who hasn't acknowledged yet" table and, when
 * required, keeps made-up employee ids out of the record (and out of the billing count).
 */
const setPolicyLinkRoster = onCall(BASE_OPTIONS, async (request) => {
  const { slug, rosterText, requireRoster } = request.data || {};
  if (rosterText !== undefined && (typeof rosterText !== 'string' || rosterText.length > MAX_ROSTER_TEXT)) {
    throw new HttpsError('invalid-argument', 'Invalid roster.');
  }
  if (requireRoster !== undefined && typeof requireRoster !== 'boolean') {
    throw new HttpsError('invalid-argument', 'requireRoster must be a boolean.');
  }
  const { ref, link } = await loadOwnedLink(request, slug);

  let rosterCount = link.rosterCount || 0;
  let rejectedLines = [];
  if (rosterText !== undefined) {
    const { employees, rejected } = parseRosterText(rosterText);
    if (employees.length > LIMITS.maxRoster) {
      throw new HttpsError('invalid-argument', `A roster can hold at most ${LIMITS.maxRoster} employees.`);
    }
    rejectedLines = rejected.slice(0, 20);
    rosterCount = employees.length;
    await db.collection('policyLinkRosters').doc(slug).set({
      companyId: link.companyId,
      employees: employees.map((e) => ({ employeeId: e.employeeId, employeeKey: e.employeeKey, name: e.name })),
      updatedAt: serverTimestamp(),
    });
  }

  // Requiring a roster that is empty would lock every employee out.
  const nextRequire = (requireRoster === undefined ? link.requireRoster === true : requireRoster) && rosterCount > 0;
  await ref.update({ rosterCount, requireRoster: nextRequire });
  return { rosterCount, requireRoster: nextRequire, rejectedLines };
});

module.exports = {
  getPolicyForLink,
  submitPolicyAcknowledgement,
  ensurePolicyLink,
  setPolicyLinkActive,
  setPolicyLinkRoster,
};
