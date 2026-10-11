/**
 * Applies the company's routing rules to a newly created case (post / vendor report /
 * moderation report) and sets its initial assignee. Called by the Firestore creation
 * triggers, so it covers every creation path (client writes and Cloud Functions alike).
 *
 * Guarantees:
 * - Only acts on a case with no assignee, and re-checks that inside a transaction, so a
 *   person who assigns the case first always wins and a re-delivered trigger is a no-op.
 * - Never sets a due date and never touches status/priority.
 * - Privacy: a case flagged `involvesHR` is only ever auto-assigned to company_admin users
 *   (HR must not see those cases); a rule that could only resolve to an HR user is skipped.
 * - A rule whose target cannot be resolved (inactive user, empty tag, other company) is
 *   skipped and the next matching rule is tried.
 */

const { FieldValue } = require('firebase-admin/firestore');
const { caseFacts, ruleMatches, orderedRules } = require('../utils/routingRules');

const COLLECTIONS = { post: 'posts', vendor: 'vendorReports', moderation: 'contentReports' };
const MAX_RULES = 100;
const ROUTER_NAME = 'Routing rule';

const assignmentFor = (target, rule) => ({
  type: target.type,
  id: target.id,
  name: target.name,
  assignedAt: FieldValue.serverTimestamp(),
  assignedBy: `${ROUTER_NAME}: ${rule.name || rule.id}`,
  assignedById: null,
  routedByRule: rule.id,
});

const activeStaff = (user, companyId, involvesHR) =>
  user &&
  user.companyId === companyId &&
  user.status === 'active' &&
  (user.role === 'hr' || user.role === 'company_admin') &&
  !(involvesHR && user.role === 'hr');

/** Resolves a rule's action to a concrete { type: 'user'|'department', id, name } or null. */
async function resolveTarget(db, rule, companyId, involvesHR) {
  const { action } = rule;
  if (action.type === 'department') {
    const snap = await db.collection('departments').doc(action.id).get();
    if (!snap.exists || snap.data().companyId !== companyId) return null;
    return { type: 'department', id: snap.id, name: snap.data().name || action.name || snap.id };
  }

  if (action.type === 'user') {
    const snap = await db.collection('users').doc(action.id).get();
    const user = snap.exists ? snap.data() : null;
    if (!activeStaff(user, companyId, involvesHR)) return null;
    return { type: 'user', id: snap.id, name: user.displayName || user.username || action.name || snap.id };
  }

  // userTag: round-robin over the tag's active staff, in a stable (name, id) order.
  const members = await db
    .collection('users')
    .where('companyId', '==', companyId)
    .where('userTagId', '==', action.id)
    .get();
  const candidates = members.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => activeStaff(u, companyId, involvesHR))
    .sort((a, b) => String(a.displayName || a.username || '').localeCompare(String(b.displayName || b.username || '')) || a.id.localeCompare(b.id));
  if (candidates.length === 0) return null;

  // Server-only cursor (routingState is not client-writable) so successive cases rotate.
  const stateRef = db.collection('companies').doc(companyId).collection('routingState').doc(rule.id);
  const index = await db.runTransaction(async (tx) => {
    const state = await tx.get(stateRef);
    const next = ((state.exists && Number(state.data().cursor)) || 0) % candidates.length;
    tx.set(stateRef, { cursor: next + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return next;
  });
  const picked = candidates[index];
  return { type: 'user', id: picked.id, name: picked.displayName || picked.username || picked.id };
}

async function loadRules(db, companyId) {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('routingRules')
    .limit(MAX_RULES)
    .get();
  return orderedRules(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/**
 * @returns {Promise<{routed: boolean, ruleId?: string, reason?: string}>}
 */
async function routeCase(db, caseType, caseId, data) {
  const collectionName = COLLECTIONS[caseType];
  if (!collectionName || !data || !data.companyId) return { routed: false, reason: 'not-routable' };
  if (data.assignedTo) return { routed: false, reason: 'already-assigned' };

  const rules = await loadRules(db, data.companyId);
  if (rules.length === 0) return { routed: false, reason: 'no-rules' };

  const facts = caseFacts(caseType, data);
  const involvesHR = data.involvesHR === true;

  for (const rule of rules) {
    if (!ruleMatches(rule, facts)) continue;
    const target = await resolveTarget(db, rule, data.companyId, involvesHR);
    if (!target) continue;

    const caseRef = db.collection(collectionName).doc(caseId);
    const applied = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(caseRef);
      if (!fresh.exists || fresh.data().assignedTo) return false; // someone assigned it first
      tx.update(caseRef, { assignedTo: assignmentFor(target, rule), updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!applied) return { routed: false, reason: 'already-assigned' };

    await logRouting(db, caseType, caseId, data, rule, target);
    return { routed: true, ruleId: rule.id };
  }
  return { routed: false, reason: 'no-match' };
}

/** History + assignee notification, in the same shapes the client services write. */
async function logRouting(db, caseType, caseId, data, rule, target) {
  const metadata = {
    adminId: null,
    adminName: `${ROUTER_NAME}: ${rule.name || rule.id}`,
    assignmentType: target.type,
    assignedToId: target.id,
    assignedToName: target.name,
    dueDate: null,
    ruleId: rule.id,
    automated: true,
  };
  try {
    if (caseType === 'post') {
      await db.collection('postActivities').add({
        postId: caseId,
        type: 'assigned',
        companyId: data.companyId,
        metadata,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      await db.collection('caseActivities').add({
        caseType,
        caseId,
        type: 'assigned',
        companyId: data.companyId,
        metadata,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (target.type === 'user') {
      const title = data.title || data.vendorName || data.contentPreview || caseId;
      await db.collection('notifications').add({
        userId: target.id,
        type: 'assigned',
        title: 'New assignment',
        message: `You've been assigned to: ${title}`,
        ...(caseType === 'post' ? { postId: caseId } : { caseType, caseId }),
        companyId: data.companyId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    // The assignment is already saved; a missing history entry must not fail the trigger.
    console.error('caseRouting: could not write history', { caseType, code: error && error.code });
  }
}

module.exports = { routeCase, resolveTarget, loadRules };
