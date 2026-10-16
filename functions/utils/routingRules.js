/**
 * Server-side twin of src/utils/routingRules.js (matchRule/findMatchingRule).
 * Keep the matching logic identical in both files — there is no shared build
 * between src/ and functions/, so a change here must be mirrored there too.
 */

const CASE_TYPE_POST = 'post';
const CASE_TYPE_VENDOR = 'vendor';

function matchRule(rule, caseType, caseData) {
  if (!rule.enabled) return false;
  if (!Array.isArray(rule.appliesTo) || !rule.appliesTo.includes(caseType)) return false;
  const c = rule.conditions || {};

  if (caseType === CASE_TYPE_POST) {
    if (Array.isArray(c.postTypes) && c.postTypes.length > 0 && !c.postTypes.includes(caseData.type)) {
      return false;
    }
    if (Array.isArray(c.categories) && c.categories.length > 0 && !c.categories.includes(caseData.category)) {
      return false;
    }
    if (c.involvesHR === 'yes' && caseData.involvesHR !== true) return false;
    if (c.involvesHR === 'no' && caseData.involvesHR !== false) return false;
    return true;
  }

  if (caseType === CASE_TYPE_VENDOR) {
    if (
      Array.isArray(c.vendorCategories) &&
      c.vendorCategories.length > 0 &&
      !c.vendorCategories.includes(caseData.riskCategory)
    ) {
      return false;
    }
    if (
      Array.isArray(c.vendorSeverities) &&
      c.vendorSeverities.length > 0 &&
      !c.vendorSeverities.includes(caseData.severity)
    ) {
      return false;
    }
    return true;
  }

  return false;
}

function findMatchingRule(rules, caseType, caseData) {
  const sorted = [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const rule of sorted) {
    if (matchRule(rule, caseType, caseData)) return rule;
  }
  return null;
}

/**
 * A "department" rule action names a department, not a person — nothing downstream
 * (assignee notifications, "Assigned to Me") understands that type, so it must be
 * resolved to a real user before resolveRoutingAssignment returns. Resolves to the
 * department's headUserId when one is set and still active; otherwise null so the
 * caller falls back to resolveFallbackAssignee.
 */
async function resolveDepartmentHead(db, companyId, departmentId) {
  const deptSnap = await db.collection('departments').doc(departmentId).get();
  if (!deptSnap.exists) return null;
  const dept = deptSnap.data();
  if (dept.companyId !== companyId || !dept.headUserId) return null;

  const headSnap = await db.collection('users').doc(dept.headUserId).get();
  if (!headSnap.exists) return null;
  const head = headSnap.data();
  if (head.status !== undefined && head.status !== 'active') return null;

  return {
    id: dept.headUserId,
    name: head.displayName || '',
    departmentId,
    departmentName: dept.name || '',
  };
}

/**
 * Fallback assignee when a rule can't be resolved to a specific person (e.g. a
 * department with no head set): the company's first active company_admin, so the
 * case still lands on someone and they're notified, instead of sitting assigned
 * to a department id that nothing can act on.
 */
async function resolveFallbackAssignee(db, companyId) {
  const snap = await db
    .collection('users')
    .where('companyId', '==', companyId)
    .where('role', '==', 'company_admin')
    .limit(5)
    .get();
  const active = snap.docs.find((d) => {
    const data = d.data();
    return data.status === undefined || data.status === 'active';
  });
  if (!active) return null;
  return { id: active.id, name: active.data().displayName || '' };
}

/**
 * Loads a company's enabled routing rules and returns the first match for a
 * freshly-created case, resolved to a concrete user assignment, or null. Never
 * throws: a routing-rule lookup failure must not block case creation, so callers
 * get null and fall back to the un-routed (broadcast-to-staff) behaviour.
 */
async function resolveRoutingAssignment(db, companyId, caseType, caseData) {
  try {
    const snap = await db
      .collection('routingRules')
      .where('companyId', '==', companyId)
      .where('enabled', '==', true)
      .get();
    const rules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const rule = findMatchingRule(rules, caseType, caseData);
    if (!rule || !rule.action || !rule.action.id) return null;

    if (rule.action.type === 'department') {
      const head = await resolveDepartmentHead(db, companyId, rule.action.id);
      if (head) {
        return {
          ruleId: rule.id,
          ruleName: rule.name || '',
          assignment: { type: 'user', id: head.id, name: head.name },
          routedViaDepartment: { id: head.departmentId, name: head.departmentName },
        };
      }
      const fallback = await resolveFallbackAssignee(db, companyId);
      if (fallback) {
        return {
          ruleId: rule.id,
          ruleName: rule.name || '',
          assignment: { type: 'user', id: fallback.id, name: fallback.name },
          fallbackReason: 'department_no_head',
        };
      }
      return null;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name || '',
      assignment: {
        type: rule.action.type,
        id: rule.action.id,
        name: rule.action.name || '',
      },
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('resolveRoutingAssignment: lookup failed', { companyId, caseType });
    return null;
  }
}

module.exports = {
  matchRule,
  findMatchingRule,
  resolveDepartmentHead,
  resolveFallbackAssignee,
  resolveRoutingAssignment,
};
